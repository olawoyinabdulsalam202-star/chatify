import { useState } from "react";
import { SmileIcon, FilmIcon, StickerIcon, SearchIcon, XIcon } from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import GifPicker from "./GifPicker";
import StickerPicker from "./StickerPicker";

const TABS = [
  { key: "emoji", label: "Emoji", Icon: SmileIcon },
  { key: "gif", label: "GIF", Icon: FilmIcon },
  { key: "sticker", label: "Stickers", Icon: StickerIcon },
];

// One popover consolidating the three composer pickers behind a single trigger.
// A search bar at the top feeds the active tab (emoji + GIF); the tab bar sits
// at the bottom, WhatsApp-style. Each behavior is preserved via the callbacks:
// emoji appends to the text, a GIF sets the preview, a sticker sends on tap.
function AttachmentPicker({ onEmoji, onGif, onSticker, onClose }) {
  const [tab, setTab] = useState("emoji");
  const [query, setQuery] = useState("");

  const showSearch = tab === "emoji" || tab === "gif";

  return (
    <div className="absolute bottom-14 left-0 w-[calc(100vw-2rem)] max-w-sm h-96 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 flex flex-col overflow-hidden">
      {showSearch && (
        <div className="p-2 border-b border-slate-700">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "gif" ? "Search GIFs…" : "Search emoji…"}
              className="w-full bg-slate-900/60 text-sm text-slate-200 rounded pl-7 pr-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {tab === "emoji" && <EmojiPicker embedded query={query} onSelect={onEmoji} />}
        {tab === "gif" && <GifPicker embedded query={query} onSelect={onGif} />}
        {tab === "sticker" && <StickerPicker embedded onSelect={onSticker} />}
      </div>

      <div className="flex items-stretch border-t border-slate-700">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] border-t-2 transition-colors ${
              tab === key
                ? "text-cyan-400 border-cyan-500"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="px-3 border-t-2 border-transparent text-slate-500 hover:text-slate-300"
          aria-label="Close"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default AttachmentPicker;
