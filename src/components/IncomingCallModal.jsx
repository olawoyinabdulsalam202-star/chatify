import { useCallStore } from "../store/useCallStore";
import { PhoneIcon, PhoneOffIcon, VideoIcon, VolumeXIcon } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import { startRingtone } from "../lib/audioUnlock";

function IncomingCallModal() {
  const { peer, callType, acceptCall, declineCall, ringtoneBlocked } = useCallStore();

  // The ringtone is started and stopped in useCallStore, on the socket event
  // itself. It deliberately does NOT happen here: this modal only exists on
  // routes that mount it, so ringing from a mount effect meant a call arriving
  // while the user sat on Settings or the admin dashboard never made a sound.
  // Starting it here as well would just double the audio.

  // Tapping is itself a user gesture, so it can start the sound that autoplay
  // refused — this makes a blocked ringtone recoverable instead of a dead end.
  const enableSound = async () => {
    const playing = await startRingtone();
    if (playing) useCallStore.setState({ ringtoneBlocked: false });
  };

  if (!peer) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-xs text-center">
        <img
          src={peer.avatar || "/avatar.svg"}
          alt={peer.name}
          className="size-24 rounded-full mx-auto mb-4 object-cover"
        />
        <h3 className="text-slate-100 text-lg font-medium flex items-center justify-center gap-1">
          {peer.name}
          {peer.isBadged && <VerifiedBadge className="w-4 h-4" />}
        </h3>
        <p className="text-slate-400 text-sm mb-8 flex items-center justify-center gap-1.5">
          {callType === "video" ? <VideoIcon className="w-4 h-4" /> : <PhoneIcon className="w-4 h-4" />}
          Incoming {callType} call…
        </p>

        {ringtoneBlocked && (
          <button
            onClick={enableSound}
            className="mb-6 mx-auto flex items-center gap-2 rounded-full bg-slate-700 hover:bg-slate-600 px-4 py-2 text-xs text-slate-200 transition-colors"
          >
            <VolumeXIcon className="w-4 h-4" />
            Ringtone blocked — tap for sound
          </button>
        )}

        <div className="flex items-center justify-center gap-8">
          <button
            onClick={declineCall}
            className="size-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
          >
            <PhoneOffIcon className="w-6 h-6" />
          </button>
          <button
            onClick={acceptCall}
            className="size-14 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors"
          >
            <PhoneIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallModal;
