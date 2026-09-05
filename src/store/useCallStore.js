import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { startRingtone, stopRingtone, startVibration } from "../lib/audioUnlock";

// STUN alone lets two callers connect directly, peer-to-peer — which means
// each side's real IP address is visible to the other via the WebRTC
// connection. A TURN server relays the media instead, so neither caller ever
// sees the other's real IP.
//
// TURN setup, free, with automatic fallback:
//   1. Built in, zero setup: Open Relay Project (run by Metered.ca), the
//      standard free-and-public TURN server the WebRTC community uses when
//      testing/prototyping. Listed on 3 different ports/transports below.
//   2. Optional, recommended: sign up free at metered.ca (20 GB/month, no
//      card) and set VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL
//      in the frontend .env. Those get added on TOP of the built-in one below
//      — not instead of it.
//
// Both sets are handed to RTCPeerConnection together. WebRTC's ICE protocol
// gathers candidates from every server in the list *in parallel* and simply
// uses whichever one actually connects — that's the fallback: if your
// configured TURN account is down, over quota, or blocked on someone's
// network, the built-in Open Relay entries are still there to pick up the
// call, and vice versa. No extra "retry the next provider" code needed.
const TURN_URL = import.meta.env.VITE_TURN_URL;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

const OPEN_RELAY_USERNAME = "openrelayproject";
const OPEN_RELAY_CREDENTIAL = "openrelayproject";

const ICE_SERVERS = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    // Open Relay Project — free, public, no signup. Three transports listed
    // so a network that blocks one port/protocol still has two other paths.
    { urls: "turn:openrelay.metered.ca:80", username: OPEN_RELAY_USERNAME, credential: OPEN_RELAY_CREDENTIAL },
    { urls: "turn:openrelay.metered.ca:443", username: OPEN_RELAY_USERNAME, credential: OPEN_RELAY_CREDENTIAL },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: OPEN_RELAY_USERNAME,
      credential: OPEN_RELAY_CREDENTIAL,
    },
    // Your own TURN account, if configured — extra capacity/reliability on
    // top of the built-in fallback above, never a replacement for it.
    ...(TURN_URL ? [{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL }] : []),
  ],
  // A TURN option is always present now (built-in fallback, at minimum), so
  // media always relays and real IPs are never exposed to the other caller.
  iceTransportPolicy: "relay",
};

let peerConnection = null;
let callSocketHandlers = null;

// ICE candidates that arrived before we could use them.
//
// The caller starts emitting candidates the moment it sets its local
// description — while the callee is still just *ringing* and has no
// RTCPeerConnection at all. Those candidates used to hit `if (!peerConnection)
// return` and be thrown away, so by the time the callee answered, the caller's
// entire first burst was gone. addIceCandidate also throws if the remote
// description isn't set yet, which is a second window where they were lost.
//
// With iceTransportPolicy:"relay" there are only a handful of candidates in
// total, so losing that first burst can leave no usable route — the call
// "connects" and carries no audio. Buffering them and flushing once the
// connection is ready is what closes both windows.
let pendingCandidates = [];

async function addOrQueueCandidate(candidate) {
  if (!candidate) return;
  if (!peerConnection || !peerConnection.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.log("addIceCandidate error:", error);
  }
}

async function flushPendingCandidates() {
  if (!peerConnection || !peerConnection.remoteDescription) return;
  const queued = pendingCandidates;
  pendingCandidates = [];
  for (const candidate of queued) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.log("addIceCandidate (flush) error:", error);
    }
  }
}

function createPeerConnection(getTargetId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const socket = useAuthStore.getState().socket;
      const to = getTargetId();
      if (socket && to) socket.emit("iceCandidate", { to, candidate: event.candidate });
    }
  };

  // ICE_SERVERS sets iceTransportPolicy:"relay", which forbids a direct
  // peer-to-peer path so neither caller can see the other's IP. The cost is
  // that a TURN server becomes mandatory: if every one of them is unreachable,
  // over quota, or rejecting the shared public credentials, ICE never finds a
  // route and NO MEDIA FLOWS AT ALL. The call still shows as connected and
  // simply has no sound — indistinguishable from "the call is muted".
  //
  // Without this handler that failure is completely silent. Surfacing it turns
  // a mystery into something diagnosable.
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") {
      console.error(
        "WebRTC ICE failed — no media route. All TURN servers are unreachable or " +
          "rejected the credentials. Because iceTransportPolicy is 'relay' (to keep " +
          "IP addresses private), there is no direct fallback. Configure your own " +
          "TURN server via VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL."
      );
      toast.error("Couldn't connect the call — no media route available");
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      console.error("WebRTC peer connection failed.");
    }
  };

  return pc;
}

