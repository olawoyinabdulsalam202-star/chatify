const base = (process.env.SMOKE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) throw new Error("Set SMOKE_EMAIL and SMOKE_PASSWORD to a verified local account.");

async function request(path, options = {}) {
  const response = await fetch(base + path, options);
  let data = {};
  try { data = await response.json(); } catch {}
  return { response, data };
}

const login = await request("/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json", "x-client": "havn-mobile" },
  body: JSON.stringify({ email, password }),
});
if (!login.response.ok || !login.data.token || !login.data.sessionId || !login.data.user) throw new Error("Mobile login did not return a device session.");
console.log("PASS mobile login returns token");
const token = login.data.token;
const authHeaders = { authorization: "Bearer " + token };

const check = await request("/auth/check", { headers: authHeaders });
if (!check.response.ok || String(check.data._id) !== String(login.data.user._id)) throw new Error("Bearer auth check failed.");
console.log("PASS bearer /auth/check");

const sessions = await request("/auth/sessions", { headers: authHeaders });
if (!sessions.response.ok || !sessions.data.some((session) => String(session._id) === String(login.data.sessionId))) throw new Error("Session list did not include the mobile device.");
console.log("PASS sessions list");

const started = await request("/auth/qr/start", { method: "POST" });
if (!started.response.ok || !started.data.code) throw new Error("QR start failed.");
const approved = await request("/auth/qr/approve", {
  method: "POST",
  headers: { ...authHeaders, "content-type": "application/json" },
  body: JSON.stringify({ code: started.data.code }),
});
if (!approved.response.ok) throw new Error("QR approval failed.");
const status = await request("/auth/qr/" + started.data.code + "/status");
const setCookie = status.response.headers.get("set-cookie") || "";
if (!status.response.ok || status.data.status !== "approved" || !setCookie.includes("jwt=")) throw new Error("QR status did not set the web cookie.");
const reused = await request("/auth/qr/" + started.data.code + "/status");
if (reused.response.status !== 410 || reused.response.headers.has("set-cookie")) throw new Error("QR code was reusable.");
console.log("PASS QR start, approve, cookie-once status and single use");

const username = login.data.user.username || process.env.SMOKE_USERNAME;
if (!username) throw new Error("Set SMOKE_USERNAME if the login response has no username.");
const profile = await request("/public/u/" + encodeURIComponent(username));
const expected = ["bio", "fullName", "isBadged", "profilePic", "username"];
if (!profile.response.ok || JSON.stringify(Object.keys(profile.data).sort()) !== JSON.stringify(expected)) throw new Error("Public profile shape is incorrect.");
console.log("PASS public profile returns only public fields");

const version = await request("/app/version");
if (!version.response.ok || !version.data.android?.latestVersion || !version.data.android?.minVersion) throw new Error("App version endpoint failed.");
console.log("PASS app version endpoint");

const revoke = await request("/auth/sessions/" + encodeURIComponent(login.data.sessionId), { method: "DELETE", headers: authHeaders });
if (!revoke.response.ok) throw new Error("Session revoke failed.");
const revokedCheck = await request("/auth/check", { headers: authHeaders });
if (revokedCheck.response.status !== 401) throw new Error("Revoked bearer token was accepted.");
console.log("PASS revoke and revoked token rejection");
