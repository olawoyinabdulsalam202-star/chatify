import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        // Normalize at the schema level so every path — signup, login, resend,
        // the ADMIN_EMAILS check — agrees on one canonical form. Without this,
        // "Bob@Gmail.com" and "bob@gmail.com" were two separate accounts on the
        // same mailbox, and whoever signed up with capitals could never log in
        // by typing their address in lowercase.
        lowercase: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: true,
        // NOT unique. Display names are not identities — two people are allowed
        // to both be "John Smith". This previously carried a unique index, so
        // the second person to pick any taken name got a raw E11000 surfaced as
        // a 500 with no hint that the name was the problem.
        trim: true,
    },
    // The unique @handle people use to find and add each other (WhatsApp-style).
    // This is the real identity now; `fullName` above is kept as a display mirror
    // and set equal to this on signup and on every change, so the many components
    // that already render fullName show the handle with no further changes.
    // lowercase so uniqueness is case-insensitive ("Maya" and "maya" collide);
    // sparse so the unique index tolerates accounts created before this field
    // existed, until the backfill migration gives them one.
    username: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
        match: [/^[a-z0-9_.]+$/, "Usernames can only contain letters, numbers, dots, and underscores."],
    },
    // When the handle was last set or changed — drives the 7-day change cooldown.
    // Left unset for accounts the backfill migration auto-named, so they can pick
    // a real handle immediately; set to now on signup and on every change.
    usernameChangedAt: {
        type: Date,
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: String,
    },
    otpExpiry: {
        type: Date,
    },
    otpLastSentAt: {
        type: Date,
    },
    // Brute-force protection for OTP verification: too many wrong guesses on
    // one code invalidates it, forcing a fresh one instead of letting an
    // attacker keep guessing the same 6-digit code indefinitely.
    otpAttempts: {
        type: Number,
        default: 0,
    },
    // Brute-force protection for login: after too many wrong passwords in a
    // row, the account is temporarily locked regardless of IP, so a
    // password-spraying attacker can't just rotate IPs to dodge the
    // per-IP rate limiter.
    failedLoginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
    },
    profilePic: {
        type: String,
        default: ""
    },
    // When this user's last socket disconnected. Presence itself is live (a
    // socket is either open or it isn't), but that only answers "are they here
    // now" — it can't say "and if not, how long ago". Persisting the timestamp
    // is what lets the UI show "last seen 5m ago" after the app is closed,
    // instead of a bare "Offline" that tells you nothing about whether it's
    // worth waiting for a reply.
    lastSeenAt: {
        type: Date,
    },
    // Lets a user hide their last-seen from everyone. Mirrors WhatsApp: turning
    // it off also hides *other* people's from you, so it can't be used one-way
    // to watch people while staying invisible yourself.
    showLastSeen: {
        type: Boolean,
        default: true,
    },
    // Platform role — separate from group-level roles. Admins get access to
    // the admin dashboard (search/ban/delete/badge users).
    isAdmin: {
        type: Boolean,
        default: false,
    },
    isBanned: {
        type: Boolean,
        default: false,
    },
    banReason: {
        type: String,
        default: "",
    },
    // Verified/notable badge — shown next to the name, and on groups/channels
    // this user created.
    isBadged: {
        type: Boolean,
        default: false,
    },
    // Marks the seeded AI assistant account. The bot always carries a badge
    // automatically and is excluded from normal user-facing lists (search,
    // group member pickers) except where explicitly included.
    isBot: {
        type: Boolean,
        default: false,
    },
    // Marks a seeded system account (e.g. "Anon", used for welcome messages
    // and official announcements). Also excluded from search/contact lists.
    isSystem: {
        type: Boolean,
        default: false,
    },
    // Users can only DM each other once they're friends — set once a friend
    // request has been accepted (see FriendRequest model).
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Tracks whether the one-time welcome DM + auto-join to the official
    // Announcements channel has happened yet, so both can be safely
    // backfilled for accounts created before this feature existed.
    hasReceivedWelcome: {
        type: Boolean,
        default: false,
    },
    settings: {
        theme: { type: String, default: "dark" },
        fontSize: { type: String, enum: ["small", "medium", "large"], default: "medium" },
        fontFamily: { type: String, default: "sans" },
        fontColor: { type: String, default: "" }, // "" = theme default
        awayMessage: { type: String, default: "", maxlength: 200 },
        disappearingMessages: {
            enabled: { type: Boolean, default: false },
            // duration in seconds; default 24h
            duration: { type: Number, default: 86400 },
        },
    },
}, { timestamps: true }//create At & update At
);


userSchema.pre("save", function (next) {
    if (this.isBot || this.isSystem) this.isBadged = true;
    next();
});

const User = mongoose.model("User", userSchema);

export default User;