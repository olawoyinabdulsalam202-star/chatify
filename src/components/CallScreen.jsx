import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../store/useCallStore";
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, PhoneOffIcon } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";

function formatElapsed(startedAt) {
  if (!startedAt) return "0:00";
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CallScreen() {
  const {
    peer,
    callType,
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callStartedAt,
    toggleMute,
    toggleCamera,
    endCall,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [elapsed, setElapsed] = useState("0:00");
  // True when the browser blocked remote audio playback, so we can offer a tap.
  const [needsAudioTap, setNeedsAudioTap] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (callType === "audio" && remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }

    // Setting srcObject does not guarantee playback. `autoPlay` only fires when
    // the element already exists at attach time, and on a remote stream that
    // arrives later the element can stay paused — a connected call with no
    // sound, which is indistinguishable from the call being muted. Explicitly
    // starting it (and un-muting, in case a browser applied its autoplay mute)
    // is what makes the audio actually audible.
    const el = callType === "video" ? remoteVideoRef.current : remoteAudioRef.current;
    if (el && remoteStream) {
      el.muted = false;
      el.volume = 1;
      el.play().catch((err) => {
        // Autoplay policy refused. Media is flowing but the element won't start
        // on its own, so tell the user rather than leaving a silent call.
        console.error("Remote audio play() was blocked:", err?.name || err);
        setNeedsAudioTap(true);
      });
    }
  }, [remoteStream, callType]);

  // Recovers a call whose audio the browser refused to start: this click is a
  // user gesture, which autoplay policy always accepts.
  const enableCallAudio = () => {
    const el = callType === "video" ? remoteVideoRef.current : remoteAudioRef.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    el.play()
      .then(() => setNeedsAudioTap(false))
      .catch(() => {});
  };

  useEffect(() => {
    if (!callStartedAt) return;
    const interval = setInterval(() => setElapsed(formatElapsed(callStartedAt)), 1000);
    return () => clearInterval(interval);
  }, [callStartedAt]);

  if (!peer) return null;

  const isVideo = callType === "video";

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center">
      {isVideo ? (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover bg-slate-900"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-4 right-4 w-28 h-40 rounded-lg object-cover border border-slate-700 bg-slate-800"
          />
        </>
      ) : (
        <audio ref={remoteAudioRef} autoPlay playsInline />
      )}

      {needsAudioTap && (
        <button
          onClick={enableCallAudio}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full bg-white/90 text-slate-900 px-5 py-3 text-sm font-medium shadow-lg"
        >
          Tap to enable call audio
        </button>
      )}

      <div className="absolute top-8 left-0 right-0 text-center z-10">
        {!isVideo && (
          <img
            src={peer.avatar || "/avatar.svg"}
            alt={peer.name}
            className="size-24 rounded-full mx-auto mb-4 object-cover"
          />
        )}
        <h3 className="text-white text-lg font-medium drop-shadow flex items-center justify-center gap-1">
          {peer.name}
          {peer.isBadged && <VerifiedBadge className="w-4 h-4" />}
        </h3>
        <p className="text-white/70 text-sm drop-shadow">
          {callState === "calling" ? "Calling…" : elapsed}
        </p>
      </div>

      <div className="absolute bottom-10 flex items-center gap-6 z-10">
        <button
          onClick={toggleMute}
          className={`size-14 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? "bg-white text-slate-900" : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          {isMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
        </button>

        {isVideo && (
          <button
            onClick={toggleCamera}
            className={`size-14 rounded-full flex items-center justify-center transition-colors ${
              isCameraOff ? "bg-white text-slate-900" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {isCameraOff ? <VideoOffIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={endCall}
          className="size-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
        >
          <PhoneOffIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

export default CallScreen;
