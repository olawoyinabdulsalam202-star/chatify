import { useEffect, useRef, useState } from "react";
import { XIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon, EyeIcon, PencilIcon, CheckIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";
import { useAuthStore } from "../store/useAuthStore";
import VerifiedBadge from "./VerifiedBadge";

const DURATION_MS = 5000;
// Matches the create-story palette so editing a story shows the same warm
// swatches the author picked from.
const COLORS = ["#C2410C", "#B45309", "#166534", "#155E75", "#7C2D4A", "#292524"];

function StoryViewerModal() {
  const {
    feed,
    myStories,
    viewerIndex,
    openViewer,
    closeViewer,
    viewStory,
    deleteStory,
    getStoryViewers,
    updateStory,
  } = useStoryStore();
  const { authUser } = useAuthStore();
  const [progress, setProgress] = useState(0);
  const [viewersList, setViewersList] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  // Status videos used to be hardcoded `muted`, so they always played silently.
  // We now try with sound first and only fall back to muted if the browser
  // refuses — and when it does, the unmute button below makes that recoverable
  // instead of a silent loss.
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const videoRef = useRef(null);

  const isMine = viewerIndex?.groupIndex === "mine";
  const stories = isMine ? myStories : feed[viewerIndex?.groupIndex]?.stories || [];
  const author = isMine ? authUser : feed[viewerIndex?.groupIndex]?.user;
  const story = stories[viewerIndex?.storyIndex];

  useEffect(() => {
    if (!story) return;
    if (!isMine) viewStory(story._id);
    setViewersList(null);
    setIsEditing(false);
    setEditText(story.text || "");
    setEditColor(story.backgroundColor || COLORS[0]);

    setProgress(0);
    startRef.current = Date.now();
    clearInterval(timerRef.current);
    // Videos drive their own progress off playback time (see the <video>
    // element below) instead of the fixed 5s timer used for photos/text.
    if (!story.video) {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
        setProgress(pct);
        if (pct >= 100) goNext();
      }, 50);
    }

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id]);

  // Start video statuses with sound. Autoplay policy only guarantees playback
  // when a video is muted, so if the unmuted attempt is rejected we retry muted
  // — the story still plays, and the unmute control appears so the sound isn't
  // just quietly gone.
  useEffect(() => {
    const el = videoRef.current;
    if (!story?.video || !el) return;

    let cancelled = false;
    setIsMuted(false);
    el.muted = false;

    el.play().catch(() => {
      if (cancelled) return;
      el.muted = true;
      setIsMuted(true);
      el.play().catch(() => {});
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id, story?.video]);

  const toggleVideoSound = (e) => {
    // The tap zones sit on top of the video for next/prev, so this must not
    // bubble into them or unmuting would also skip the story.
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const next = !isMuted;
    el.muted = next;
    setIsMuted(next);
    // This click is a user gesture, so a play() that autoplay refused earlier
    // is allowed now.
    if (!next) el.play().catch(() => {});
  };

  if (!viewerIndex || !story) return null;

  const goNext = () => {
    if (viewerIndex.storyIndex < stories.length - 1) {
      openViewer(viewerIndex.groupIndex, viewerIndex.storyIndex + 1);
    } else if (!isMine && viewerIndex.groupIndex < feed.length - 1) {
      openViewer(viewerIndex.groupIndex + 1, 0);
    } else {
      closeViewer();
    }
  };

  const goPrev = () => {
    if (viewerIndex.storyIndex > 0) {
      openViewer(viewerIndex.groupIndex, viewerIndex.storyIndex - 1);
    } else if (!isMine && viewerIndex.groupIndex > 0) {
      const prevGroup = feed[viewerIndex.groupIndex - 1];
      openViewer(viewerIndex.groupIndex - 1, prevGroup.stories.length - 1);
    }
  };

  const handleShowViewers = async () => {
    clearInterval(timerRef.current);
    const viewers = await getStoryViewers(story._id);
    setViewersList(viewers);
  };

  const handleDelete = async () => {
    clearInterval(timerRef.current);
    await deleteStory(story._id);
    if (stories.length <= 1) closeViewer();
    else goNext();
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    await updateStory(story._id, { text: editText.trim(), backgroundColor: editColor });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="relative w-full max-w-sm h-full sm:h-[90vh] sm:rounded-xl overflow-hidden">
        {/* progress bars */}
        <div className="absolute top-2 left-2 right-2 z-10 flex gap-1">
          {stories.map((s, i) => (
            <div key={s._id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: `${i < viewerIndex.storyIndex ? 100 : i === viewerIndex.storyIndex ? progress : 0}%`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-6 left-3 right-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={author?.profilePic || "/avatar.svg"} alt={author?.fullName} className="size-8 rounded-full object-cover" />
            <span className="text-white text-sm font-medium flex items-center gap-1">
              {author?.fullName}
              {author?.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isMine && !story.image && !story.video && (
              <button
                onClick={() => {
                  clearInterval(timerRef.current);
                  setIsEditing(true);
                }}
                className="text-white/80 hover:text-cyan-400"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
            )}
            {isMine && (
              <button onClick={handleDelete} className="text-white/80 hover:text-red-400">
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
            <button onClick={closeViewer} className="text-white/80 hover:text-white">
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* content */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: story.image || story.video ? "black" : story.backgroundColor }}
        >
          {story.video ? (
            <video
              key={story._id}
              ref={videoRef}
              src={story.video}
              className="max-h-full max-w-full object-contain"
              playsInline
              muted={isMuted}
              onEnded={goNext}
              onTimeUpdate={(e) => {
                const { currentTime, duration } = e.target;
                if (duration) setProgress((currentTime / duration) * 100);
              }}
            />
          ) : story.image ? (
            <img src={story.image} alt="Story" className="max-h-full max-w-full object-contain" />
          ) : isEditing ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-8"
              style={{ backgroundColor: editColor }}
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={300}
                className="bg-transparent text-white text-center text-2xl font-medium w-full resize-none outline-none placeholder:text-white/60"
                rows={4}
                autoFocus
              />
              <div className="flex gap-2 mt-4">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`size-6 rounded-full ${editColor === c ? "ring-2 ring-white" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1.5 bg-white text-slate-900 rounded-full px-4 py-2 text-sm font-medium"
                >
                  <CheckIcon className="w-4 h-4" /> Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-black/30 text-white rounded-full px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-white text-2xl font-medium text-center px-8">{story.text}</p>
          )}
        </div>

        {/* Caption over photo/video stories. pointer-events-none so the tap
            zones beneath still drive next/prev, and the bottom offset lifts it
            clear of the owner's Viewers control. */}
        {(story.image || story.video) && story.text ? (
          <div
            className={`pointer-events-none absolute inset-x-0 z-10 px-4 ${
              isMine ? "bottom-16" : "bottom-6"
            }`}
          >
            <p className="mx-auto max-w-[90%] rounded-2xl bg-black/45 px-4 py-2.5 text-center text-[15px] leading-snug text-white">
              {story.text}
            </p>
          </div>
        ) : null}

        {/* tap zones */}
        {!isEditing && (
          <>
            <button onClick={goPrev} className="absolute left-0 top-0 h-full w-1/3" aria-label="Previous story" />
            <button onClick={goNext} className="absolute right-0 top-0 h-full w-1/3" aria-label="Next story" />
          </>
        )}

        {/* Sound toggle for video statuses. z-20 keeps it above the tap zones,
            which otherwise cover the whole frame and would eat the click. */}
        {story.video && (
          <button
            onClick={toggleVideoSound}
            className="absolute top-16 right-3 z-20 size-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeXIcon className="w-4 h-4" /> : <Volume2Icon className="w-4 h-4" />}
          </button>
        )}

        {isMine && (
          <div className="absolute bottom-4 left-3 right-3 z-10">
            {viewersList ? (
              <div className="bg-black/60 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-white/70 text-xs mb-2">
                  {viewersList.length} view{viewersList.length !== 1 ? "s" : ""}
                </p>
                {viewersList.map((v) => (
                  <div key={v.userId._id} className="flex items-center gap-2 py-1">
                    <img src={v.userId.profilePic || "/avatar.svg"} alt="" className="size-6 rounded-full object-cover" />
                    <span className="text-white text-sm flex items-center gap-1">
                      {v.userId.fullName}
                      {v.userId.isBadged && <VerifiedBadge className="w-3 h-3" />}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={handleShowViewers}
                className="flex items-center gap-1.5 text-white/80 text-sm bg-black/40 rounded-full px-3 py-1.5"
              >
                <EyeIcon className="w-4 h-4" /> Viewers
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StoryViewerModal;
