// Renaming the cache is what guarantees stale entries from an earlier build are
// discarded rather than merely bypassed: the activate handler deletes every
// cache whose key isn't CACHE_NAME. Bump the version suffix on any deploy that
// needs to reach installs already running an older worker.
const CACHE_NAME = "havn-cache-v1";

// Only the app shell gets cached — never API calls or the socket.io handshake,
// since those must always hit the network live.
//
// Each entry is cached independently below, so a single missing file only warns
// instead of failing the whole install (an atomic cache.addAll() once let one
// absent file silently disable the entire PWA).
const APP_SHELL = ["/", "/manifest.json", "/icon.svg", "/avatar.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each entry independently so one unexpected failure can't take the
      // whole install down again. The shell is an optimisation, not a
      // correctness requirement — the app still works if an entry is missed.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn("SW: failed to cache", url, err))
        )
      )
    )
  );
  // Deliberately NOT calling skipWaiting() here. A new worker must stay in the
  // "waiting" state until the user taps Update in the UpdatePrompt banner, which
  // posts SKIP_WAITING (see appUpdate.js). Activating early would claim the open
  // page and start serving new hashed bundles to the old running app —
  // chunk-load errors mid-session — and would also stop reg.waiting from ever
  // being set, which is how the banner detects an update is ready. On the very
  // first install there's no active worker to wait behind, so the browser
  // activates immediately regardless and the app is controlled right away.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      // Take control of open tabs only after the old cache is actually gone,
      // otherwise a claimed tab could still be served a stale entry mid-cleanup.
      .then(() => self.clients.claim())
  );
});

// Vite fingerprints its build output (index-a1b2c3d4.js), so a given URL's
// contents can never change. Those are the only responses safe to serve from
// cache without checking the network first.
function isImmutableAsset(url) {
  return /\/assets\/.+\.[0-9a-f]{8,}\.[a-z0-9]+$/i.test(url.pathname);
}

function isCacheableResponse(response) {
  // `basic` excludes opaque cross-origin responses, and the status check keeps
  // 206 partial responses (video range requests) out — Cache.put rejects those.
  return response && response.status === 200 && response.type === "basic";
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: fall back to this exact page, then to the shell. Any route works
    // from the shell because the SPA router resolves the path client-side.
    const cached = (await caches.match(request)) || (await caches.match("/"));
    if (cached) return cached;
    throw new Error("Offline and no cached shell available");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

// Serve cache immediately, refresh it in the background. Right for small
// same-origin extras (icons, manifest) that aren't version-locked to the HTML.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const update = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls or socket.io — those must always be live/network.
  // Cross-origin requests (Cloudinary media, fonts, TURN) are left alone too:
  // caching them here would bloat storage and can only produce opaque responses.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/socket.io") ||
    // version.json is the update-check endpoint. Serving it from cache would
    // always report the old build id and make the update banner never appear.
    url.pathname === "/version.json"
  ) {
    return;
  }

  // Navigations decide which JS/CSS the page will ask for next, so the HTML
  // must come from the network whenever the network is reachable. This is the
  // fix for "works on localhost but not on the deployed version".
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// --- Web Push -------------------------------------------------------------
// This is what makes notifications work when the app is closed. A socket event
// can't: it needs an open tab. The push service wakes this worker instead.

// Running count for the app icon badge, kept in the worker because it survives
// the page being closed. Reset when the user opens the app.
let badgeCount = 0;

function setBadge(count) {
  if ("setAppBadge" in self.navigator) {
    // Fails harmlessly on platforms that don't support badging (most desktop
    // browsers, iOS below 16.4), so it must never break the notification.
    self.navigator.setAppBadge(count).catch(() => {});
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Havn", body: event.data?.text() || "New message" };
  }

  event.waitUntil(
    (async () => {
      // Suppress the notification if the relevant chat is already visible —
      // otherwise the user gets a notification for a message they're watching
      // arrive. This is why the server sends push unconditionally: only the
      // client knows what's actually on screen.
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const hasVisibleWindow = clientList.some((c) => c.visibilityState === "visible");

      // Tell open pages about it regardless, so in-app badges update live.
      clientList.forEach((client) =>
        client.postMessage({ type: "PUSH_RECEIVED", payload: data })
      );

      if (hasVisibleWindow) return;

      badgeCount += 1;
      setBadge(badgeCount);

      await self.registration.showNotification(data.title || "Havn", {
        body: data.body || "New message",
        icon: "/icon.svg",
        badge: "/icon.svg",
        // Same tag = collapse into one notification per conversation rather
        // than a stack of them.
        tag: data.tag || "havn",
        renotify: true,
        // Vibration is the only alert that reliably works when the screen is
        // locked and the ringer is down.
        vibrate: [200, 100, 200],
        data: { url: data.url || "/", ...data },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      badgeCount = 0;
      if ("clearAppBadge" in self.navigator) {
        self.navigator.clearAppBadge().catch(() => {});
      }

      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing window rather than opening a duplicate — tapping a
      // notification should return you to the app you already have running.
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", payload: event.notification.data });
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

// The page tells the worker when the user has caught up, so the OS badge clears
// in step with the in-app one.
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    badgeCount = 0;
    if ("clearAppBadge" in self.navigator) {
      self.navigator.clearAppBadge().catch(() => {});
    }
  }
  if (event.data?.type === "SET_BADGE") {
    badgeCount = Number(event.data.count) || 0;
    setBadge(badgeCount);
  }
  // applyUpdate() posts this so the new worker can take over immediately
  // without waiting for all tabs to close. The reload that follows picks up
  // the new bundles once the worker has claimed the page.
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
