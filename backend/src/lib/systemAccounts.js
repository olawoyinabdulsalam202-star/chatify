import User from "../modules/User.js";
import Group from "../modules/Group.js";
import Message from "../modules/Message.js";
import { io } from "./socket.js";

let anonUserId = null;
let announcementGroupId = null;

// "Anon" — the verified identity behind welcome messages and platform
// announcements. Distinct from the Kairos AI bot: this account never
// replies to anything, it's purely a broadcast/system identity.
export const seedAnonUser = async () => {
  let anon = await User.findOne({ isSystem: true });
  if (!anon) {
    anon = await User.create({
      fullName: "Anon",
      email: "anon@internal.chatify",
      password: Math.random().toString(36).slice(2) + Date.now(),
      isVerified: true,
      isSystem: true,
      isBadged: true,
      profilePic: "",
    });
    console.log(`System account seeded: Anon (${anon._id})`);
  }
  anonUserId = anon._id;
  return anon;
};

// The one official, auto-joined, un-leavable channel used for platform-wide
// updates. Only platform admins can post in it (channels already enforce
// admin-only posting — see sendGroupMessage).
export const seedAnnouncementChannel = async () => {
  let group = await Group.findOne({ isSystemChannel: true });
  if (!group) {
    const admins = await User.find({ isAdmin: true }).select("_id");
    group = await Group.create({
      name: "Announcements",
      description: "Official updates from the Havn team.",
      type: "channel",
      isSystemChannel: true,
      createdBy: anonUserId,
      creatorIsBadged: true,
      members: [
        { userId: anonUserId, role: "admin" },
        ...admins.map((a) => ({ userId: a._id, role: "admin" })),
      ],
    });
    console.log(`Announcements channel seeded (${group._id})`);
  }
  announcementGroupId = group._id;
  return group;
};

// One-time cleanup: deletes any old "Anon" welcome DMs still sitting in the
// database from before this was removed, so the Anon chat thread disappears
// for existing users too, not just new signups going forward.
const cleanupAnonDirectMessages = async () => {
  if (!anonUserId) return;
  const { deletedCount } = await Message.deleteMany({
    $or: [{ senderId: anonUserId }, { receiverId: anonUserId }],
  });
  if (deletedCount > 0) {
    console.log(`Cleaned up ${deletedCount} old Anon welcome DM(s).`);
  }
};

export const seedSystemAccounts = async () => {
  try {
    await seedAnonUser();
    await seedAnnouncementChannel();
    await cleanupAnonDirectMessages();
  } catch (error) {
    console.log("Error seeding system accounts:", error.message);
  }
};

export const getAnonUserId = () => anonUserId;
export const getAnnouncementGroupId = () => announcementGroupId;

// Adds the user to Announcements and marks them onboarded. Safe to call for
// every login, not just signup — it's a no-op once hasReceivedWelcome is
// true, which is what lets us backfill everyone who signed up before this
// feature existed. This used to also send a 1:1 "Anon" welcome DM to every
// user, which showed up as its own chat thread; that's been removed —
// Announcements is now the only system-generated thing new users see.
export const ensureUserOnboarded = async (user) => {
  try {
    if (user.hasReceivedWelcome || user.isBot || user.isSystem) return;
    if (!announcementGroupId) return; // not seeded yet, try again next login

    const group = await Group.findById(announcementGroupId);
    if (group && !group.isMember(user._id)) {
      group.members.push({ userId: user._id, role: "member" });
      await group.save();
      io.in(`user:${user._id}`).socketsJoin(`group:${group._id}`);
    }

    await User.findByIdAndUpdate(user._id, { hasReceivedWelcome: true });
  } catch (error) {
    console.log("Error onboarding user:", error.message);
  }
};