export const useCallStore = create((set, get) => ({
  callState: "idle", // idle | calling | ringing | active
  callType: null, // "audio" | "video"
  peer: null, // { id, name, avatar }
  incomingOffer: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  callStartedAt: null,
  // True when the browser refused to autoplay the ringtone, so the incoming
  // call modal can surface a "tap for sound" control instead of ringing
  // silently with no explanation.
  ringtoneBlocked: false,
  // Cleanup handle for the vibration fallback; called from resetCall.
  stopVibration: null,

  startCall: async (targetUser, callType) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return toast.error("Not connected");
    if (get().callState !== "idle") return toast.error("You're already in a call");

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      peerConnection = createPeerConnection(() => get().peer?.id);
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      set({
        callState: "calling",
        callType,
        peer: { id: targetUser._id, name: targetUser.fullName, avatar: targetUser.profilePic, isBadged: targetUser.isBadged },
        localStream,
      });

      socket.emit("callUser", { to: targetUser._id, offer, callType });
    } catch (error) {
      console.log("startCall error:", error);
      toast.error("Couldn't access camera/microphone");
      get().resetCall();
    }
  },

  acceptCall: async () => {
    const socket = useAuthStore.getState().socket;
    const { incomingOffer, peer, callType, stopVibration } = get();
    if (!socket || !incomingOffer || !peer) return;

    // Answering doesn't pass through resetCall, so the ringtone has to be
    // silenced here or it keeps looping over the live conversation.
    stopRingtone();
    stopVibration?.();
    set({ ringtoneBlocked: false, stopVibration: null });

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      peerConnection = createPeerConnection(() => get().peer?.id);
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      // Candidates that arrived while this side was merely ringing are now
      // addable — without this flush the caller's first burst stays stranded.
      await flushPendingCandidates();
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answerCall", { to: peer.id, answer });

      set({ callState: "active", localStream, incomingOffer: null, callStartedAt: Date.now() });
    } catch (error) {
      console.log("acceptCall error:", error);
      toast.error("Couldn't access camera/microphone");
      get().declineCall();
    }
  },

  declineCall: () => {
    const socket = useAuthStore.getState().socket;
    const { peer } = get();
    if (socket && peer) socket.emit("declineCall", { to: peer.id });
    get().resetCall();
  },

  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const { peer } = get();
    if (socket && peer) socket.emit("endCall", { to: peer.id });
    get().resetCall();
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    localStream?.getAudioTracks().forEach((track) => (track.enabled = isMuted));
    set({ isMuted: !isMuted });
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    localStream?.getVideoTracks().forEach((track) => (track.enabled = isCameraOff));
    set({ isCameraOff: !isCameraOff });
  },

  resetCall: () => {
    const { localStream, stopVibration } = get();

    // Every path out of a call funnels through here — decline, hang up, remote
    // end, remote decline, unavailable, and accept. Stopping the ringtone in
    // this one place is what guarantees it can't keep playing after the call is
    // over, which is the failure mode of stopping it in a component cleanup.
    stopRingtone();
    stopVibration?.();

    localStream?.getTracks().forEach((track) => track.stop());
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    // Don't let one call's stranded candidates leak into the next one.
    pendingCandidates = [];
    set({
      callState: "idle",
      callType: null,
      peer: null,
      incomingOffer: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      callStartedAt: null,
      ringtoneBlocked: false,
      stopVibration: null,
    });
  },

  subscribeToCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    // Guard against double-registration. This is now called from an effect that
    // re-runs on authUser changes, and two copies of these handlers would mean
    // every incoming call fires twice — including the auto-decline branch,
    // which would decline the call it just accepted.
    if (callSocketHandlers) return;

    const handlers = {
      incomingCall: ({ from, fromName, fromAvatar, fromIsBadged, offer, callType }) => {
        if (get().callState !== "idle") {
          // Busy — auto-decline so the caller isn't left hanging.
          socket.emit("declineCall", { to: from });
          return;
        }
        set({
          callState: "ringing",
          callType,
          peer: { id: from, name: fromName, avatar: fromAvatar, isBadged: fromIsBadged },
          incomingOffer: offer,
        });

        // Ring from here, where the event actually lands, rather than from the
        // modal's mount effect. The modal only renders on a route that has
        // <IncomingCallModal /> mounted, so a call arriving while the user is
        // on Settings, the admin dashboard, or any non-chat route set the state
        // but never played a sound — the call was "silenced" purely because
        // nothing rendered to start it.
        startRingtone().then((playing) => {
          // Ignore a late resolve for a call that's already been handled.
          if (get().callState !== "ringing") {
            stopRingtone();
            return;
          }
          if (!playing) {
            // Autoplay refused: vibrate instead and let the modal offer a
            // tap-to-enable-sound control.
            set({ ringtoneBlocked: true, stopVibration: startVibration() });
          }
        });
      },
      callAnswered: async ({ answer }) => {
        if (!peerConnection) return;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        // The remote description is what makes queued candidates addable.
        await flushPendingCandidates();
        set({ callState: "active", callStartedAt: Date.now() });
      },
      iceCandidate: async ({ candidate }) => {
        // Queues instead of dropping when the connection isn't ready yet.
        await addOrQueueCandidate(candidate);
      },
      callDeclined: () => {
        toast.error(`${get().peer?.name || "They"} declined the call`);
        get().resetCall();
      },
      callEnded: () => {
        toast(`Call ended`);
        get().resetCall();
      },
      callUnavailable: ({ reconnecting } = {}) => {
        const name = get().peer?.name || "User";
        // `reconnecting` means they're still online but between sockets (screen
        // just locked, app switcher, tunnel). Saying "offline" there sends
        // people chasing a problem that resolves itself in seconds.
        toast.error(reconnecting ? `${name} is reconnecting — try again in a moment` : `${name} is offline`);
        get().resetCall();
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    callSocketHandlers = handlers;
  },

  // The handler slot is released even if the socket is already gone (logout
  // nulls it before ChatPage unmounts). Returning early there would leave the
  // slot populated, and the next subscribe call would treat the session as
  // already wired and never attach — so incoming calls would never ring again.
  unsubscribeFromCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!callSocketHandlers) return;
    if (socket) {
      Object.entries(callSocketHandlers).forEach(([event, handler]) => socket.off(event, handler));
    }
    callSocketHandlers = null;
  },
}));
