import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { enablePushNotifications } from "../lib/push";

const HIDE_KEY = "havn.hideAppNote";
const HIDE_UNTIL_KEY = "havn.hideAppNoteUntil";
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
let apkUrlRequest;

function dismissedAlready() {
  try {
    if (localStorage.getItem(HIDE_KEY) !== "true") return false;
    const until = Number(localStorage.getItem(HIDE_UNTIL_KEY));
    if (until > Date.now()) return true;
    localStorage.removeItem(HIDE_KEY);
    localStorage.removeItem(HIDE_UNTIL_KEY);
  } catch {}
  return false;
}

function getPlatform() {
  const userAgent = navigator.userAgent || "";
  const isIos = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return { isAndroid: /Android/i.test(userAgent), isIos };
}

async function getApkUrl() {
  if (!apkUrlRequest) {
    apkUrlRequest = axiosInstance.get("/app/version")
      .then(({ data }) => data.apkUrl || data.android?.apkUrl || "")
      .catch(() => "");
  }
  return apkUrlRequest;
}

export default function AppDownloadNote({ variant = "note" }) {
  const authUser = useAuthStore((state) => state.authUser);
  const [apkUrl, setApkUrl] = useState("");
  const [hidden, setHidden] = useState(dismissedAlready);
  const [permission, setPermission] = useState(() => window.Notification?.permission || "unsupported");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [platform] = useState(getPlatform);
  const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;

  useEffect(() => {
    let active = true;
    getApkUrl().then((url) => { if (active) setApkUrl(url); });
    return () => { active = false; };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(HIDE_KEY, "true");
      localStorage.setItem(HIDE_UNTIL_KEY, String(Date.now() + FOURTEEN_DAYS));
    } catch {}
    setHidden(true);
  };

  const enableIosNotifications = async () => {
    setPermissionBusy(true);
    try {
      if (authUser) {
        const result = await enablePushNotifications();
        setPermission(window.Notification?.permission || "default");
        if (!result.ok) return;
      } else if (window.Notification) {
        setPermission(await window.Notification.requestPermission());
      }
    } finally {
      setPermissionBusy(false);
    }
  };

  if (hidden) return null;

  const message = platform.isIos
    ? "Havn works in your browser. Tap Share, then Add to Home Screen for an app-like experience and notifications."
    : "Get the Havn app for a faster, smoother experience, with calls that ring even when the app is closed, better notifications and quicker loading.";
  const containerClass = variant === "banner"
    ? "flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-slate-900/50 px-3 py-2 text-xs text-slate-300"
    : variant === "section"
      ? "flex flex-col gap-4 rounded-2xl border border-[#E0D7CB] bg-white/60 p-5 text-[#57534E] sm:flex-row sm:items-center sm:justify-between sm:p-6"
      : "relative flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 text-left text-sm text-slate-300";

  return (
    <div className={containerClass}>
      <Smartphone aria-hidden className={`mt-0.5 size-4 shrink-0 ${variant === "section" ? "text-[#C2410C]" : "text-cyan-400"}`} />
      <div className="min-w-0 flex-1">
        <p className={variant === "section" ? "text-base leading-relaxed" : "leading-relaxed"}>{message}</p>
        {platform.isAndroid && !apkUrl && <p className="mt-1 text-xs opacity-70">Android app coming soon</p>}
        {platform.isAndroid && apkUrl && (
          <a href={apkUrl} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600">
            <Download aria-hidden className="size-4" /> Download for Android
          </a>
        )}
        {platform.isIos && standalone && permission !== "granted" && permission !== "unsupported" && (
          <button type="button" onClick={enableIosNotifications} disabled={permissionBusy} className="mt-2 min-h-9 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {permissionBusy ? "Enabling…" : "Enable notifications"}
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss app download note" className={`grid size-8 shrink-0 place-items-center rounded-full ${variant === "section" ? "text-[#78716C] hover:bg-black/5" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}><X aria-hidden className="size-4" /></button>
    </div>
  );
}
