import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../modules/User.js";
import { ENV } from "../lib/env.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token) return res.status(401).json({ message: "Unauthorized - No token provided" });

    // jwt.verify THROWS on an expired/tampered/malformed token — it doesn't
    // return null. That throw used to fall through to the generic catch below
    // and come back as a 500, so once a token passed its 7-day expiry every
    // request looked like a server outage instead of "please log in again",
    // and the frontend (which redirects on 401) never sent anyone to login.
    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized - Invalid or expired token" });
    }

    // A token whose payload isn't a usable id can't be looked up; treat it as
    // unauthorized rather than letting findById throw a CastError into the 500.
    if (!decoded?.userId || !mongoose.isValidObjectId(decoded.userId)) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ message: "Unauthorized - User not found" });
    if (user.isBanned) {
      return res.status(403).json({ message: "Your account has been banned." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Use after protectRoute. Restricts a route to platform admins only.
export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};