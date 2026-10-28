import { useState } from "react";
import { PlayIcon } from "lucide-react";
import { getFontStack } from "../lib/fonts";

const MAX_WIDTH = 330;
const MAX_HEIGHT = 420;

function getUrlRatio(url) {
  if (!url) return null;
  const width = url.match(/(?:^|[,/])w_(\d+)(?=[,/]|$)/)?.[1];
  const height = url.match(/(?:^|[,/])h_(\d+)(?=[,/]|$)/)?.[1];
  return width && height ? Number(width) / Number(height) : null;
}

function formatTime(createdAt) {
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageMedia({
  image,
  video,
  caption,
  fontFamily,
  captionContent,
  createdAt,
  edited,
  ticks,
  onOpen,
}) {
  const url = image || video;
  const [loadedSize, setLoadedSize] = useState({ url: null, ratio: null });
  const ratio = loadedSize.url === url ? loadedSize.ratio : getUrlRatio(url);
  const width = ratio ? Math.min(MAX_WIDTH, MAX_HEIGHT * ratio) : null;
  const isTall = ratio && ratio < MAX_WIDTH / MAX_HEIGHT;
  const mediaStyle = ratio
    ? { width: `${width}px`, maxWidth: "100%", aspectRatio: String(ratio) }
    : undefined;

  const updateRatio = (mediaWidth, mediaHeight) => {
    if (mediaWidth && mediaHeight) {
      setLoadedSize({ url, ratio: mediaWidth / mediaHeight });
    }
  };

  const metadata = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {formatTime(createdAt)}
      {edited && <span className="italic">· edited</span>}
      {ticks}
    </span>
  );

  return (
    <div className="inline-block max-w-full align-bottom">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(image ? "image" : "video", url);
        }}
        className="relative block max-w-full overflow-hidden rounded-lg"
        style={mediaStyle}
      >
        {image ? (
          <img
            src={image}
            alt="Shared"
            onLoad={(event) => updateRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
            className={`block w-full max-h-[420px] max-w-[min(330px,100%)] object-contain ${ratio ? "h-full" : "h-auto"} ${isTall ? "bg-neutral-900" : ""}`}
          />
        ) : (
          <video
            src={video}
            playsInline
            muted
            preload="metadata"
            onLoadedMetadata={(event) => updateRatio(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
            className={`pointer-events-none block w-full max-h-[420px] max-w-[min(330px,100%)] object-contain ${ratio ? "h-full" : "h-auto"} ${isTall ? "bg-neutral-900" : ""}`}
          />
        )}
        {video && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/60">
              <PlayIcon className="ml-0.5 h-6 w-6 text-white" />
            </span>
          </span>
        )}
        {!caption && !captionContent && (
          <span className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/75 to-transparent px-2 pb-1 pt-4 text-xs text-white/90">
            {metadata}
          </span>
        )}
      </button>
      {(caption || captionContent) && (
        <div className="px-2 pt-1 pb-1">
          {captionContent || (
            <p style={{ fontFamily: getFontStack(fontFamily) }} className="whitespace-pre-wrap break-words text-sm">
              {caption}
              <span className="float-right pl-2 pt-1 text-xs text-white/75">{metadata}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageMedia;
