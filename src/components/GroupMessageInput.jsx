import { useRef, useState } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { useStickerStore } from "../store/useStickerStore";
import toast from "react-hot-toast";
import {
  ImageIcon,
  SendIcon,
  XIcon,
  SmileIcon,
  MicIcon,
  EyeIcon,
} from "lucide-react";
import AttachmentPicker from "./AttachmentPicker";
import VoiceRecorder from "./VoiceRecorder";

// Attachments travel as base64 in the JSON body (~33% larger than the file) and
// the API caps bodies at 20mb. Checking here gives a clear message instead of an
// opaque 413 after a long upload.
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 12;

function GroupMessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const { isSoundEnabled } = useChatStore();
  const { selectedGroup, sendGroupMessage } = useGroupStore();
  const { authUser } = useAuthStore();

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [gifPreview, setGifPreview] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef(null);
  const pushRecent = useStickerStore((s) => s.pushRecent);

  // A sticker sends the instant it's tapped — no caption step, like WhatsApp.
  const handleSendSticker = (url) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
    sendGroupMessage({ sticker: url });
    pushRecent(url);
    setShowPicker(false);
  };

  const myMembership = selectedGroup.members.find(
    (m) => (m.userId._id || m.userId) === authUser._id
  );
  const canPost = selectedGroup.type !== "channel" || myMembership?.role === "admin";
  const hasAttachment = Boolean(imagePreview || videoPreview || gifPreview);

  // One picker feeds both handlers — the accept list admits image and video,
  // and the MIME type decides which one runs.
  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) handleImageChange(e);
    else if (file.type.startsWith("video/")) handleVideoChange(e);
    else toast.error("Please select an image or video file");
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image file");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Images must be under ${MAX_IMAGE_MB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setVideoPreview(null);
      setVideoDuration(null);
      setGifPreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error("Please select a video file");
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Videos must be under ${MAX_VIDEO_MB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Read the real duration so a view-once countdown matches the clip length.
    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      setVideoDuration(Number.isFinite(probe.duration) ? Math.ceil(probe.duration) : null);
      URL.revokeObjectURL(objectUrl);
    };
    probe.onerror = () => URL.revokeObjectURL(objectUrl);
    probe.src = objectUrl;

    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoPreview(reader.result);
      setImagePreview(null);
      setGifPreview(null);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setViewOnce(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeVideo = () => {
    setVideoPreview(null);
    setVideoDuration(null);
    setViewOnce(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() && !hasAttachment) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    sendGroupMessage({
      text: text.trim(),
      image: imagePreview,
      video: videoPreview,
      videoDuration,
      gif: gifPreview,
      viewOnce: imagePreview || videoPreview ? viewOnce : false,
    });

    setText("");
    setImagePreview(null);
    setVideoPreview(null);
    setVideoDuration(null);
    setGifPreview(null);
    setViewOnce(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendVoiceNote = ({ audio, audioDuration }) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
    sendGroupMessage({ audio, audioDuration });
    setIsRecordingVoice(false);
  };

  if (!canPost) {
    return (
      <div className="p-4 border-t border-slate-700/50 text-center text-sm text-slate-500">
        Only admins can post in this channel.
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-slate-700/50">
      {hasAttachment && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-3">
          <div className="relative shrink-0">
            {videoPreview ? (
              <video
                src={videoPreview}
                muted
                playsInline
                preload="metadata"
                className="w-20 h-20 object-cover rounded-lg border border-slate-700 bg-black"
              />
            ) : (
              <img
                src={imagePreview || gifPreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-slate-700"
              />
            )}
            {viewOnce && (imagePreview || videoPreview) && (
              <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
                <EyeIcon className="w-6 h-6 text-cyan-300" />
              </div>
            )}
            <button
              onClick={() => {
                removeImage();
                removeVideo();
                setGifPreview(null);
              }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
              aria-label="Remove attachment"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* In a group, view-once means once *per member* — the media is only
              destroyed after everyone has looked. */}
          {(imagePreview || videoPreview) && (
            <button
              type="button"
              onClick={() => setViewOnce((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                viewOnce
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-800/50 text-slate-400"
              }`}
              title="Each member can view this once, then it's gone"
            >
              <EyeIcon className="w-3.5 h-3.5" />
              View once
            </button>
          )}
        </div>
      )}

      {isRecordingVoice ? (
        <div className="max-w-3xl mx-auto flex">
          <VoiceRecorder onSend={handleSendVoiceNote} onCancel={() => setIsRecordingVoice(false)} />
        </div>
      ) : (
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3 relative">
          {showPicker && (
            <AttachmentPicker
              onEmoji={(emoji) => setText((t) => t + emoji)}
              onGif={(url) => {
                setGifPreview(url);
                setImagePreview(null);
                setShowPicker(false);
              }}
              onSticker={handleSendSticker}
              onClose={() => setShowPicker(false)}
            />
          )}

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 h-11 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 min-w-0 outline-none transition-colors focus:border-cyan-500"
            placeholder={
              selectedGroup.type === "channel" ? "Post to channel…" : "Type your message…"
            }
          />

          {/* One picker for both media types; the MIME type decides the handler. */}
          <input
            type="file"
            accept="image/*,video/*"
            ref={fileInputRef}
            onChange={handleAttachmentChange}
            className="hidden"
          />

          {/* One trigger for emoji, GIFs and stickers — the combined picker
              handles the three tabs. Visible on mobile too. */}
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className={`shrink-0 size-11 flex items-center justify-center bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg transition-colors ${
              showPicker ? "text-cyan-400" : ""
            }`}
            aria-label="Emoji, GIFs and stickers"
          >
            <SmileIcon className="w-5 h-5" />
          </button>

          {/* Single media button — the picker accepts image and video together. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`shrink-0 size-11 flex items-center justify-center bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg transition-colors ${
              imagePreview || videoPreview ? "text-cyan-400" : ""
            }`}
            aria-label="Attach a photo or video"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {text.trim() || hasAttachment ? (
            <button
              type="submit"
              className="shrink-0 size-11 flex items-center justify-center bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              aria-label="Send"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="shrink-0 size-11 flex items-center justify-center bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              title="Record a voice note"
              aria-label="Record a voice note"
            >
              <MicIcon className="w-5 h-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}

export default GroupMessageInput;
