import { useEffect, useRef, useState } from "react";
import { PlayIcon, PauseIcon, MicIcon } from "lucide-react";
import toast from "react-hot-toast";
import { formatDuration } from "./VoiceRecorder";

// A voice note's waveform is drawn from a deterministic hash of its URL rather
// than by decoding the audio: MediaRecorder's webm/opus can't be decoded in
// every browser, and decoding every note on mount would fetch them all. The
// bars are purely visual; scrubbing and progress use real playback time.
const BAR_COUNT = 28;
function barHeights(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = Math.imul(h, 1103515245) + 12345;
    bars.push(28 + ((h >>> 8) % 73)); // 28..100
  }
  return bars;
}

// `duration` is the length recorded when the note was sent (msg.audioDuration).
// It's the reliable source: a MediaRecorder webm reports duration Infinity until
// fully buffered, so the element's own duration can't be trusted for the label
// or for seek math.
function AudioBubble({ src, duration, isMine }) {
  const audioRef = useRef(null);
  const barsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const bars = useRef(barHeights(src || "")).current;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setCurrent(a.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrent(0);
    };
    // Only trust the element's duration when it's a real number (mp3 gives it
    // straight away; webm often reports Infinity). Otherwise keep the recorded
    // length passed in.
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setTotal(a.duration);
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const effectiveTotal = Number.isFinite(total) && total > 0 ? total : duration || 0;
  const progress = effectiveTotal > 0 ? Math.min(current / effectiveTotal, 1) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
    } else {
      // The old player flipped an optimistic "playing" flag and never handled a
      // rejected play() — so on the receiver's side a decode/network failure
      // showed the pause icon while nothing played. Drive the state from the
      // real audio events and surface a genuine failure instead.
      a.play().catch(() => {
        setIsPlaying(false);
        toast.error("Couldn't play this voice note");
      });
    }
  };

  const seekTo = (clientX) => {
    const el = barsRef.current;
    const a = audioRef.current;
    if (!el || !a || effectiveTotal <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    a.currentTime = ratio * effectiveTotal;
    setCurrent(a.currentTime);
  };

  // Tap or drag anywhere on the bars to move the playhead.
  const onPointerDown = (e) => {
    e.stopPropagation();
    seekTo(e.clientX);
    const move = (ev) => seekTo(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const shown = current > 0 ? current : effectiveTotal;

  return (
    <div
      className="flex items-center gap-2.5 mt-2 min-w-[190px] max-w-[240px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggle}
        className={`size-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isMine ? "bg-white/20 text-white hover:bg-white/30" : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
        }`}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          ref={barsRef}
          onPointerDown={onPointerDown}
          className="flex items-center gap-[2px] h-7 cursor-pointer touch-none"
        >
          {bars.map((h, i) => {
            const filled = i / BAR_COUNT <= progress;
            return (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-full transition-colors ${
                  filled
                    ? isMine
                      ? "bg-white"
                      : "bg-cyan-400"
                    : isMine
                    ? "bg-white/35"
                    : "bg-slate-500/50"
                }`}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-75">
          <MicIcon className="w-3 h-3" />
          <span>{formatDuration(shown)}</span>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}

export default AudioBubble;
