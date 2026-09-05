import { useState } from "react";
import { EyeIcon, EyeOffIcon, VideoIcon } from "lucide-react";

// The in-bubble stand-in for view-once media, shared by DMs and groups.
//
// Deliberately shows no thumbnail before opening — a preview would defeat the
// point. It's a label and one tap, then the media opens fullscreen with a
// countdown (see ViewOnceViewer).
//
// Presentational only: the caller supplies `onOpen` and the cached media, so
// this doesn't need to know whether it's reading useChatStore or useGroupStore.
//
// `isGroup` changes the wording rather than the behaviour, because the two
// modes genuinely differ. In a DM the media dies on the single recipient's
// first open. In a group it's once *per member*, and it's destroyed only after
// everyone has looked.
function ViewOnceBubble({ msg, isMine, cached, onOpen, onOpenMedia, isGroup = false }) {
  const [loading, setLoading] = useState(false);

  const isVideo = Boolean(msg.video || cached?.videoUrl || msg.viewOnceIsVideo);
  const noun = isVideo ? "video" : "photo";
  const Noun = isVideo ? "Video" : "Photo";

  // Groups report per-viewer state on the message; DMs use the single flag.
  const alreadyOpened = isGroup ? msg.viewOnceOpenedByMe : msg.viewOnceOpened;

  if (isMine) {
    const seenBy = msg.viewOnceViewerCount || 0;
    return (
      <div className="flex items-center gap-2 mt-2 bg-black/20 rounded-lg px-3 py-2 text-xs opacity-70">
        {isVideo ? <VideoIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        {isGroup
          ? `View-once ${noun} · ${seenBy} viewed`
          : msg.viewOnceOpened
          ? `${Noun} opened`
          : `View-once ${noun} sent`}
      </div>
    );
  }

  if (alreadyOpened && !cached) {
    return (
      <div className="flex items-center gap-2 mt-2 bg-black/20 rounded-lg px-3 py-2 text-xs opacity-70">
        <EyeOffIcon className="w-4 h-4" />
        You already viewed this {noun}
      </div>
    );
  }

  // Opened this session: re-openable from memory only, until the tab closes.
  if (cached) {
    return (
      <button
        type="button"
        onClick={() => onOpenMedia(cached)}
        className="mt-2 flex items-center gap-2 bg-black/25 hover:bg-black/35 rounded-lg px-3 py-2.5 text-sm transition-colors"
      >
        {isVideo ? <VideoIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        Tap to view again
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const media = await onOpen(msg._id);
        setLoading(false);
        if (media) onOpenMedia(media);
      }}
      className="mt-2 flex items-center gap-2 bg-black/20 hover:bg-black/30 rounded-lg px-3 py-3 text-sm transition-colors disabled:opacity-60"
    >
      {isVideo ? <VideoIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
      {loading ? "Opening…" : "Tap to view once"}
    </button>
  );
}

export default ViewOnceBubble;
