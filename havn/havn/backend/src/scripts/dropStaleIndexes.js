// One-off maintenance script: drops two indexes that the schema no longer
// declares.
//
// Removing `unique: true` from a Mongoose schema does NOT remove an index that
// already exists in MongoDB — Mongoose only ever creates indexes, it never drops
// them. So both of these keep enforcing rules the code has already abandoned:
//
//   groupinvites { groupId, to } unique
//     Unique across ALL invites regardless of status, and declined/accepted rows
//     are never deleted. So once someone declines a group invite (or is removed
//     from the group), inviting them again throws a duplicate-key error forever.
//     The schema now scopes uniqueness to *pending* invites only, and Mongoose
//     rebuilds it correctly on the next boot — but only once this one is gone.
//
//   users { fullName } unique
//     Made display names globally unique, so the second person to sign up as
//     "John Smith" hit E11000 and got a raw 500 with no hint why. Display names
//     aren't identities; two people are allowed to share one.
//
// Dropping an index touches no documents. Run once, then restart the backend.
//
//   node src/scripts/dropStaleIndexes.js

import mongoose from "mongoose";
import { ENV } from "../lib/env.js";

const TARGETS = [
  { collection: "groupinvites", index: "groupId_1_to_1" },
  { collection: "users", index: "fullName_1" },
];

async function run() {
  if (!ENV.MONGO_URI) {
    console.error("MONGO_URI is not set — check backend/.env");
    process.exit(1);
  }

  await mongoose.connect(ENV.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB\n");

  const db = mongoose.connection.db;

  for (const { collection, index } of TARGETS) {
    try {
      // Listing first means a renamed index shows up as a hint rather than a
      // bare "not found" — Atlas doesn't always use the default naming.
      const existing = await db.collection(collection).indexes();
      const found = existing.find((i) => i.name === index);

      if (!found) {
        console.log(`- ${collection}.${index} — not present (already dropped)`);
        const compound = existing.filter((i) => Object.keys(i.key).length > 1 && i.unique);
        if (compound.length) {
          console.log(
            `    other unique compound indexes here: ${compound.map((i) => i.name).join(", ")}`
          );
        }
        continue;
      }

      await db.collection(collection).dropIndex(index);
      console.log(`✓ ${collection}.${index} — dropped`);
    } catch (error) {
      // IndexNotFound (27) / NamespaceNotFound (26) are both fine: nothing to do.
      if (error.code === 27 || error.code === 26) {
        console.log(`- ${collection}.${index} — nothing to drop`);
      } else {
        console.error(`✗ ${collection}.${index} — ${error.message}`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("\nDone. Restart the backend so Mongoose rebuilds the corrected index.");
}

run().catch((error) => {
  console.error("Script failed:", error.message);
  process.exit(1);
});
