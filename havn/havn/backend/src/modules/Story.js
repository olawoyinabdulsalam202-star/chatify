import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Either an uploaded image, a short video, or a plain text status with a
    // background color.
    image: {
      type: String,
    },
    video: {
      type: String,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    backgroundColor: {
      type: String,
      default: "#0891b2",
    },
    viewers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// TTL index — Mongo removes the story automatically 24h after creation.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Story = mongoose.model("Story", storySchema);

export default Story;
