// Detects that a newer build is deployed, and applies it on demand.
//
// Why this exists at all: the service worker's own `updatefound` event only
// fires when sw.js changes byte-for-byte. A normal deploy ships new hashed
// bundles and an *identical* sw.js, so nothing fires — and an installed PWA
// that is never closed keeps running whatever build it first loaded, for
// weeks. That's why users who hadn't logged in since a deploy were still on
// old code: there was no mechanism that could have told them.
//
// So detection is pinned to the build instead. vite.config.js stamps one id
// into the bundle (__BUILD_ID__) and the same id into /version.json. The
// running app knows what it *is*; version.json says what the server is
// *serving*. Different means newer.

export const CURRENT_BUILD_ID = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

const POLL_MS = 15 * 60 * 1000;

let latestBuildId = null;
const listeners = new Set();

// Subscribe to "an update is available". Fires immediately if one already is,
// so a late-mounting component doesn't miss the news.
export function onUpdateAvailable(fn) {
  listeners.add(fn);
  if (latestBuildId) fn(latestBuildId);
  return () => listeners.delete(fn);
}

function announce(buildId) {
  if (latestBuildId === buildId) return; // already told everyone about this one
  latestBuildId = buildId;
  listeners.forEach((fn) => fn(buildId));
}

async function fetchDeployedBuildId() {
  try {
    // no-store defeats the HTTP cache; the query param defeats any service
    // worker (including previously-deployed ones) that treats this as a
    // cacheable same-origin GET. Both are needed — a stale answer here would
    // report "up to date" forever, which is the exact bug being fixed.
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    if (!res.headers.get("content-type")?.includes("json")) return null; // dev SPA fallback
    const data = await res.json();
    return typeof data?.buildId === "string" ? data.buildId : null;
  } catch {
    return null; // offline, or version.json not deployed yet
  }
}

export async function checkForUpdate() {
  // Ask the browser to re-fetch sw.js too. Harmless when unchanged, and it's
  // what surfaces a genuinely new worker.
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
      if (reg?.waiting) announce("sw-waiting");
    } catch {
      // A failed update check must never break the app.
    }
  }

  const deployed = await fetchDeployedBuildId();
  if (deployed && deployed !== CURRENT_BUILD_ID) {
    announce(deployed);
    return true;
  }
  return Boolean(latestBuildId);
}

// Poll on an interval, and whenever the app comes back to the foreground.
// The visibility hook is the important one for a PWA: phones freeze background
// tabs, so an interval alone can sit unfired for days while the user is away
// and only resumes at the moment they return. Checking on resume is what
// catches "deployed overnight, opened in the morning".
export function startUpdateWatch() {
  if (import.meta.env.DEV) return () => {}; // no version.json in dev

  checkForUpdate();
  const timer = setInterval(checkForUpdate, POLL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") checkForUpdate();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", checkForUpdate);

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", checkForUpdate);
  };
}

// Swap onto the new build. Called from the button, never automatically — a
// silent reload can land mid-message, and a half-typed message is worse than a
// slightly old build.
export async function applyUpdate() {
  // Order matters. The caches hold the previous index.html, which points at the
  // previous hashed bundles; dropping them first is what makes the reload fetch
  // the new HTML rather than being served the old one again.
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // Storage may be unavailable (private mode, quota); reload anyway.
  }

  // Let a waiting worker take over. The registration is deliberately left in
  // place — unregistering would drop the push subscription with it, silently
  // turning off notifications for anyone who pressed Update.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  } catch {
    // Fall through to the reload regardless.
  }

  window.location.reload();
}
