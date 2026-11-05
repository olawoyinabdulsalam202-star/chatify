import { useEffect, useState } from "react";
import { DownloadIcon, SmartphoneIcon, XIcon } from "lucide-react";

const DISMISSED_KEY = "havn.installPromptDismissed";

function isEligibleBrowser() {
  const userAgent = navigator.userAgent || "";
  const isAndroidChrome = /android/i.test(userAgent) && /chrome/i.test(userAgent) && !/(edg|opr|samsungbrowser)/i.test(userAgent);
  const isMobile = /android|iphone|ipad|ipod|mobile|tablet|silk|kindle/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isAndroidChrome || (window.innerWidth >= 768 && !isMobile);
}

function wasDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === "true"; } catch { return false; }
}

function dismissPermanently() {
  try { localStorage.setItem(DISMISSED_KEY, "true"); } catch {}
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wasDismissed() || window.matchMedia?.("(display-mode: standalone)").matches) return undefined;

    const onBeforeInstallPrompt = (event) => {
      if (!isEligibleBrowser()) return;
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      dismissPermanently();
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    dismissPermanently();
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      dismissPermanently();
      setVisible(false);
    }
    else dismiss();
  };

  if (!visible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/95 p-3 shadow-2xl backdrop-blur">
        <SmartphoneIcon aria-hidden className="size-5 shrink-0 text-cyan-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-100">Install Havn</p>
          <p className="text-xs text-slate-400">Add Havn to your apps for quicker access.</p>
        </div>
        <button type="button" onClick={install} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-xs font-medium text-white transition-colors hover:bg-cyan-600">
          <DownloadIcon aria-hidden className="size-4" /> Install
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="grid size-8 shrink-0 place-items-center text-slate-400 hover:text-slate-200">
          <XIcon aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
