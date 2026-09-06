import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// One pending/accepted request between any two people at a time, in either
// direction-agnostic sense is handled in the controller (we check both
// orderings before creating), but this stops the exact same (from,to) pair
// from ever having two rows.
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;
