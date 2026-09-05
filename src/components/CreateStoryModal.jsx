import { useRef, useState } from "react";
import { XIcon, ImageIcon, TypeIcon, VideoIcon } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";

const COLORS = ["#C2410C", "#B45309", "#166534", "#155E75", "#7C2D4A", "#292524"];
const MAX_VIDEO_MB = 15;

function CreateStoryModal({ onClose }) {
  const { createStory } = useStoryStore();
  const [mode, setMode] = useState("text"); // "text" | "image" | "video"
  const [text, setText] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(COLORS[0]);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`Please pick a video under ${MAX_VIDEO_MB}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setVideoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (mode === "text" && !text.trim()) return;
    if (mode === "image" && !imagePreview) return;
    if (mode === "video" && !videoPreview) return;

    setIsPosting(true);
    const payload =
      mode === "text"
        ? { text: text.trim(), backgroundColor }
        : mode === "image"
        ? { image: imagePreview, text: caption.trim() || undefined }
        : { video: videoPreview, text: caption.trim() || undefined };
    const result = await createStory(payload);
    setIsPosting(false);
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-slate-200 font-medium">Create story</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setMode("text")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm ${
              mode === "text" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400"
            }`}
          >
            <TypeIcon className="w-4 h-4" /> Text
          </button>
          <button
            onClick={() => setMode("image")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm ${
              mode === "image" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400"
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Photo
          </button>
          <button
            onClick={() => setMode("video")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm ${
              mode === "video" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-400"
            }`}
          >
            <VideoIcon className="w-4 h-4" /> Video
          </button>
        </div>

        <div className="p-4">
          {mode === "text" ? (
            <>
              <div
                className="aspect-[9/12] rounded-lg flex items-center justify-center p-6 mb-3"
                style={{ backgroundColor }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  placeholder="Type a status…"
                  className="bg-transparent text-white text-center text-lg font-medium w-full resize-none outline-none placeholder:text-white/60"
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-center">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBackgroundColor(c)}
                    className={`size-6 rounded-full ${backgroundColor === c ? "ring-2 ring-white" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </>
          ) : mode === "image" ? (
            <div>
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full aspect-[9/12] object-cover rounded-lg mb-3" />
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[9/12] rounded-lg border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-2 text-slate-400 mb-3"
                >
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm">Choose a photo</span>
                </button>
              )}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
              />
              {imagePreview && (
                <button onClick={() => fileInputRef.current?.click()} className="text-cyan-400 text-sm">
                  Change photo
                </button>
              )}
            </div>
          ) : (
            <div>
              {videoPreview ? (
                <video
                  src={videoPreview}
                  className="w-full aspect-[9/12] object-cover rounded-lg mb-3 bg-black"
                  controls
                  muted
                />
              ) : (
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full aspect-[9/12] rounded-lg border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-2 text-slate-400 mb-3"
                >
                  <VideoIcon className="w-8 h-8" />
                  <span className="text-sm">Choose a video</span>
                  <span className="text-xs text-slate-500">Up to {MAX_VIDEO_MB}MB</span>
                </button>
              )}
              <input
                type="file"
                accept="video/*"
                ref={videoInputRef}
                onChange={handleVideoChange}
                className="hidden"
              />
              {videoPreview && (
                <button onClick={() => videoInputRef.current?.click()} className="text-cyan-400 text-sm">
                  Change video
                </button>
              )}
            </div>
          )}

          {((mode === "image" && imagePreview) || (mode === "video" && videoPreview)) && (
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={300}
              placeholder="Add a caption…"
              className="w-full mt-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500"
            />
          )}

          <button
            onClick={handlePost}
            disabled={
              isPosting ||
              (mode === "text" ? !text.trim() : mode === "image" ? !imagePreview : !videoPreview)
            }
            className="w-full mt-3 bg-cyan-500 hover:bg-cyan-600 transition-colors text-white rounded-lg py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPosting ? "Posting…" : "Post story"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateStoryModal;
