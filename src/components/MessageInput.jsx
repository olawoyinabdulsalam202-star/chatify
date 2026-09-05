import { useRef, useState } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useStickerStore } from "../store/useStickerStore";
import toast from "react-hot-toast";
import {
  ImageIcon,
  SendIcon,
  XIcon,
  SmileIcon,
  ReplyIcon,
  MicIcon,
  EyeIcon,
} from "lucide-react";
import AttachmentPicker from "./AttachmentPicker";
import VoiceRecorder from "./VoiceRecorder";

let typingTimeout;

// Attachments are sent as base64 inside the JSON body, which inflates them by
// roughly a third, and the API caps bodies at 20mb. Keeping the raw file under
// these limits means a clear message up front instead of an opaque 413 after
// the user has waited through a long upload.
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 12;

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [gifPreview, setGifPreview] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const fileInputRef = useRef(null);

  const { sendMessage, isSoundEnabled, sendTyping, sendStopTyping, replyTarget, clearReplyTarget } =
    useChatStore();
  const pushRecent = useStickerStore((s) => s.pushRecent);

  // A sticker sends the instant it's tapped — no caption step, like WhatsApp.
  const handleSendSticker = (url) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
    sendMessage({ sticker: url });
    pushRecent(url);
    setShowPicker(false);
  };

  const hasAttachment = Boolean(imagePreview || videoPreview || gifPreview);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !hasAttachment) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    sendMessage({
      text: text.trim(),
      image: imagePreview,
      video: videoPreview,
      videoDuration,
      gif: gifPreview,
      // View-once applies to photos and videos, never to a GIF or plain text.
      viewOnce: imagePreview || videoPreview ? viewOnce : false,
    });
    setText("");
    setImagePreview("");
    setVideoPreview(null);
    setVideoDuration(null);
    setGifPreview("");
    setViewOnce(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    sendStopTyping();
    clearTimeout(typingTimeout);
  };

  const handleSendVoiceNote = ({ audio, audioDuration }) => {
    if (isSoundEnabled) playRandomKeyStrokeSound();
    sendMessage({ audio, audioDuration });
    setIsRecordingVoice(false);
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    isSoundEnabled && playRandomKeyStrokeSound();

    // Emit typing, then auto-clear after 2s of silence.
    sendTyping();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => sendStopTyping(), 2000);
  };

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
    // Cancelling the file dialog fires change with no file, and the old code
    // read file.type straight away — a TypeError that killed the handler.
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Images must be under ${MAX_IMAGE_MB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      // The three attachment kinds are mutually exclusive — one message carries
      // one piece of media.
      setVideoPreview(null);
      setVideoDuration(null);
      setGifPreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Videos must be under ${MAX_VIDEO_MB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Read the duration off a throwaway element so the view-once countdown can
    // match the clip's real length instead of a fixed guess.
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

  return (
    <div className="p-4 border-t border-slate-700/50">
      {replyTarget && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between bg-slate-800/60 border-l-4 border-cyan-500 rounded-r-lg px-3 py-2">
          <div className="flex items-start gap-2 min-w-0">
            <ReplyIcon className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-300 truncate">
              {replyTarget.isDeleted
                ? "This message was deleted"
                : replyTarget.text || (replyTarget.image ? "Photo" : "GIF")}
            </p>
          </div>
          <button type="button" onClick={clearReplyTarget} className="text-slate-500 hover:text-slate-300 shrink-0">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}
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

          {/* View-once is offered for photos and videos, but never for a GIF —
              a one-shot GIF isn't a thing users expect. */}
          {(imagePreview || videoPreview) && (
            <button
              type="button"
              onClick={() => setViewOnce((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                viewOnce
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-800/50 text-slate-400"
              }`}
              title={`Recipient can view this ${videoPreview ? "video" : "photo"} once, then it's gone`}
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
        // items-center plus a shared size-11 on every control is what keeps the
        // row aligned. Without it the buttons stretched to the flex container's
        // height while the input kept its own py-2, so nothing lined up.
        <form
          onSubmit={handleSendMessage}
          className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3 relative"
        >
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
            onChange={handleTextChange}
            className="flex-1 h-11 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 min-w-0 outline-none transition-colors focus:border-cyan-500"
            placeholder="Type your message..."
          />

          {/* One input for both image and video — the accept list covers both
              media types, and handleAttachmentChange routes each to the right
              handler by MIME type. */}
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

          {/* Single media button: a file picker with both image/* and video/*,
              so one tap offers the camera roll and the gallery at once. */}
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
              disabled={!text.trim() && !hasAttachment}
              className="shrink-0 size-11 flex items-center justify-center bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
export default MessageInput;
