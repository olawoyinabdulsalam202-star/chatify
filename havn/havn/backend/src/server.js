import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import storyRoutes from "./routes/story.route.js";
import adminRoutes from "./routes/admin.route.js";
import friendRoutes from "./routes/friend.route.js";
import pushRoutes from "./routes/push.route.js";
import stickerRoutes from "./routes/sticker.route.js";
import dns from "node:dns/promises";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";
import { seedBotUser } from "./lib/bot.js";
import { seedSystemAccounts } from "./lib/systemAccounts.js";
import { initPush } from "./lib/push.js";

// Disabled: forcing external resolvers here caused querySrv ETIMEOUT on
// Render cold starts when resolving the mongodb+srv record. Let Node use
// the platform's default DNS instead.
// dns.setServers(['1.1.1.1', '8.8.8.8']);

const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

// We sit behind a reverse proxy (Render/Vercel/etc). Without this, Express
// sees the proxy's IP instead of the real client IP, which breaks Arcjet's
// per-IP rate limiting/bot detection and secure-cookie behavior.
app.set("trust proxy", 1);

// Security headers (CSP, HSTS, no-sniff, clickjacking protection, etc).
// crossOriginResourcePolicy is relaxed so Cloudinary-hosted media/avatars
// still load cross-origin from the frontend.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // this is an API server, not serving HTML pages
  }),
);

app.use(express.json({ limit: "20mb" })); // req.body — raised from 5mb to fit base64 video statuses
app.use(cors({ origin: ENV.ALLOWED_ORIGINS, credentials: true }));
app.use(cookieParser());
// Strips any request body/query keys starting with "$" or containing "."
// so req.body values can never be interpreted as Mongo query operators
// (e.g. { email: { "$gt": "" } } to bypass a findOne({ email }) lookup).
app.use(mongoSanitize());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/stickers", stickerRoutes);

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
  console.log(
    "Allowed browser origins:",
    ENV.ALLOWED_ORIGINS.join(", ") || "(none)",
  );
  // Sets up Web Push if both the package and the VAPID keys are present.
  // Returns false and logs why otherwise — it never throws, so a missing
  // dependency or key can't stop the server from serving messages.
  initPush();
  // Presence, typing, calls and notifications all ride the socket, and the
  // socket handshake is refused when the browser's origin isn't on that list.
  // Shout about it at boot rather than letting it look like "everyone is
  // offline" in the UI.
  if (
    ENV.NODE_ENV === "production" &&
    !process.env.CLIENT_URL &&
    !process.env.CLIENT_URLS
  ) {
    console.warn(
      "WARNING: CLIENT_URL is not set. Falling back to localhost, which will " +
        "reject your deployed frontend — every user will appear offline and " +
        "calls/notifications will not work. Set CLIENT_URL to your frontend URL.",
    );
  }
  connectDB().then(async () => {
    await seedBotUser();
    await seedSystemAccounts();
  });
});
