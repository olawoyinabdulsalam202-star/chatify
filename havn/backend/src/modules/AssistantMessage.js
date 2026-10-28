import mongoose from "mongoose";

const assistantMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

assistantMessageSchema.index({ userId: 1, createdAt: -1 });

const AssistantMessage = mongoose.model("AssistantMessage", assistantMessageSchema);
export default AssistantMessage;
