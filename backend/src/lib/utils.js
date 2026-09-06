import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

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
