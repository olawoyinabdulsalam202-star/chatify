import jwt from "jsonwebtoken";
import User from "../modules/User.js";
import { ENV } from "../lib/env.js";
import { findDeviceSession } from "../lib/deviceSessions.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const bearer = socket.handshake.auth?.token || socket.handshake.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    let session = null;
    let token = bearer;
    if (bearer) {
      session = await findDeviceSession(bearer);
      if (!session) return next(new Error("Unauthorized - Invalid or expired token"));
    } else {
      // extract token from http-only cookies
      token = socket.handshake.headers.cookie
      ?.split("; ")
      .find((row) => row.startsWith("jwt="))
      ?.split("=")[1];
    }

    if (!token) {
      console.log("Socket connection rejected: No token provided");
      return next(new Error("Unauthorized - No Token Provided"));
    }

    // verify the token
    const decoded = session ? { userId: session.userId } : jwt.verify(token, ENV.JWT_SECRET);
    if (!decoded) {
      console.log("Socket connection rejected: Invalid token");
      return next(new Error("Unauthorized - Invalid Token"));
    }

    // find the user fromdb
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.log("Socket connection rejected: User not found");
      return next(new Error("User not found"));
    }
    if (user.isBanned) {
      console.log(`Socket connection rejected: ${user.fullName} is banned`);
      return next(new Error("Your account has been banned."));
    }

    // attach user info to socket
    socket.user = user;
    socket.userId = user._id.toString();
    socket.session = session;

    console.log(`Socket authenticated for user: ${user.fullName} (${user._id})`);

    next();
  } catch (error) {
    console.log("Error in socket authentication:", error.message);
    next(new Error("Unauthorized - Authentication failed"));
  }
};
