import { Linking } from "react-native";

let routerRef = null;
let routerReady = false;
let queuedNavigation = null;
let loginDestination = null;

function fallbackLink(path) {
  const target = `havn:///${String(path).replace(/^\//, "")}`;
  Linking.openURL(target).catch(() => {});
}

export function setNavigationRouter(router, ready) {
  routerRef = router;
  routerReady = Boolean(ready);
  if (routerReady && queuedNavigation) {
    const next = queuedNavigation;
    queuedNavigation = null;
    routerRef.push(next.path);
    next.onNavigated?.();
  }
}

export function push(path, onNavigated) {
  if (!path) return false;
  if (routerReady && routerRef) {
    routerRef.push(path);
    onNavigated?.();
    return true;
  }
  queuedNavigation = { path, onNavigated };
  fallbackLink(path);
  return false;
}

export function queueForLogin(path, onNavigated) {
  if (path) loginDestination = { path, onNavigated };
}

export function takeLoginDestination() {
  const destination = loginDestination;
  loginDestination = null;
  return destination;
}
