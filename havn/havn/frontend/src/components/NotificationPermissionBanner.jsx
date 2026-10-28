import { useEffect, useState } from "react";
import { BellIcon, XIcon } from "lucide-react";
import { enablePushNotifications, notificationPermission } from "../lib/push";

function NotificationPermissionBanner({ userId }) {
  const [permission, setPermission] = useState(() => notificationPermission());
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`push-banner-dismissed-${userId}`) === "true"
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(notificationPermission());
    setDismissed(localStorage.getItem(`push-banner-dismissed-${userId}`) === "true");
  }, [userId]);

  const enable = async () => {
    setBusy(true);
    const result = await enablePushNotifications();
    setBusy(false);
    setPermission(notificationPermission());
    if (result.ok || result.reason === "denied") setDismissed(true);
  };

  const dismiss = () => {
    localStorage.setItem(`push-banner-dismissed-${userId}`, "true");
    setDismissed(true);
  };

  if (permission !== "default" || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3 shadow-xl">
      <BellIcon className="h-5 w-5 shrink-0 text-cyan-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100">Turn on notifications?</p>
        <p className="text-xs text-slate-400">Get message alerts when Havn is closed.</p>
      </div>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="shrink-0 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
      >
        {busy ? "Enabling…" : "Turn on"}
      </button>
      <button type="button" onClick={dismiss} className="shrink-0 text-slate-400" aria-label="Dismiss">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default NotificationPermissionBanner;
