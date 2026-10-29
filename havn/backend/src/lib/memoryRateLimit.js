const buckets = new Map();

function currentBucket(key, windowMs) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
    if (buckets.size > 20000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return bucket;
}

export function rateLimit({ key, limit, windowMs, message = "Too many requests. Please try again shortly." }) {
  return (req, res, next) => {
    const bucketKey = `${key(req)}:${Math.floor(Date.now() / windowMs)}`;
    const bucket = currentBucket(bucketKey, windowMs);
    bucket.count += 1;
    if (bucket.count > limit) {
      return res.status(429).json({ message, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)) });
    }
    next();
  };
}

const loginFailures = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT_IP = 30;
const LOGIN_LIMIT_ACCOUNT = 10;

function loginKey(type, value) {
  return `${type}:${value}`;
}

export function checkLoginLimit(ip, account) {
  const now = Date.now();
  for (const key of [loginKey("ip", ip || "unknown"), loginKey("account", (account || "unknown").toLowerCase())]) {
    const state = loginFailures.get(key);
    if (state && state.resetAt <= now) loginFailures.delete(key);
    else if (state && state.count >= (key.startsWith("ip:") ? LOGIN_LIMIT_IP : LOGIN_LIMIT_ACCOUNT)) return false;
  }
  return true;
}

export function recordLoginFailure(ip, account) {
  const now = Date.now();
  for (const key of [loginKey("ip", ip || "unknown"), loginKey("account", (account || "unknown").toLowerCase())]) {
    const state = loginFailures.get(key);
    if (!state || state.resetAt <= now) loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    else state.count += 1;
  }
  if (loginFailures.size > 10000) {
    for (const [key, state] of loginFailures) if (state.resetAt <= now) loginFailures.delete(key);
  }
}

export function clearLoginFailures(ip, account) {
  loginFailures.delete(loginKey("ip", ip || "unknown"));
  loginFailures.delete(loginKey("account", (account || "unknown").toLowerCase()));
}
