import { sendWelcomeEmail, sendOTPEmail } from "../emails/emailHandlers.js";
import { generateToken, clearAuthCookie, AUTH_COOKIE_NAME } from "../lib/utils.js";
import User from "../modules/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import { ensureUserOnboarded } from "../lib/systemAccounts.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between resends

// Handle rules: 3–30 chars, lowercase letters/digits/dot/underscore. The model
// enforces the same shape; validating here lets the controller answer with a
// friendly message before a save reaches Mongo. Input is lowercased first, so
// someone typing "GhostCode" gets "ghostcode" rather than a rejection.
const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;
// A handle can only be changed once every 7 days, measured from the last set.
const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Belt-and-suspenders on top of the mongo-sanitize middleware: reject
// anything that isn't a plain string before it ever reaches a Mongo query,
// so a body like { "email": { "$gt": "" } } can never be used to bend a
// findOne({ email }) lookup.
const isPlainString = (v) => typeof v === "string";

export const signup = async (req, res) => {
  const { username: rawUsername, email, password } = req.body;

  try {
    if (!rawUsername || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!isPlainString(rawUsername) || !isPlainString(email) || !isPlainString(password)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const username = rawUsername.trim().toLowerCase();
    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        message: "Username must be 3–30 characters: lowercase letters, numbers, dots, and underscores.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // check if emailis valid: regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Email already exists" });

    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(409).json({ message: "That username is taken" });

    // 123456 => $dnjasdkasj_?dmsakmk
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const newUser = new User({
      username,
      // fullName mirrors the handle: it's the display field the rest of the app
      // already reads, so keeping the two equal means every name display shows
      // the username without any of those components having to change.
      fullName: username,
      email,
      password: hashedPassword,
      usernameChangedAt: new Date(),
      isVerified: false,
      otp: hashedOtp,
      otpExpiry: new Date(Date.now() + OTP_EXPIRY_MS),
      otpLastSentAt: new Date(),
      isAdmin: ENV.ADMIN_EMAILS.includes(email.toLowerCase()),
    });

    if (newUser) {
      let savedUser;
      try {
        savedUser = await newUser.save();
      } catch (err) {
        // A racing signup can slip between the findOne checks and this save;
        // the unique index is the real guard, so map its error to a clear 409
        // instead of the raw E11000 that used to surface as a bare 500.
        if (err?.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0];
          return res
            .status(409)
            .json({ message: field === "username" ? "That username is taken" : "Email already exists" });
        }
        throw err;
      }

      // No token/cookie yet — account isn't usable until the OTP is verified.
      res.status(201).json({
        message: "Account created. Check your email for a verification code.",
        email: savedUser.email,
      });

      try {
        await sendOTPEmail(savedUser.email, savedUser.fullName, otp);
      } catch (error) {
        console.error("Failed to send OTP email:", error);
      }
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and code are required" });
    }
    if (!isPlainString(email) || !isPlainString(otp)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified" });

    if (!user.otp || !user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    }

    const isOtpCorrect = await bcrypt.compare(otp, user.otp);
    if (!isOtpCorrect) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
        // Too many wrong guesses — kill this code so it can't keep being
        // brute-forced; the user has to request a fresh one.
        user.otp = undefined;
        user.otpExpiry = undefined;
        user.otpAttempts = 0;
        await user.save();
        return res.status(400).json({ message: "Too many incorrect attempts. Please request a new code." });
      }
      await user.save();
      return res.status(400).json({ message: "Incorrect code" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    await user.save();

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });

    try {
      await sendWelcomeEmail(user.email, user.fullName, ENV.CLIENT_URL);
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }

    ensureUserOnboarded(user).catch((err) => console.log("Onboarding error:", err.message));
  } catch (error) {
    console.log("Error in verifyOTP controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!isPlainString(email)) return res.status(400).json({ message: "Invalid input" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified" });

    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: "Please wait a bit before requesting another code" });
    }

    const otp = generateOTP();
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    user.otpLastSentAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    await sendOTPEmail(user.email, user.fullName, otp);

    res.status(200).json({ message: "A new code has been sent to your email" });
  } catch (error) {
    console.log("Error in resendOTP controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  if (!isPlainString(email) || !isPlainString(password)) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    // never tell the client which one is incorrect: password or email

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Correct password — clear any prior failed-attempt tracking.
    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        needsVerification: true,
        email: user.email,
      });
    }
    if (user.isBanned) {
      return res.status(403).json({
        message: user.banReason
          ? `Your account has been banned: ${user.banReason}`
          : "Your account has been banned.",
      });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      isAdmin: user.isAdmin,
      isBadged: user.isBadged,
      // Needed so the Settings toggle renders in the right position on first
      // load rather than defaulting on and flipping once /auth/check lands.
      showLastSeen: user.showLastSeen,
      settings: user.settings,
    });

    // No-ops instantly for anyone who already has it — this is what
    // backfills the welcome DM + Announcements channel for accounts that
    // existed before this feature shipped.
    ensureUserOnboarded(user).catch((err) => console.log("Onboarding error:", err.message));
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  clearAuthCookie(res);

  // Stamp last-seen right away on a deliberate logout.
  //
  // Otherwise the only thing that records it is the socket's 45-second grace
  // timer, so for those 45 seconds someone who has explicitly left still reads
  // as "Online" to everyone else. Logging out is an unambiguous "I'm gone",
  // unlike a backgrounded tab that the grace window exists to forgive.
  //
  // Best-effort and never fatal: this route isn't behind protectRoute (logging
  // out has to work even with a dead token), so the user is identified from the
  // cookie directly and any failure is swallowed.
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (token) {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      if (decoded?.userId) {
        await User.updateOne({ _id: decoded.userId }, { $set: { lastSeenAt: new Date() } });
      }
    }
  } catch {
    // Expired or tampered token — nothing to stamp, and logout still succeeds.
  }

  res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) return res.status(400).json({ message: "Profile pic is required" });

    const userId = req.user._id;

    const uploadResponse = await cloudinary.uploader.upload(profilePic);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    ).select("-password -otp -otpExpiry -otpAttempts -failedLoginAttempts -lockUntil");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUsername = async (req, res) => {
  try {
    const { username: rawUsername } = req.body;
    if (!isPlainString(rawUsername)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const username = rawUsername.trim().toLowerCase();
    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        message: "Username must be 3–30 characters: lowercase letters, numbers, dots, and underscores.",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Account not found" });

    if (user.username === username) {
      return res.status(400).json({ message: "That's already your username" });
    }

    // 7-day cooldown. An unset changedAt means the backfill migration
    // auto-assigned this handle and the user has never chosen one, so let them
    // through — the cooldown only ever locks a handle the user picked themselves.
    if (user.usernameChangedAt) {
      const elapsed = Date.now() - user.usernameChangedAt.getTime();
      if (elapsed < USERNAME_CHANGE_COOLDOWN_MS) {
        const daysLeft = Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
        return res.status(429).json({
          message: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        });
      }
    }

    const taken = await User.findOne({ username });
    if (taken) return res.status(409).json({ message: "That username is taken" });

    user.username = username;
    // Keep the display mirror in step with the handle (see the User model).
    user.fullName = username;
    user.usernameChangedAt = new Date();

    try {
      await user.save();
    } catch (err) {
      // The unique index is the real guard against a racing claim on the handle.
      if (err?.code === 11000) return res.status(409).json({ message: "That username is taken" });
      throw err;
    }

    const safeUser = await User.findById(user._id).select(
      "-password -otp -otpExpiry -otpAttempts -failedLoginAttempts -lockUntil"
    );
    res.status(200).json(safeUser);
  } catch (error) {
    console.log("Error in updateUsername controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { theme, fontSize, fontFamily, fontColor, awayMessage, disappearingMessages, showLastSeen } =
      req.body;

    // The client already restricts these to its own catalogues, and it falls
    // back to a default for anything it doesn't recognise on the way out. These
    // checks are the server-side half of that: they stop a hand-crafted request
    // from parking unbounded junk on the user document. Values are stored as
    // opaque keys, never interpolated into markup or CSS by the server.
    const update = {};
    if (typeof theme === "string" && theme.length <= 32) update["settings.theme"] = theme;
    if (fontSize !== undefined) update["settings.fontSize"] = fontSize;
    if (typeof fontFamily === "string" && fontFamily.length <= 64) {
      update["settings.fontFamily"] = fontFamily;
    }
    // Either empty (use the theme default) or a #rgb/#rrggbb hex colour.
    if (typeof fontColor === "string" && /^(|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/.test(fontColor)) {
      update["settings.fontColor"] = fontColor;
    }
    if (typeof awayMessage === "string") update["settings.awayMessage"] = awayMessage.slice(0, 200);
    // Top-level, not under settings.* — the socket layer and the contact
    // queries both read it, and nesting it would mean loading a subdocument
    // just to answer "may this person's last-seen be shown".
    if (typeof showLastSeen === "boolean") update.showLastSeen = showLastSeen;
    if (disappearingMessages?.enabled !== undefined) {
      update["settings.disappearingMessages.enabled"] = Boolean(disappearingMessages.enabled);
    }
    if (disappearingMessages?.duration !== undefined) {
      const duration = Number(disappearingMessages.duration);
      // Between a minute and a year — anything outside that is a malformed
      // client, and a nonsense TTL would make messages vanish instantly or never.
      if (Number.isFinite(duration) && duration >= 60 && duration <= 31536000) {
        update["settings.disappearingMessages.duration"] = duration;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select(
      "-password -otp -otpExpiry -otpAttempts -failedLoginAttempts -lockUntil"
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updateSettings controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};