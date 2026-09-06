import { useState, useEffect } from "react";
import { useNavigate, useParams, Navigate } from "react-router";
import {
  ArrowLeftIcon,
  AtSignIcon,
  LoaderIcon,
  UserIcon,
  LockIcon,
  PaletteIcon,
  BellIcon,
  HelpCircleIcon,
  LogOutIcon,
  ChevronRightIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { FONTS, FONT_CATEGORIES, loadFont, getFontStack } from "../lib/fonts";
import {
  enablePushNotifications,
  disablePushNotifications,
  notificationPermission,
} from "../lib/push";

// Must stay in sync with the palettes in index.css and the daisyui.themes list
// in tailwind.config.js — a name present here but missing there would render as
// the default theme and look like the picker was ignoring the click.
const THEMES = [
  { value: "dark", label: "Dark", dark: true },
  { value: "light", label: "Light", dark: false },
];
const FONT_SIZES = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const DISAPPEAR_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "7 days" },
  { value: 7776000, label: "90 days" },
];

// Mirrors the server's USERNAME_CHANGE_COOLDOWN_MS. The server is the real
// guard — this only decides whether the Edit control is offered.
const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// The settings landing page is a list of these; each opens /settings/<key>.
const SECTIONS = [
  { key: "account", title: "Account", description: "Username and how people find you", Icon: UserIcon },
  {
    key: "privacy",
    title: "Privacy",
    description: "Last seen, disappearing messages, away note",
    Icon: LockIcon,
  },
  { key: "chats", title: "Chats", description: "Theme, font and message colour", Icon: PaletteIcon },
  {
    key: "notifications",
    title: "Notifications",
    description: "Message alerts on this device",
    Icon: BellIcon,
  },
  { key: "help", title: "Help", description: "About Havn, terms and privacy", Icon: HelpCircleIcon },
];

function SettingsPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { authUser, updateSettings, updateUsername, logout } = useAuthStore();

  const [theme, setTheme] = useState(authUser?.settings?.theme || "dark");
  const [fontSize, setFontSize] = useState(authUser?.settings?.fontSize || "medium");
  const [fontFamily, setFontFamily] = useState(authUser?.settings?.fontFamily || "sans");
  const [fontColor, setFontColor] = useState(authUser?.settings?.fontColor || "");
  const [awayMessage, setAwayMessage] = useState(authUser?.settings?.awayMessage || "");
  const [disappearEnabled, setDisappearEnabled] = useState(
    authUser?.settings?.disappearingMessages?.enabled || false
  );
  const [disappearDuration, setDisappearDuration] = useState(
    authUser?.settings?.disappearingMessages?.duration || 86400
  );
  // Defaults to true for accounts created before this field existed.
  const [showLastSeen, setShowLastSeen] = useState(authUser?.showLastSeen !== false);
  // "default" | "granted" | "denied" | "unsupported"
  const [pushState, setPushState] = useState(() => notificationPermission());
  const [pushBusy, setPushBusy] = useState(false);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // An unset usernameChangedAt means the handle was auto-assigned by the
  // backfill migration and never chosen by the user, so the cooldown doesn't
  // apply yet — this matches the server's rule.
  const usernameChangedAt = authUser?.usernameChangedAt
    ? new Date(authUser.usernameChangedAt).getTime()
    : null;
  const cooldownRemaining = usernameChangedAt
    ? USERNAME_COOLDOWN_MS - (Date.now() - usernameChangedAt)
    : 0;
  const usernameLocked = cooldownRemaining > 0;
  const daysUntilUnlock = Math.ceil(cooldownRemaining / (24 * 60 * 60 * 1000));

  const handleSaveUsername = async () => {
    const next = usernameInput.trim().toLowerCase();
    if (!next || next === authUser?.username) {
      setEditingUsername(false);
      return;
    }
    setSavingUsername(true);
    const ok = await updateUsername(next);
    setSavingUsername(false);
    if (ok) setEditingUsername(false);
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    const result = await enablePushNotifications();
    setPushBusy(false);

    if (result.ok) {
      setPushState("granted");
      toast.success("Notifications enabled");
      return;
    }

    // Each failure needs its own explanation — "didn't work" leaves the user
    // with nothing to act on, and the iOS case in particular is a real
    // platform limitation rather than something they did wrong.
    const messages = {
      unsupported: "This browser doesn't support notifications.",
      "ios-needs-install": "On iPhone, install Havn to your home screen first, then enable this.",
      denied: "Notifications are blocked. Allow them for this site in your browser settings.",
      dismissed: "Notification permission wasn't granted.",
      "server-not-configured": "Notifications aren't configured on the server yet.",
      error: "Couldn't enable notifications. Please try again.",
    };
    toast.error(messages[result.reason] || messages.error);
    setPushState(notificationPermission());
  };

  const handleDisablePush = async () => {
    await disablePushNotifications();
    // The browser permission itself can only be revoked by the user in browser
    // settings, so this reflects the subscription being gone, not the grant.
    setPushState(notificationPermission() === "granted" ? "default" : notificationPermission());
    toast.success("Notifications turned off for this device");
  };

  // Live preview: apply the theme to the document as soon as it's clicked,
  // rather than only after Save. Picking a look you can't see until you commit
  // it is what made the old picker feel broken even once it worked.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Same for the font — fetch it and apply it immediately so the dropdown
  // selection is visible in the page you're standing on.
  useEffect(() => {
    loadFont(fontFamily);
    document.documentElement.style.setProperty("--user-font-family", getFontStack(fontFamily));
  }, [fontFamily]);

  // If the user navigates away without saving, snap the document back to what
  // is actually stored on their account so the preview doesn't leak into the
  // rest of the app as a phantom setting.
  useEffect(() => {
    return () => {
      const saved = useAuthStore.getState().authUser?.settings;
      document.documentElement.setAttribute("data-theme", saved?.theme || "dark");
      const savedFont = saved?.fontFamily || "sans";
      loadFont(savedFont);
      document.documentElement.style.setProperty("--user-font-family", getFontStack(savedFont));
    };
  }, []);

  // Each sub-page saves only its own slice. The server merges via dot-notation,
  // so leaving a field out never wipes the others.
  const saveChats = (e) => {
    e.preventDefault();
    updateSettings({ theme, fontSize, fontFamily, fontColor });
  };

  const savePrivacy = (e) => {
    e.preventDefault();
    updateSettings({
      showLastSeen,
      awayMessage,
      disappearingMessages: { enabled: disappearEnabled, duration: disappearDuration },
    });
  };

  const activeSection = section ? SECTIONS.find((s) => s.key === section) : null;
  // A typo or stale link like /settings/foo drops back to the list rather than
  // rendering an empty page.
  if (section && !activeSection) return <Navigate to="/settings" replace />;

  const renderAccount = () => (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
      <label className="block text-sm font-medium mb-1">Username</label>
      <p className="text-xs text-slate-500 mb-3">
        Your @handle — how people find and add you. You can change it once every 7 days.
      </p>

      {editingUsername ? (
        <div className="space-y-2">
          <div className="relative">
            <AtSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={usernameInput}
              onChange={(e) =>
                setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))
              }
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ghostcode"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            3–30 characters: lowercase letters, numbers, dots and underscores.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveUsername}
              disabled={savingUsername}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {savingUsername && <LoaderIcon className="w-4 h-4 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingUsername(false)}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-slate-200 text-sm">@{authUser?.username}</span>
          <button
            type="button"
            onClick={() => {
              setUsernameInput(authUser?.username || "");
              setEditingUsername(true);
            }}
            disabled={usernameLocked}
            className="text-sm text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            Edit
          </button>
        </div>
      )}

      {usernameLocked && !editingUsername && (
        <p className="mt-2 text-xs text-slate-500">
          You can change it again in {daysUntilUnlock} day{daysUntilUnlock === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );

  const renderPrivacy = () => (
    <form onSubmit={savePrivacy} className="space-y-8">
      {/* LAST SEEN */}
      <div>
        <label className="flex items-center justify-between text-sm font-medium mb-2">
          Share last seen
          <input
            type="checkbox"
            checked={showLastSeen}
            onChange={(e) => setShowLastSeen(e.target.checked)}
            className="toggle toggle-sm"
          />
        </label>
        <p className="text-xs text-slate-500">
          Lets people see when you were last online. If you turn this off, you won't be able to see
          anyone else's either.
        </p>
      </div>

      {/* DISAPPEARING MESSAGES */}
      <div>
        <label className="flex items-center justify-between text-sm font-medium mb-2">
          Disappearing messages
          <input
            type="checkbox"
            checked={disappearEnabled}
            onChange={(e) => setDisappearEnabled(e.target.checked)}
            className="toggle toggle-sm"
          />
        </label>
        <p className="text-xs text-slate-500 mb-2">
          New messages you send will be marked for auto-removal after this duration.
        </p>
        {disappearEnabled && (
          <select
            value={disappearDuration}
            onChange={(e) => setDisappearDuration(Number(e.target.value))}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 text-sm outline-none"
          >
            {DISAPPEAR_OPTIONS.filter((o) => o.value !== 0).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* AWAY MESSAGE */}
      <div>
        <label className="block text-sm font-medium mb-2">Away message</label>
        <p className="text-xs text-slate-500 mb-2">Shown to people who message you (optional).</p>
        <textarea
          value={awayMessage}
          onChange={(e) => setAwayMessage(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="e.g. I'll reply after 6pm"
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-sm outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-cyan-500 hover:bg-cyan-600 transition-colors text-white rounded-lg py-2.5 font-medium"
      >
        Save privacy
      </button>
    </form>
  );

  const renderChats = () => (
    <form onSubmit={saveChats} className="space-y-8">
      {/* THEME */}
      <div>
        <label className="block text-sm font-medium mb-2">Theme</label>
        <p className="text-xs text-slate-500 mb-3">
          Applies instantly so you can see it. Press Save to keep it.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`text-xs py-2 px-2 rounded-lg border transition-colors flex items-center gap-2 ${
                theme === t.value
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-800/50 text-slate-400"
              }`}
            >
              {/* Renders in the theme it represents, so the swatch shows the
                  actual palette rather than a guess at it. */}
              <span
                data-theme={t.value}
                className="size-4 rounded-full border border-slate-600 bg-slate-900 shrink-0 grid place-items-center"
              >
                <span className="size-2 rounded-full bg-cyan-500" />
              </span>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FONT SIZE */}
      <div>
        <label className="block text-sm font-medium mb-2">Font size</label>
        <div className="flex gap-2">
          {FONT_SIZES.map((f) => (
            <button
              type="button"
              key={f.value}
              onClick={() => setFontSize(f.value)}
              className={`py-2 px-4 rounded-lg border transition-colors ${
                fontSize === f.value
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-800/50 text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* FONT FAMILY */}
      <div>
        <label htmlFor="font-select" className="block text-sm font-medium mb-2">
          Font
        </label>
        <p className="text-xs text-slate-500 mb-2">
          {FONTS.length} fonts. Only the one you pick gets downloaded.
        </p>
        <select
          id="font-select"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 text-sm outline-none focus:border-cyan-500"
        >
          {FONT_CATEGORIES.map((category) => (
            <optgroup key={category.key} label={category.label}>
              {FONTS.filter((f) => f.category === category.key).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Preview of the selected font. The whole page already switches to it
            live, but a pangram makes the letterforms legible at a glance
            without hunting for text in the UI. */}
        <div
          className="mt-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
          style={{ fontFamily: getFontStack(fontFamily) }}
        >
          <p className="text-slate-200 text-base">The quick brown fox jumps over the lazy dog</p>
          <p className="text-slate-400 text-sm mt-1">
            0123456789 — Sphinx of black quartz, judge my vow.
          </p>
        </div>
      </div>

      {/* FONT COLOR */}
      <div>
        <label className="block text-sm font-medium mb-2">Message text color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={fontColor || "#FAF7F2"}
            onChange={(e) => setFontColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer bg-transparent border border-slate-700"
          />
          <button
            type="button"
            onClick={() => setFontColor("")}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Reset to default
          </button>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-cyan-500 hover:bg-cyan-600 transition-colors text-white rounded-lg py-2.5 font-medium"
      >
        Save chats
      </button>
    </form>
  );

  const renderNotifications = () => (
    <div>
      <label className="block text-sm font-medium mb-2">Device notifications</label>
      <p className="text-xs text-slate-500 mb-2">
        Get notified about new messages even when Havn is closed.
      </p>
      {pushState === "unsupported" ? (
        <p className="text-xs text-slate-500 bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          This browser doesn't support push notifications.
        </p>
      ) : pushState === "granted" ? (
        <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <span className="text-sm text-emerald-400">Enabled on this device</span>
          <button
            type="button"
            onClick={handleDisablePush}
            className="text-xs text-slate-400 hover:text-red-400"
          >
            Turn off
          </button>
        </div>
      ) : pushState === "denied" ? (
        <p className="text-xs text-amber-400/90 bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          Notifications are blocked. Enable them for this site in your browser settings, then reload.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleEnablePush}
          disabled={pushBusy}
          className="w-full bg-slate-800/50 border border-slate-700 hover:border-cyan-500 disabled:opacity-50 rounded-lg py-2.5 text-sm text-slate-200 transition-colors"
        >
          {pushBusy ? "Enabling…" : "Enable notifications"}
        </button>
      )}
    </div>
  );

  const renderHelp = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <p className="text-sm text-slate-200 font-medium">Havn</p>
        <p className="text-xs text-slate-500 mt-1">
          Private messaging — direct chats, groups, calls and stories.
        </p>
      </div>
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/50">
        <button
          type="button"
          onClick={() => navigate("/terms")}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-800/60 transition-colors"
        >
          <span className="text-sm text-slate-100">Terms of Service</span>
          <ChevronRightIcon className="w-5 h-5 text-slate-600" />
        </button>
        <button
          type="button"
          onClick={() => navigate("/privacy")}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-800/60 transition-colors"
        >
          <span className="text-sm text-slate-100">Privacy Policy</span>
          <ChevronRightIcon className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (section) {
      case "account":
        return renderAccount();
      case "privacy":
        return renderPrivacy();
      case "chats":
        return renderChats();
      case "notifications":
        return renderNotifications();
      case "help":
        return renderHelp();
      default:
        return null;
    }
  };

  return (
    <div className="relative z-10 min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-xl mx-auto">
        {activeSection ? (
          <>
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6"
            >
              <ArrowLeftIcon className="w-5 h-5" /> Settings
            </button>
            <h1 className="text-2xl font-semibold mb-6">{activeSection.title}</h1>
            {renderSection()}
          </>
        ) : (
          <>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6"
            >
              <ArrowLeftIcon className="w-5 h-5" /> Back
            </button>
            <h1 className="text-2xl font-semibold mb-6">Settings</h1>

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/50">
              {SECTIONS.map(({ key, title, description, Icon }) => (
                <button
                  key={key}
                  onClick={() => navigate(`/settings/${key}`)}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-slate-800/60 transition-colors"
                >
                  <span className="size-10 rounded-full bg-slate-700/60 grid place-items-center shrink-0">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-100">{title}</span>
                    <span className="block text-xs text-slate-500 truncate">{description}</span>
                  </span>
                  <ChevronRightIcon className="w-5 h-5 text-slate-600 shrink-0" />
                </button>
              ))}
            </div>

            <button
              onClick={logout}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <LogOutIcon className="w-4 h-4" /> Log out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
