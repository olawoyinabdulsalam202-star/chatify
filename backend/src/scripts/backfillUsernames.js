// One-off migration: give every existing account a unique @username.
//
// Usernames are the identity people use to find and add each other now, but
// accounts created before that feature only have a `fullName`. This walks those
// accounts and assigns each a handle derived from their name (falling back to
// the email local-part, then to "user"), de-duplicated with a numeric suffix.
//
// Two deliberate rules:
//   * For ordinary accounts, `fullName` is also set equal to the handle — it's
//     kept as a display mirror throughout the app (see the User model and the
//     signup controller), so the two must not drift.
//   * Bot/system accounts keep their pretty display name; they only gain a
//     handle so they remain addressable. Their `fullName` is left untouched.
//
// `usernameChangedAt` is left UNSET on purpose: these handles were chosen by a
// script, not the user, so the 7-day change cooldown shouldn't apply until the
// user picks one themselves.
//
// Idempotent — an account that already has a username is skipped, so it's safe
// to run more than once. Uses updateOne so the save() pre-hook and full-document
// validation on unrelated fields don't fire.
//
//   node src/scripts/backfillUsernames.js

import mongoose from "mongoose";
import { ENV } from "../lib/env.js";
import User from "../modules/User.js";

// Reduce any string to the handle-legal alphabet: lowercase a-z, 0-9, dot,
// underscore. NFKD splits accents off their base letter first, and the final
// character filter then drops those combining marks along with everything else
// that isn't allowed, so an accented name folds to plain ASCII instead of
// collapsing to nothing.
const slugify = (s) =>
  (s || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");

// Pick a base handle for a user, guaranteeing 3-30 legal characters.
const baseHandle = (user) => {
  let base = slugify(user.fullName);
  if (base.length < 3) base = slugify((user.email || "").split("@")[0]);
  if (base.length < 3) base = "user";
  base = base.slice(0, 30);
  while (base.length < 3) base += "0";
  return base;
};

// Return `base`, or the first `base<n>` variant that isn't already taken,
// trimming the base so the suffix never pushes it past 30 characters.
const uniquify = (base, taken) => {
  if (!taken.has(base)) return base;
  let n = 1;
  let candidate;
  do {
    const suffix = String(n++);
    candidate = base.slice(0, 30 - suffix.length) + suffix;
  } while (taken.has(candidate));
  return candidate;
};

async function run() {
  if (!ENV.MONGO_URI) {
    console.error("MONGO_URI is not set — check backend/.env");
    process.exit(1);
  }

  await mongoose.connect(ENV.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB\n");

  const users = await User.find({}, "_id fullName email username isBot isSystem").lean();

  // Seed the taken-set with handles that already exist so new ones can't collide
  // with them (or with each other as we go).
  const taken = new Set();
  for (const u of users) {
    if (u.username) taken.add(u.username.toLowerCase());
  }

  let assigned = 0;
  let skipped = 0;

  for (const u of users) {
    if (u.username) {
      skipped++;
      continue;
    }

    const username = uniquify(baseHandle(u), taken);
    taken.add(username);

    // Ordinary accounts mirror the handle into fullName; bot/system keep theirs.
    const update = u.isBot || u.isSystem ? { username } : { username, fullName: username };

    await User.updateOne({ _id: u._id }, { $set: update });
    assigned++;
    console.log(`assigned ${u.email || u._id} -> @${username}`);
  }

  console.log(`\nDone. Assigned ${assigned}, skipped ${skipped} (already had a handle).`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Script failed:", error.message);
  process.exit(1);
});
