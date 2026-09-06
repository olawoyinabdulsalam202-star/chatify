import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Present for 1:1 DMs. Omitted for group messages (groupId is used instead).
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return !this.groupId;
      },
    },
    // Present for group/channel messages. Omitted for 1:1 DMs.
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
    },
    video: {
      type: String,
    },
    // Length of a video message in seconds, used to size the view-once
    // countdown so it matches how long the clip actually runs.
    videoDuration: {
      type: Number,
    },
    gif: {
      type: String,
    },
    // Like gif: an already-hosted URL (uploaded when the sticker was created),
    // so a sticker message carries no upload at send time.
    sticker: {
      type: String,
    },
    audio: {
      type: String,
    },
    audioDuration: {
      type: Number, // seconds
    },
    // View-once media: the URL is stripped from the document the moment the
    // recipient opens it, so it can never be re-fetched from the API or DB.
    // Applies to both photos and videos.
    viewOnce: {
      type: Boolean,
      default: false,
    },
    viewOnceOpened: {
      type: Boolean,
      default: false,
    },
    viewOnceOpenedAt: {
      type: Date,
    },
    // Whether the (now-stripped) view-once media was a video. The URL fields are
    // redacted before a view-once message ever reaches a client, so without this
    // the UI can't tell a photo from a video and would mislabel the bubble.
    viewOnceIsVideo: {
      type: Boolean,
      default: false,
    },
    // Group view-once needs per-member tracking rather than the single boolean
    // above. In a DM there's one recipient, so the first open can strip the URL
    // outright. In a group, "view once" means once *each* — stripping on the
    // first open would rob everyone else of a message they never saw.
    //
    // So each opener is recorded here, the API refuses a second open from the
    // same person, and the media is only destroyed once every eligible member
    // has viewed it (see openViewOnce).
    viewOnceViewers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        openedAt: { type: Date, default: Date.now },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    seenAt: {
      type: Date,
    },
    // Disappearing messages: if set, MongoDB automatically deletes the
    // document once this time passes (TTL index below).
    expiresAt: {
      type: Date,
    },
    // Reply — denormalized snapshot so the quote still shows even if the
    // original message later gets edited or deleted.
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: { type: String },
    },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// TTL index: MongoDB deletes a message automatically once expiresAt passes.
// Messages without expiresAt (the default) are never touched by this.
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model("Message", messageSchema);

export default Message;