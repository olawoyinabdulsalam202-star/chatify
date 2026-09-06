import { useEffect, useState } from "react";
import { DownloadIcon, XIcon, Share2Icon, PlusSquareIcon } from "lucide-react";

const DISMISS_KEY = "installPromptDismissedAt";
// Re-offer a week after a dismissal rather than never again.
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's non-standard flag for home-screen apps.
    window.navigator.standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch check distinguishes it.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// Chrome fires `beforeinstallprompt` and gives us a prompt() we can call from a
// click. Nothing shows an install offer on its own any more — the browser's own
// mini-infobar was removed years ago — so without a UI like this the app is
// installable and simply never tells anyone. That's why no prompt appeared.
//
// iOS has no such API at all: installing is Share > Add to Home Screen, done by
// hand, so there it's instructions rather than a button.
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const onBeforeInstallPrompt = (e) => {
      // Chrome requires preventDefault to keep the event usable later.
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iOS never fires that event, so offer the manual route instead — but only
    // after a short delay, so it doesn't greet a first-time visitor instantly.
    let timer;
    if (isIos()) {
      timer = setTimeout(() => setVisible(true), 20000);
    }

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) {
      setShowIosHelp(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The event is single-use; drop it whatever the answer was.
    setDeferredPrompt(null);
    if (outcome === "accepted") setVisible(false);
    else dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-slate-700 bg-slate-800/95 backdrop-blur p-3 shadow-2xl">
        {showIosHelp || (!deferredPrompt && isIos()) ? (
          <div className="flex items-start gap-3">
            <img src="/icon.svg" alt="" className="size-10 rounded-lg shrink-0 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">Install Havn</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Tap <Share2Icon className="inline w-3.5 h-3.5 align-[-2px]" /> Share, then
                <PlusSquareIcon className="inline w-3.5 h-3.5 align-[-2px] mx-1" />
                <span className="font-medium text-slate-300">Add to Home Screen</span>.
              </p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="text-slate-500 hover:text-slate-300 shrink-0">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="size-10 rounded-lg shrink-0 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100 truncate">Install Havn</p>
              <p className="text-xs text-slate-400">Full screen, and it works offline.</p>
            </div>
            <button
              onClick={install}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition-colors"
            >
              <DownloadIcon className="w-4 h-4" /> Install
            </button>
            <button onClick={dismiss} aria-label="Dismiss" className="text-slate-500 hover:text-slate-300 shrink-0">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstallPrompt;
