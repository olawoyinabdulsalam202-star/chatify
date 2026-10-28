import mongoose from "mongoose";

// A sticker in someone's personal collection. Two ways one lands here:
//   - "created": the owner uploaded an image and turned it into a sticker, so
//     publicId points at the Cloudinary asset we own and must destroy on delete.
//   - "saved": the owner favorited a sticker someone sent them. We only keep the
//     hosted URL — the asset belongs to whoever created it, so there's no
//     publicId and delete never touches Cloudinary.
const stickerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
    },
    kind: {
      type: String,
      enum: ["created", "saved"],
      default: "created",
    },
  },
  { timestamps: true }
);

// One row per (owner, url): saving the same sticker twice is a no-op rather than
// a duplicate in the tray.
stickerSchema.index({ ownerId: 1, url: 1 }, { unique: true });

const Sticker = mongoose.model("Sticker", stickerSchema);

export default Sticker;
