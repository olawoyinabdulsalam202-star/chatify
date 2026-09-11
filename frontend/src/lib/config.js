// Where the backend lives. The frontend is on Vercel and the backend is on
// Render, so this can never be a relative path in production — Vercel has no
// socket server, and vercel.json rewrites every unknown path to index.html,
// which is why a relative socket URL made the handshake return HTML forever.
//
// Set VITE_BACKEND_URL in the Vercel project settings to point at a different
// backend (staging, a renamed Render service). If it's unset, the current
// Render deployment below is used.
const FALLBACK_BACKEND_URL = "https://chatify-hejl.onrender.com";

const configured = import.meta.env.VITE_BACKEND_URL?.trim();

// Strip any trailing slash so `${BACKEND_URL}/api` never becomes `//api`.
export const BACKEND_URL = (
  import.meta.env.MODE === "development"
    ? configured || "http://localhost:3000"
    : configured || FALLBACK_BACKEND_URL
).replace(/\/+$/, "");

// REST and the socket must always agree on the host — deriving both from the
// same constant is what keeps them from drifting apart again.
export const API_URL = `${BACKEND_URL}/api`;

// Surfaced in Settings -> About: true when VITE_BACKEND_URL was set at build
// time, false when the fallback above is in use. A production build reading
// "false" means the Vercel env var is missing and the live app is silently
// talking to the fallback backend.
export const BACKEND_URL_CONFIGURED = Boolean(configured);
