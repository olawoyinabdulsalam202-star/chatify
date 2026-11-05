import { useEffect, useRef, useState } from "react";
import { DownloadIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { axiosInstance } from "../lib/axios";

const CLOSED_AT_KEY = "havn.appBannerClosedAt";
const SHOW_AGAIN_AFTER = 10 * 60 * 1000;
let versionRequest;

function isDesktopBrowser() {
  const userAgent = navigator.userAgent || "";
  const isMobileAgent = /android|iphone|ipad|ipod|mobile|tablet|silk|kindle/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return window.innerWidth >= 768 && !isMobileAgent;
}

function readClosedAt() {
  try {
    return Number(localStorage.getItem(CLOSED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function getApkUrl() {
  if (!versionRequest) {
    versionRequest = axiosInstance.get("/app/version")
      .then(({ data }) => typeof data.apkUrl === "string" ? data.apkUrl : data.android?.apkUrl || "")
      .catch(() => "");
  }
  return versionRequest;
}

export default function AppInstallBanner() {
  const [eligible, setEligible] = useState(isDesktopBrowser);
  const [visible, setVisible] = useState(false);
  const [apkUrl, setApkUrl] = useState("");
  const [showQr, setShowQr] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let active = true;
    getApkUrl().then((url) => { if (active) setApkUrl(url); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const updateEligibility = () => setEligible(isDesktopBrowser());
    window.addEventListener("resize", updateEligibility);
    return () => window.removeEventListener("resize", updateEligibility);
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!eligible) {
      setVisible(false);
      return undefined;
    }
    const closedAt = readClosedAt();
    const remaining = SHOW_AGAIN_AFTER - (Date.now() - closedAt);
    if (!closedAt || remaining <= 0) {
      try { localStorage.removeItem(CLOSED_AT_KEY); } catch {}
      setVisible(true);
      return undefined;
    }
    setVisible(false);
    timer.current = setTimeout(() => {
      try { localStorage.removeItem(CLOSED_AT_KEY); } catch {}
      setVisible(true);
    }, remaining);
    return () => clearTimeout(timer.current);
  }, [eligible]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const dismiss = () => {
    try { localStorage.setItem(CLOSED_AT_KEY, String(Date.now())); } catch {}
    setShowQr(false);
    setVisible(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { localStorage.removeItem(CLOSED_AT_KEY); } catch {}
      setVisible(true);
    }, SHOW_AGAIN_AFTER);
  };

  if (!eligible || !visible) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(apkUrl)}`;
  return (
    <div className="relative z-20 flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-800 px-3 py-2 text-slate-200 shadow-sm">
      <SmartphoneIcon aria-hidden className="size-4 shrink-0 text-cyan-400" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed">
        Havn is coming to your phone. Install the mobile app for faster chats and calls that ring when the app is closed.
        {!apkUrl && <span className="ml-2 whitespace-nowrap text-slate-400">Android app coming soon</span>}
      </p>
      {apkUrl && (
        <div className="relative shrink-0">
          <button type="button" onClick={() => setShowQr((open) => !open)} aria-expanded={showQr} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-xs font-medium text-white hover:bg-cyan-600">
            <DownloadIcon aria-hidden className="size-4" /> Get the app
          </button>
          {showQr && (
            <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
              <img src={qrUrl} alt="QR code to download the Havn Android app" className="mx-auto size-44 rounded-lg bg-white p-1" />
              <a href={apkUrl} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs font-medium text-cyan-400 hover:text-cyan-300">Open APK download</a>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss app install banner" title="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
