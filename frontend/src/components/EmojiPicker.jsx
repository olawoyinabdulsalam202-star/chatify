import { useState } from "react";

// Curated set grouped by category — kept lightweight (no external package/API needed).
const EMOJI_GROUPS = {
  Smileys: ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤔", "😎", "🥳", "😢", "😭", "😡", "🥺", "😴"],
  Gestures: ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "🤞", "👌", "🫶", "👋"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💔", "💯"],
  Objects: ["🔥", "🎉", "🎂", "🎁", "⭐", "✅", "❌", "⚡", "☕", "📌", "🔔", "🎶"],
};

// Hand-mapped keywords so the shared search can find an emoji by name — the
// curated set is small enough not to need an emoji-metadata package.
const EMOJI_KEYWORDS = {
  "😀": "grin happy smile",
  "😁": "beaming grin happy",
  "😂": "laugh tears joy lol funny",
  "🤣": "rofl rolling laughing funny",
  "😊": "smile blush happy",
  "😍": "love heart eyes adore",
  "😘": "kiss love",
  "😜": "wink tongue silly",
  "🤔": "think hmm consider",
  "😎": "cool sunglasses",
  "🥳": "party celebrate birthday",
  "😢": "sad cry tear",
  "😭": "sob crying loud",
  "😡": "angry mad rage",
  "🥺": "pleading puppy eyes cute",
  "😴": "sleep tired zzz",
  "👍": "thumbs up like yes good",
  "👎": "thumbs down dislike no bad",
  "👏": "clap applause bravo",
  "🙌": "raise hands praise celebrate",
  "🙏": "pray thanks please hope",
  "💪": "muscle strong flex",
  "🤝": "handshake deal agree",
  "✌️": "peace victory",
  "🤞": "fingers crossed luck hope",
  "👌": "ok perfect nice",
  "🫶": "heart hands love",
  "👋": "wave hi bye hello",
  "❤️": "red heart love",
  "🧡": "orange heart love",
  "💛": "yellow heart love",
  "💚": "green heart love",
  "💙": "blue heart love",
  "💜": "purple heart love",
  "🖤": "black heart love",
  "🤍": "white heart love",
  "💕": "hearts love",
  "💔": "broken heart heartbreak",
  "💯": "hundred perfect score",
  "🔥": "fire lit hot flame",
  "🎉": "party tada celebrate",
  "🎂": "cake birthday",
  "🎁": "gift present",
  "⭐": "star favorite",
  "✅": "check yes done tick",
  "❌": "cross no wrong x",
  "⚡": "lightning bolt fast power",
  "☕": "coffee tea drink",
  "📌": "pin location",
  "🔔": "bell notification alert",
  "🎶": "music notes song",
};

const ALL_EMOJIS = Object.values(EMOJI_GROUPS).flat();

// The scrollable emoji body, shared by the standalone popover and the embedded
// tab inside AttachmentPicker. A query filters by keyword; empty shows groups.
function EmojiGrid({ query = "", onSelect }) {
  const q = query.trim().toLowerCase();

  if (q) {
    const hits = ALL_EMOJIS.filter((emoji) => (EMOJI_KEYWORDS[emoji] || "").includes(q));
    return (
      <div className="p-2">
        {hits.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No emoji found.</p>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {hits.map((emoji, i) => (
              <button
                key={i}
                type="button"
                className="text-xl hover:bg-slate-700 rounded p-1"
                onClick={() => onSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-2 space-y-3">
      {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
        <div key={group}>
          <p className="text-xs text-slate-500 mb-1">{group}</p>
          <div className="grid grid-cols-8 gap-1">
            {emojis.map((emoji, i) => (
              <button
                key={i}
                type="button"
                className="text-xl hover:bg-slate-700 rounded p-1"
                onClick={() => onSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Embedded mode renders only the grid — AttachmentPicker supplies the outer
// panel, the shared search bar (its value arrives as `query`), and closing.
function EmojiPicker({ onSelect, onClose, embedded = false, query = "" }) {
  const [localQuery, setLocalQuery] = useState("");

  if (embedded) {
    return (
      <div className="h-full overflow-y-auto">
        <EmojiGrid query={query} onSelect={onSelect} />
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-0 w-72 max-h-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 flex flex-col">
      <div className="p-2 border-b border-slate-700">
        <input
          autoFocus
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search emoji…"
          className="w-full bg-slate-900/60 text-sm text-slate-200 rounded px-2 py-1 outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <EmojiGrid query={localQuery} onSelect={onSelect} />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-slate-500 hover:text-slate-300 p-2 border-t border-slate-700"
      >
        Close
      </button>
    </div>
  );
}

export default EmojiPicker;
