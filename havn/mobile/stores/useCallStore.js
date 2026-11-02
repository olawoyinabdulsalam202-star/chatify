import { create } from "zustand";
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { dismissIncomingCall } from "../lib/callNotifications";

let peerConnection = null;
let pendingCandidates = [];
let callEndTimer = null;

async function iceConfiguration() {
  const config = await api("/calls/ice-servers");
  return { iceServers: config.iceServers || [], iceTransportPolicy: config.iceTransportPolicy || "all" };
}

async function addCandidate(candidate) {
  if (!peerConnection?.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }
  try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) { console.warn("ICE candidate rejected:", error.message); }
}

async function flushCandidates() {
  const queue = pendingCandidates;
  pendingCandidates = [];
  for (const candidate of queue) await addCandidate(candidate);
}

async function createConnection(targetId, localStream) {
  peerConnection = new RTCPeerConnection(await iceConfiguration());
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) getSocket()?.emit("iceCandidate", { to: targetId, candidate });
  };
  peerConnection.ontrack = ({ streams }) => useCallStore.setState({ remoteStream: streams[0] });
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    if (state) useCallStore.setState({ connectionState: state, callState: state === "connected" ? "connected" : state === "disconnected" || state === "failed" ? "reconnecting" : useCallStore.getState().callState, ...(state === "connected" && !useCallStore.getState().startedAt ? { startedAt: Date.now() } : {}) });
  };
  return peerConnection;
}

export const useCallStore = create((set, get) => ({
  callState: "idle",
  connectionState: "new",
  callType: null,
  peer: null,
  callId: null,
  incomingOffer: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  speaker: true,
  startedAt: null,
  duration: 0,
  queuedCall: null,
  queueCall: (person, callType) => set({ queuedCall: { person, callType } }),
  resumeQueuedCall: async () => {
    const queuedCall = get().queuedCall;
    set({ queuedCall: null });
    if (queuedCall) await get().startCall(queuedCall.person, queuedCall.callType);
  },
  startCall: async (person, callType) => {
    if (get().callState !== "idle") return;
    if (!getSocket()?.connected) throw new Error("Reconnect to Havn before starting a call.");
    try {
      const localStream = await mediaDevices.getUserMedia({ audio: true, video: callType === "video" ? { facingMode: "user" } : false });
      set({ callState: "calling", callType, peer: { id: String(person._id), name: person.fullName || person.username, avatar: person.profilePic || "" }, connectionState: "connecting", localStream });
      const pc = await createConnection(String(person._id), localStream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      set({ callState: "ringing" });
      getSocket()?.emit("callUser", { to: String(person._id), offer, callType });
      InCallManager.start({ media: callType === "video" ? "video" : "audio" });
      InCallManager.setSpeakerphoneOn(true);
    } catch (error) {
      get().cleanup();
      throw error;
    }
  },
  receiveCall: ({ callId, from, fromName, fromAvatar, offer, callType }) => {
    if (get().callState !== "idle") {
      getSocket()?.emit("declineCall", { to: from, callId });
      return;
    }
    set({ callId, peer: { id: String(from), name: fromName || "Havn contact", avatar: fromAvatar || "" }, incomingOffer: offer, callType, callState: "incoming", connectionState: "new" });
    dismissIncomingCall(callId);
    InCallManager.startRingtone("_BUNDLE_", [500, 1000], "default", 45);
  },
  acceptCall: async () => {
    const { peer, incomingOffer, callId, callType } = get();
    if (!peer || !incomingOffer) return;
    InCallManager.stopRingtone();
    try {
      const localStream = await mediaDevices.getUserMedia({ audio: true, video: callType === "video" ? { facingMode: "user" } : false });
      const pc = await createConnection(peer.id, localStream);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit("answerCall", { to: peer.id, answer, callId });
      set({ localStream, incomingOffer: null, callState: "connecting", startedAt: Date.now() });
      InCallManager.start({ media: callType === "video" ? "video" : "audio" });
      InCallManager.setSpeakerphoneOn(true);
    } catch (error) {
      get().declineCall();
      throw error;
    }
  },
  onAnswered: async ({ answer, callId }) => {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await flushCandidates();
    set({ callId: callId || get().callId, callState: "connecting", startedAt: Date.now() });
  },
  onCandidate: addCandidate,
  finishRemoteCall: (state = "ended") => {
    set({ callState: state, connectionState: "closed" });
    clearTimeout(callEndTimer);
    callEndTimer = setTimeout(() => get().cleanup(), 1800);
  },
  declineCall: () => {
    const { peer, callId } = get();
    if (peer) getSocket()?.emit("declineCall", { to: peer.id, callId });
    get().cleanup();
  },
  endCall: () => {
    const { peer, callId, startedAt } = get();
    if (peer) getSocket()?.emit("endCall", { to: peer.id, callId, callType: get().callType, duration: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0 });
    get().cleanup();
  },
  toggleMute: () => {
    const muted = !get().muted;
    get().localStream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    set({ muted });
  },
  toggleCamera: () => {
    const cameraOff = !get().cameraOff;
    get().localStream?.getVideoTracks().forEach((track) => { track.enabled = !cameraOff; });
    set({ cameraOff });
  },
  switchCamera: () => get().localStream?.getVideoTracks().forEach((track) => track._switchCamera?.()),
  toggleSpeaker: () => {
    const speaker = !get().speaker;
    InCallManager.setSpeakerphoneOn(speaker);
    set({ speaker });
  },
  tick: () => { if (get().startedAt) set({ duration: Math.floor((Date.now() - get().startedAt) / 1000) }); },
  cleanup: () => {
    clearTimeout(callEndTimer);
    const { callId } = get();
    if (callId) dismissIncomingCall(callId);
    InCallManager.stopRingtone();
    get().localStream?.getTracks().forEach((track) => track.stop());
    peerConnection?.close();
    peerConnection = null;
    pendingCandidates = [];
    InCallManager.stop();
    set({ callState: "idle", connectionState: "new", callType: null, peer: null, callId: null, incomingOffer: null, localStream: null, remoteStream: null, muted: false, cameraOff: false, speaker: true, startedAt: null, duration: 0 });
  },
}));

