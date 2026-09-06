import mongoose from "mongoose";

// An invite to join a group/channel. Nobody is ever added to group.members
// directly anymore (except the creator) — every other member has to accept
// one of these first. Mirrors the FriendRequest pattern on purpose.
const groupInviteSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // the admin who invited them
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// One *pending* invite per (group, invitee) at a time.
//
// The partialFilterExpression is the important part. A plain unique index on
// { groupId, to } also counts accepted and declined rows, and those are never
// deleted — so declining an invite once, or being removed from a group, made
// that pair permanently unrepeatable and any re-invite died with a duplicate
// key error. Scoping uniqueness to pending rows still prevents invite spam
// while letting an admin invite someone again later.
groupInviteSchema.index(
  { groupId: 1, to: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

const GroupInvite = mongoose.model("GroupInvite", groupInviteSchema);

export default GroupInvite;
