import { useEffect, useRef, useState } from "react";
import { PlusIcon, Trash2Icon, LoaderIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useStickerStore } from "../store/useStickerStore";

// Same cap as the message composer — stickers ride in the JSON body as base64
// until they're uploaded, and the API caps bodies at 20mb.
const MAX_STICKER_MB = 5;

// Tapping a sticker sends it immediately (WhatsApp behaviour), so onSelect gets
// the hosted URL and the picker closes. Creating one uploads first, then it
// shows up under "Yours" to send with a second tap. Embedded mode drops the
// outer box and Close bar — AttachmentPicker owns those — keeping the Recent/
// Yours sub-tabs and the Create action inline.
function StickerPicker({ onSelect, onClose, embedded = false }) {
  const { stickers, recents, isLoading, hasFetched, fetchStickers, createSticker, deleteSticker } =
    useStickerStore();
  const [tab, setTab] = useState("recent");
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!hasFetched) fetchStickers();
  }, [hasFetched, fetchStickers]);

  // If there's nothing recent yet, open straight on the tab that has content so
  // the picker never opens to an empty panel when stickers exist.
  useEffect(() => {
    if (recents.length === 0 && stickers.length > 0) setTab("yours");
  }, [recents.length, stickers.length]);

  const handleCreate = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > MAX_STICKER_MB * 1024 * 1024) {
      return toast.error(`Stickers must be under ${MAX_STICKER_MB}MB`);
    }

    setCreating(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const created = await createSticker(reader.result);
      setCreating(false);
      if (created) setTab("yours");
    };
    reader.onerror = () => {
      setCreating(false);
      toast.error("Couldn't read that image");
    };
    reader.readAsDataURL(file);
  };

  const grid = (urls, deletable) => (
    <div className="overflow-y-auto p-2 grid grid-cols-4 gap-2 content-start">
      {urls.length === 0 ? (
        <p className="text-xs text-slate-500 col-span-4 py-6 text-center">
          {tab === "recent" ? "Stickers you send show up here." : "No stickers yet. Create one."}
        </p>
      ) : (
        urls.map((item) => {
          const url = deletable ? item.url : item;
          const key = deletable ? item._id : item;
          return (
            <div key={key} className="relative group aspect-square">
              <button
                type="button"
                onClick={() => onSelect(url)}
                className="w-full h-full flex items-center justify-center rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <img src={url} alt="Sticker" className="max-w-full max-h-full object-contain" />
              </button>
              {deletable && (
                <button
                  type="button"
                  onClick={() => deleteSticker(item._id)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400"
                  aria-label="Remove sticker"
                >
                  <Trash2Icon className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const subTabs = (
    <div className="flex items-center border-b border-slate-700">
      <button
        type="button"
        onClick={() => setTab("recent")}
        className={`px-4 text-xs py-2 transition-colors ${
          tab === "recent" ? "text-cyan-400 border-b-2 border-cyan-500" : "text-slate-400"
        }`}
      >
        Recent
      </button>
      <button
        type="button"
        onClick={() => setTab("yours")}
        className={`px-4 text-xs py-2 transition-colors ${
          tab === "yours" ? "text-cyan-400 border-b-2 border-cyan-500" : "text-slate-400"
        }`}
      >
        Yours
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={creating}
        className="ml-auto mr-2 flex items-center gap-1 text-xs text-slate-300 hover:text-cyan-300 disabled:opacity-50 transition-colors"
      >
        {creating ? (
          <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <PlusIcon className="w-3.5 h-3.5" />
        )}
        {creating ? "Uploading…" : "Create"}
      </button>
    </div>
  );

  const body =
    isLoading && !hasFetched ? (
      <div className="flex items-center justify-center h-full text-slate-500">
        <LoaderIcon className="w-5 h-5 animate-spin" />
      </div>
    ) : tab === "recent" ? (
      grid(recents, false)
    ) : (
      grid(stickers, true)
    );

  const hiddenInput = (
    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleCreate} className="hidden" />
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col">
        {subTabs}
        <div className="flex-1 overflow-hidden">{body}</div>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-0 w-80 h-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 flex flex-col">
      {subTabs}

      <div className="flex-1 overflow-hidden">{body}</div>

      {hiddenInput}

      <div className="flex justify-end border-t border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 text-xs text-slate-500 hover:text-slate-300 py-2.5"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default StickerPicker;
