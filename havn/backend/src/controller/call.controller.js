import crypto from "node:crypto";
import { ENV } from "../lib/env.js";

export function getIceServers(_req, res) {
  const iceServers = [{ urls: ENV.STUN_URLS }];
  if (ENV.TURN_URLS.length) {
    let username = ENV.TURN_USERNAME;
    let credential = ENV.TURN_CREDENTIAL;
    if (ENV.TURN_STATIC_AUTH_SECRET) {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      username = `${expiry}:havn`;
      credential = crypto.createHmac("sha1", ENV.TURN_STATIC_AUTH_SECRET).update(username).digest("base64");
    }
    iceServers.push({ urls: ENV.TURN_URLS, username, credential });
  } else {
    iceServers.push(
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    );
  }
  return res.status(200).json({ iceServers, iceTransportPolicy: "relay" });
}
