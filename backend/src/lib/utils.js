import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

const { COOKIE_DOMAIN } = ENV;

// The cookie options that define this app's session, in one place.
//
// A cookie can only be cleared by a Set-Cookie whose attributes MATCH the ones
// it was created with. Logout used to send a bare `res.cookie("jwt", "", {
// maxAge: 0 })`, and because the frontend (Vercel) and API (Render) are
// different sites, a cookie without SameSite=None; Secure is rejected outright
// on a cross-site response — so the clear never landed and "log out" left the
// session fully alive. Sharing this object is what keeps set and clear in sync.
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,   // never readable from JS, so XSS can't steal the session
  sameSite: "none", // frontend and API are different sites
  secure: true,     // required by browsers whenever sameSite is "none"
  // Only add Domain when COOKIE_DOMAIN is set (frontend/admin/API share a root,
  // e.g. ".kairos-va.com") so the cookie is first-party across subdomains. Unset
  // => omit Domain: a host-only cookie, correct when the hosts don't share a
  // root. This must live on the shared object so login's set and logout's clear
  // carry the same Domain, per the invariant above.
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

export const AUTH_COOKIE_NAME = "jwt";

export const generateToken = (userId, res) => {
  const { JWT_SECRET } = ENV;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d"
  });

  res.cookie(AUTH_COOKIE_NAME, token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

// Clears the session cookie using the exact same attributes it was set with.
export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
};
