import mongoose from "mongoose";
import { ENV } from "../lib/env.js";
import User from "../modules/User.js";

async function run() {
  await mongoose.connect(ENV.MONGO_URI);
  const users = await User.find({ friends: { $exists: true, $ne: [] } }).select("_id friends").lean();
  let added = 0;
  for (const user of users) {
    for (const friendId of user.friends || []) {
      const result = await User.updateOne({ _id: friendId }, { $addToSet: { friends: user._id } });
      added += result.modifiedCount;
    }
  }
  console.log(`Friendship migration complete. Added ${added} reciprocal links.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Friendship migration failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
