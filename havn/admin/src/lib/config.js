// The admin app talks to the same backend as the main frontend. In production
// set VITE_BACKEND_URL to the Render backend URL; in dev it defaults to the
// local server. Mirrors frontend/src/lib/config.js so the two never drift.
const FALLBACK_BACKEND_URL = "https://chatify-hejl.onrender.com";

const configured = import.meta.env.VITE_BACKEND_URL?.trim();

export const BACKEND_URL = (
  import.meta.env.MODE === "development"
    ? configured || "http://localhost:3000"
    : configured || FALLBACK_BACKEND_URL
).replace(/\/+$/, "");

export const API_URL = `${BACKEND_URL}/api`;
