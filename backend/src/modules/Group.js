import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    // "group" = anyone can post. "channel" = only admins can post.
    type: {
      type: String,
      enum: ["group", "channel"],
      default: "group",
    },
    // Lets a group's admins opt the AI assistant out of their group
    // entirely, even if someone @-mentions it.
    botEnabled: {
      type: Boolean,
      default: true,
    },
    // Marks the one official, auto-joined "Announcements" channel. Members
    // can never leave/be removed from it and it can never be deleted — it's
    // how the team broadcasts platform-wide updates to everyone.
    isSystemChannel: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Snapshot of the creator's badge status at creation time — shown next
    // to the group/channel name, similar to a verified-business checkmark.
    creatorIsBadged: {
      type: Boolean,
      default: false,
    },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["admin", "member"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

groupSchema.methods.isMember = function (userId) {
  return this.members.some((m) => m.userId.equals(userId));
};

groupSchema.methods.isAdmin = function (userId) {
  return this.members.some((m) => m.userId.equals(userId) && m.role === "admin");
};

const Group = mongoose.model("Group", groupSchema);

export default Group;
