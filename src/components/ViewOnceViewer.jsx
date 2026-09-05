import { useEffect, useRef, useState } from "react";
import { XIcon, EyeOffIcon } from "lucide-react";

// Fullscreen view-once viewer, modelled on Telegram's: the media fills the
// screen, a ring counts the time down, and it closes itself when the time is up.
// Once it closes the media is gone for good — the server already stripped the
// URL when it was opened, so there is nothing left to re-fetch.
//
// Photos get a fixed window. Videos run for their own length, because cutting a
// clip off at an arbitrary number of seconds would hide part of the message.
const PHOTO_SECONDS = 15;

function ViewOnceViewer({ imageUrl, videoUrl, duration, senderName, onClose }) {
  const total = videoUrl ? Math.max(1, Math.ceil(duration || PHOTO_SECONDS)) : PHOTO_SECONDS;
  const [remaining, setRemaining] = useState(total);
  const videoRef = useRef(null);
  const closedRef = useRef(false);

  // One guarded close, so the timer finishing and the user tapping X can't both
  // fire it and double-handle the state.
  const closeOnce = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };

  useEffect(() => {
    // Videos drive their own countdown from playback position (below), so they
    // don't get the wall-clock timer — a paused or buffering clip shouldn't
    // burn through its own view time.
    if (videoUrl) return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const left = total - Math.floor((Date.now() - startedAt) / 1000);
      if (left <= 0) {
        clearInterval(interval);
        setRemaining(0);
        closeOnce();
      } else {
        setRemaining(left);
      }
    }, 250);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, total]);

  // Escape closes, matching every other modal in the app.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeOnce();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = total > 0 ? ((total - remaining) / total) * 100 : 100;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-2 min-w-0">
          <EyeOffIcon className="w-4 h-4 shrink-0 text-slate-400" />
          <span className="text-sm truncate">{senderName || "Photo"}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative size-8 grid place-items-center" aria-hidden="true">
            <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
              <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="rgb(var(--c-cyan-500))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 14}
                strokeDashoffset={(1 - pct / 100) * 2 * Math.PI * 14}
              />
            </svg>
            <span className="text-[10px] font-medium tabular-nums text-white">{remaining}</span>
          </div>
          <button onClick={closeOnce} aria-label="Close" className="text-white/80 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-h-full max-w-full object-contain"
            autoPlay
            playsInline
            // Sound on: a muted video message loses half its content. If
            // autoplay policy refuses, the catch below retries muted so the
            // clip still plays rather than showing a frozen frame.
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              el.muted = false;
              el.play().catch(() => {
                el.muted = true;
                el.play().catch(() => {});
              });
            }}
            onTimeUpdate={(e) => {
              const { currentTime, duration: d } = e.currentTarget;
              if (!d || Number.isNaN(d)) return;
              setRemaining(Math.max(0, Math.ceil(d - currentTime)));
            }}
            onEnded={closeOnce}
          />
        ) : (
          <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      <p className="pb-[calc(1rem+env(safe-area-inset-bottom))] px-4 text-center text-[11px] text-slate-500">
        This {videoUrl ? "video" : "photo"} can only be opened once.
      </p>
    </div>
  );
}

export default ViewOnceViewer;
