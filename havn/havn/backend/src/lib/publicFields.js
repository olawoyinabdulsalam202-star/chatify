// The only User fields that may ever be sent to another user.
//
// This is an allowlist on purpose. The old code used `.select("-password")`,
// a denylist, which stripped exactly one field and shipped everything else —
// email, otp, otpExpiry, otpAttempts, failedLoginAttempts, lockUntil,
// isBanned, banReason — to every logged-in user who hit /messages/contacts.
// Members are meant to be anonymous to each other here, so a denylist is the
// wrong shape: every field added to the schema later would leak by default.
// With an allowlist, a new field is private until someone deliberately adds it.
//
// Deliberately excluded, and why:
//   email                -> the identity users are anonymous *from*
//   otp/otpExpiry/...    -> account-takeover material
//   failedLoginAttempts  -> tells an attacker whether an account is being probed
//   lockUntil            -> same
//   isBanned/banReason   -> moderation state is nobody else's business
//   friends              -> reveals the social graph
//   settings             -> private preferences (away message, etc.)
//   isAdmin              -> don't advertise which accounts are worth attacking
export const PUBLIC_USER_FIELDS = "_id username fullName profilePic isBadged isBot isSystem lastSeenAt showLastSeen";

// Same list in the space-free form Mongoose's populate() wants for its second
// argument. Kept next to the source of truth so the two can't drift.
export const PUBLIC_USER_POPULATE = PUBLIC_USER_FIELDS;

// Applies the last-seen reciprocity rule to a user document before it's sent.
//
// "Last seen" is a feature people are genuinely sensitive about, so the privacy
// rule is deliberately strict: if YOU hide your own last-seen, you see nobody
// else's either. That's the same rule WhatsApp uses, and it's what stops the
// setting from being a one-way surveillance tool. It's applied here, at the
// server, because deciding in the component would still ship the real value in
// the JSON where anyone could read it from devtools.
// `viewer` is the full req.user document, not just an id — the reciprocity rule
// needs the viewer's own preference, not only the target's.
export function shapeLastSeen(user, viewer) {
  const u = user && typeof user.toObject === "function" ? user.toObject() : user;
  if (!u) return u;

  const viewerId = viewer?._id ?? viewer;
  const plain = { ...u };

  // My own record — keep it, my Settings page reads this.
  if (String(u._id) === String(viewerId)) return plain;

  // Hiding yours hides everyone else's from you.
  const viewerShares = viewer?.showLastSeen !== false;
  if (!viewerShares || u.showLastSeen === false) {
    plain.lastSeenAt = undefined;
  }

  // The preference itself is private — knowing someone has last-seen switched
  // off is information about them, and the client never needs it.
  plain.showLastSeen = undefined;
  return plain;
}

// Same rule, applied to a whole array of users (contacts / chat partners).
export function shapeLastSeenMany(users, viewer) {
  return users.map((u) => shapeLastSeen(u, viewer));
}

// Group rosters are anonymous to ordinary members but not to admins, who need
// real names to promote someone or hand over the group before leaving.
//
// This has to happen on the server. Hiding names in the component would still
// ship them in the JSON, so anyone could read the roster from devtools — which
// defeats the point of the app being anonymous.
//
// Everyone always sees their own real name, the bot, and system accounts;
// those aren't anonymous to anybody.
export function anonymizeGroupForViewer(group, viewerId) {
  const viewer = String(viewerId);
  const isAdmin = group.members.some(
    (m) => String(m.userId?._id || m.userId) === viewer && m.role === "admin"
  );
  if (isAdmin) return group;

  // toObject() when it's still a mongoose document, so the copy is safe to edit
  // without writing anything back to the database.
  const plain = typeof group.toObject === "function" ? group.toObject() : group;

  return {
    ...plain,
    members: plain.members.map((m) => {
      const user = m.userId;
      // Unpopulated (a bare id) — nothing to redact.
      if (!user || typeof user !== "object") return m;
      if (String(user._id) === viewer || user.isBot || user.isSystem) return m;
      return {
        ...m,
        userId: {
          _id: user._id,
          fullName: "Member",
          // The handle is an identity too, so it's redacted alongside the name.
          username: "",
          // The avatar is just as identifying as the name, so it goes too.
          profilePic: "",
          isBadged: false,
        },
      };
    }),
  };
}
