import "dotenv/config";

export const ENV = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_URL: process.env.CLIENT_URL,
  // Every browser origin allowed to call the API and open a socket. CLIENT_URL
  // is the primary one; CLIENT_URLS can add more (a custom domain, a preview
  // deployment) as a comma-separated list. Trailing slashes are stripped
  // because the browser's Origin header never has one, and a single stray "/"
  // in a dashboard env var is enough to fail every CORS preflight and socket
  // handshake with a misleading error.
  //
  // CRITICAL: An empty array here rejects *every* browser origin — CORS and
  // Socket.IO will answer "No 'Access-Control-Allow-Origin'" and close the
  // handshake, which is why when CLIENT_URL is unset in production everyone
  // sees themselves alone online (their own socket connects, but nobody else's
  // does). The localhost fallback below is what makes `npm run dev` work
  // out-of-the-box without setting an env var first.
  ALLOWED_ORIGINS: [
    ...(process.env.CLIENT_URL || process.env.CLIENT_URLS
      ? [process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || "").split(",")]
      : ["http://localhost:5173"]),
    // The standalone admin console runs on its own origin (5174 in dev); allow
    // it here when ADMIN_URL is set, on top of the frontend origins above.
    ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL] : []),
  ]
    .map((url) => (url || "").trim().replace(/\/+$/, ""))
    .filter(Boolean),

  BREVO_API_KEY: process.env.BREVO_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  ARCJET_KEY: process.env.ARCJET_KEY,
  ARCJET_ENV: process.env.ARCJET_ENV,
  // Web Push (device notifications while the app is closed). Generate a pair
  // with `npx web-push generate-vapid-keys`. The PUBLIC key must also be given
  // to the frontend as VITE_VAPID_PUBLIC_KEY — they have to match, or the
  // browser's subscription can't be decrypted by this server. Leave unset to
  // disable push entirely; nothing else breaks.
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  // Group chatbot (Groq). Leave GROQ_API_KEY unset to disable the bot
  // entirely — it will simply never reply.
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  BOT_MODEL: process.env.BOT_MODEL || "llama-3.3-70b-versatile",
  BOT_NAME: process.env.BOT_NAME || "Kairos",
  BOT_EMAIL: process.env.BOT_EMAIL || "kairos.bot@internal.chatify",
  // Comma-separated list of emails that get isAdmin:true automatically at
  // signup — the only way to bootstrap the first admin account.
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
};

