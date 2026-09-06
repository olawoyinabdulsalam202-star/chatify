import { useEffect, useState } from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { onUpdateAvailable, startUpdateWatch, applyUpdate } from "../lib/appUpdate";

const SNOOZE_KEY = "updatePromptSnoozedUntil";
// Short on purpose. "Later" should mean later, not never — running an old build
// is the problem being solved, so the ask comes back the same session.
const SNOOZE_MS = 60 * 60 * 1000;

// The "a new version is available — Update" bar, the same shape a native app
// store update takes. Shown to everyone on a stale build, logged in or not,
// on the web and in the installed PWA alike.
function UpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const stopWatch = startUpdateWatch();
    const unsubscribe = onUpdateAvailable(() => {
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (Date.now() < snoozedUntil) return;
      setAvailable(true);
    });

    return () => {
      unsubscribe();
      stopWatch();
    };
  }, []);

  if (!available) return null;

  const update = () => {
    // Latch immediately: applyUpdate clears caches before reloading, and on a
    // slow connection that's a second or two of nothing happening, which reads
    // as a dead button and invites a second press.
    setUpdating(true);
    localStorage.removeItem(SNOOZE_KEY);
    applyUpdate();
  };

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setAvailable(false);
  };

  return (
    // Top of the screen, so it can't collide with InstallPrompt at the bottom.
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[80] p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-cyan-500/30 bg-slate-800/95 backdrop-blur p-3 shadow-2xl flex items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-cyan-500" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">A new version is available</p>
          <p className="text-xs text-slate-400">Update to get the latest fixes and features.</p>
        </div>

        <button
          onClick={update}
          disabled={updating}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-70 px-3 py-2 text-xs font-medium text-white transition-colors"
        >
          <RefreshCwIcon className={`w-4 h-4 ${updating ? "animate-spin" : ""}`} />
          {updating ? "Updating…" : "Update"}
        </button>

        {!updating && (
          <button
            onClick={snooze}
            aria-label="Later"
            className="text-slate-500 hover:text-slate-300 shrink-0"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default UpdatePrompt;
