import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon, TrashIcon, EyeIcon, PencilIcon, CheckIcon, Volume2Icon, VolumeXIcon, HeartIcon, PauseIcon, PlayIcon, LoaderCircleIcon, SendIcon, RotateCwIcon } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";
import { useAuthStore } from "../store/useAuthStore";
import VerifiedBadge from "./VerifiedBadge";
import toast from "react-hot-toast";

const DURATION_MS = 5000;
const COLORS = ["#C2410C", "#B45309", "#166534", "#155E75", "#7C2D4A", "#292524"];

const cloudinaryTransform = (url, transform) => url?.includes("/upload/")
  ? url.replace("/upload/", `/upload/${transform}/`)
  : url;

const getVideoPoster = (url) => cloudinaryTransform(url, "so_0,f_jpg,q_auto");

function StoryViewerModal() {
  const {
    feed, myStories, viewerIndex, openViewer, closeViewer, viewStory, deleteStory,
    getStoryViewers, updateStory, toggleStoryLike, sendStoryReply,
  } = useStoryStore();
  const { authUser } = useAuthStore();
  const [progress, setProgress] = useState(0);
  const [viewersList, setViewersList] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isMediaWaiting, setIsMediaWaiting] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaRetry, setMediaRetry] = useState(0);
  const [isFullImageLoaded, setIsFullImageLoaded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(document.visibilityState !== "visible");
  const progressFrameRef = useRef(null);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef(0);
  const holdTimerRef = useRef(null);
  const holdStartedRef = useRef(false);
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const replyInputRef = useRef(null);

  const isMine = viewerIndex?.groupIndex === "mine";
  const stories = isMine ? myStories : feed[viewerIndex?.groupIndex]?.stories || [];
  const author = isMine ? authUser : feed[viewerIndex?.groupIndex]?.user;
  const story = stories[viewerIndex?.storyIndex];
  const storyLikeIds = (story?.likes || []).map((like) => String(like.userId?._id || like.userId));
  const totalStoryLikes = new Set(storyLikeIds).size;
  const totalStoryViews = new Set((story?.viewers || []).map((viewer) => String(viewer.userId?._id || viewer.userId))).size;

  const goNext = useCallback(() => {
    const current = useStoryStore.getState().viewerIndex;
    if (!current) return;
    const mine = current.groupIndex === "mine";
    const currentStories = mine ? useStoryStore.getState().myStories : useStoryStore.getState().feed[current.groupIndex]?.stories || [];
    const currentFeed = useStoryStore.getState().feed;
    if (current.storyIndex < currentStories.length - 1) openViewer(current.groupIndex, current.storyIndex + 1);
    else if (!mine && current.groupIndex < currentFeed.length - 1) openViewer(current.groupIndex + 1, 0);
    else closeViewer();
  }, [openViewer, closeViewer]);

  const goPrev = useCallback(() => {
    const current = useStoryStore.getState().viewerIndex;
    if (!current) return;
    if (current.storyIndex > 0) openViewer(current.groupIndex, current.storyIndex - 1);
    else if (current.groupIndex !== "mine" && current.groupIndex > 0) {
      const previous = useStoryStore.getState().feed[current.groupIndex - 1];
      openViewer(current.groupIndex - 1, previous.stories.length - 1);
    }
  }, [openViewer]);

  const setMediaReady = () => {
    setIsMediaReady(true);
    setIsMediaWaiting(false);
    setMediaFailed(false);
    elapsedRef.current = 0;
    lastFrameRef.current = 0;
    setProgress(0);
  };

  const handleMediaError = () => {
    setMediaFailed(true);
    setIsMediaReady(true);
    setIsMediaWaiting(false);
    elapsedRef.current = 0;
    lastFrameRef.current = 0;
  };

  useEffect(() => {
    if (!story) return;
    if (!isMine) viewStory(story._id);
    setViewersList(null);
    setIsEditing(false);
    setEditText(story.text || "");
    setEditColor(story.backgroundColor || COLORS[0]);
    setReplyText("");
    setReplySent(false);
    setIsReplyFocused(false);
    setIsManuallyPaused(false);
    setIsHeld(false);
    setMediaFailed(false);
    setIsFullImageLoaded(false);
    setIsMediaReady(!story.image && !story.video);
    setIsMediaWaiting(false);
    setProgress(0);
    elapsedRef.current = 0;
    lastFrameRef.current = 0;
    const ids = (story.likes || []).map((like) => String(like.userId?._id || like.userId));
    setIsLiked(ids.includes(String(authUser?._id)));
    setLikeCount(new Set(ids).size);
  }, [story?._id]);

  useEffect(() => {
    const updateVisibility = () => setDocumentHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const isPaused = isManuallyPaused || isHeld || Boolean(viewersList) || isReplyFocused || documentHidden ||
    isEditing || !isMediaReady || isMediaWaiting;

  useEffect(() => {
    if (!story || story.video || isPaused) {
      cancelAnimationFrame(progressFrameRef.current);
      lastFrameRef.current = 0;
      if (story?.video) videoRef.current?.pause();
      return undefined;
    }
    const animate = (time) => {
      if (lastFrameRef.current) elapsedRef.current += time - lastFrameRef.current;
      lastFrameRef.current = time;
      const nextProgress = Math.min(100, (elapsedRef.current / DURATION_MS) * 100);
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        goNext();
        return;
      }
      progressFrameRef.current = requestAnimationFrame(animate);
    };
    progressFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(progressFrameRef.current);
  }, [story?._id, story?.video, isPaused, goNext]);

  useEffect(() => {
    const el = videoRef.current;
    if (!story?.video || !el || !isMediaReady || isPaused) return;
    el.play().catch(() => {
      el.muted = true;
      setIsMuted(true);
      el.play().catch(() => {});
    });
  }, [story?._id, story?.video, isMediaReady, isPaused, mediaRetry]);

  useEffect(() => {
    const nextStory = stories[viewerIndex?.storyIndex + 1] ||
      (!isMine ? feed[viewerIndex?.groupIndex + 1]?.stories?.[0] : null);
    if (!nextStory) return;
    const preload = new Image();
    preload.src = nextStory.image || (nextStory.video ? getVideoPoster(nextStory.video) : "");
  }, [story?._id, stories, viewerIndex?.storyIndex, viewerIndex?.groupIndex, feed, isMine]);

  useEffect(() => {
    if (!viewerIndex) return undefined;
    const onKeyDown = (event) => {
      if (event.code !== "Space" || event.target.matches("input, textarea, button")) return;
      event.preventDefault();
      setIsManuallyPaused((paused) => !paused);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex]);

  useEffect(() => () => {
    clearTimeout(holdTimerRef.current);
    cancelAnimationFrame(progressFrameRef.current);
  }, []);

  if (!viewerIndex || !story) return null;

  const handlePointerDown = (event) => {
    if (event.target.closest("button, input, textarea")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdStartedRef.current = false;
    if (event.pointerType === "touch") {
      holdTimerRef.current = setTimeout(() => {
        holdStartedRef.current = true;
        setIsHeld(true);
      }, 200);
    }
  };

  const handlePointerUp = (event) => {
    clearTimeout(holdTimerRef.current);
    if (holdStartedRef.current) {
      holdStartedRef.current = false;
      setIsHeld(false);
      return;
    }
    if (event.target.closest("button, input, textarea")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left + bounds.width / 3) goPrev();
    else goNext();
  };

  const handlePointerCancel = () => {
    clearTimeout(holdTimerRef.current);
    holdStartedRef.current = false;
    setIsHeld(false);
  };

  const retryMedia = () => {
    setMediaFailed(false);
    setIsMediaWaiting(false);
    setIsMediaReady(false);
    setIsFullImageLoaded(false);
    setMediaRetry((retry) => retry + 1);
  };

  const handleShowViewers = async () => {
    const result = await getStoryViewers(story._id);
    setViewersList(result);
  };

  const handleDelete = async () => {
    await deleteStory(story._id);
    if (stories.length <= 1) closeViewer();
    else goNext();
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    await updateStory(story._id, { text: editText.trim(), backgroundColor: editColor });
    setIsEditing(false);
  };

  const handleLike = async () => {
    if (isLiking) return;
    const previousLiked = isLiked;
    const previousCount = likeCount;
    setIsLiked(!previousLiked);
    setLikeCount(Math.max(0, previousCount + (previousLiked ? -1 : 1)));
    setIsLiking(true);
    try {
      const result = await toggleStoryLike(story._id);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (error) {
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      toast.error(error.message || "Couldn't update your like.");
    } finally {
      setIsLiking(false);
    }
  };

  const handleSendReply = async (event) => {
    event.preventDefault();
    const text = replyText.trim();
    if (!text || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const thumbnail = story.image || (story.video ? getVideoPoster(story.video) : "");
      await sendStoryReply(author._id, { storyId: story._id, thumbnail, text: story.text || "" }, text);
      setReplyText("");
      setIsReplyFocused(false);
      replyInputRef.current?.blur();
      setReplySent(true);
      setTimeout(() => setReplySent(false), 1600);
    } catch {
      setIsReplyFocused(true);
    } finally {
      setIsSendingReply(false);
    }
  };

  const viewerRows = viewersList?.viewers || [];
  const blurredImage = story.image ? cloudinaryTransform(story.image, "w_40,e_blur:800,q_30") : "";

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onContextMenu={(event) => event.preventDefault()}>
      <div
        className="relative w-full max-w-sm h-full sm:h-[90vh] sm:rounded-xl overflow-hidden select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {!isHeld && <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
          {stories.map((item, index) => (
            <div key={item._id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${index < viewerIndex.storyIndex ? 100 : index === viewerIndex.storyIndex ? progress : 0}%` }} />
            </div>
          ))}
        </div>}

        {!isHeld && <div className="absolute top-6 left-3 right-3 z-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={author?.profilePic || "/avatar.svg"} alt={author?.fullName || ""} draggable={false} className="size-8 rounded-full object-cover shrink-0" />
            <span className="text-white text-sm font-medium flex items-center gap-1 min-w-0">
              <span className="truncate">{author?.fullName}</span>
              {author?.isBadged && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isMine && <button onClick={() => setIsManuallyPaused((paused) => !paused)} className="text-white/85 hover:text-white" aria-label={isManuallyPaused ? "Play status" : "Pause status"} title={isManuallyPaused ? "Play" : "Pause"}>
              {isManuallyPaused ? <PlayIcon className="w-5 h-5" /> : <PauseIcon className="w-5 h-5" />}
            </button>}
            {isMine && !story.image && !story.video && <button onClick={() => setIsEditing(true)} className="text-white/80 hover:text-cyan-400" aria-label="Edit status"><PencilIcon className="w-5 h-5" /></button>}
            {isMine && <button onClick={handleDelete} className="text-white/80 hover:text-red-400" aria-label="Delete status"><TrashIcon className="w-5 h-5" /></button>}
            <button onClick={closeViewer} className="text-white/80 hover:text-white" aria-label="Close status"><XIcon className="w-6 h-6" /></button>
          </div>
        </div>}

        <div className="w-full h-full flex items-center justify-center relative touch-none" style={{ backgroundColor: story.image || story.video ? "#101010" : story.backgroundColor }}>
          {story.image && <>
            {!isFullImageLoaded && blurredImage && <img src={blurredImage} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-70" />}
            <img key={`${story._id}-${mediaRetry}`} ref={imageRef} src={story.image} alt="Status" draggable={false} onLoad={() => { setIsFullImageLoaded(true); setMediaReady(); }} onError={handleMediaError} className={`relative max-h-full max-w-full object-contain transition-opacity duration-[250ms] ${isFullImageLoaded ? "opacity-100" : "opacity-0"}`} />
          </>}
          {story.video && <>
            {(!isMediaReady || isMediaWaiting) && <img src={getVideoPoster(story.video)} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />}
            <video key={`${story._id}-${mediaRetry}`} ref={videoRef} src={story.video} poster={getVideoPoster(story.video)} draggable={false} className="relative max-h-full max-w-full object-contain" playsInline muted={isMuted} onCanPlay={setMediaReady} onWaiting={() => setIsMediaWaiting(true)} onStalled={() => setIsMediaWaiting(true)} onPlaying={() => setIsMediaWaiting(false)} onError={handleMediaError} onEnded={goNext} onTimeUpdate={(event) => {
              const { currentTime, duration } = event.target;
              if (duration) setProgress((currentTime / duration) * 100);
            }} />
          </>}
          {!story.image && !story.video && (isEditing ? <div className="w-full h-full flex flex-col items-center justify-center p-8" style={{ backgroundColor: editColor }}>
            <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={300} className="bg-transparent text-white text-center text-2xl font-medium w-full resize-none outline-none placeholder:text-white/60" rows={4} autoFocus />
            <div className="flex gap-2 mt-4">{COLORS.map((color) => <button key={color} onClick={() => setEditColor(color)} className={`size-6 rounded-full ${editColor === color ? "ring-2 ring-white" : ""}`} style={{ backgroundColor: color }} aria-label={`Choose ${color}`} />)}</div>
            <div className="flex gap-2 mt-5"><button onClick={handleSaveEdit} className="flex items-center gap-1.5 bg-white text-slate-900 rounded-full px-4 py-2 text-sm font-medium"><CheckIcon className="w-4 h-4" /> Save</button><button onClick={() => setIsEditing(false)} className="bg-black/30 text-white rounded-full px-4 py-2 text-sm font-medium">Cancel</button></div>
          </div> : <p className="text-white text-2xl font-medium text-center px-8">{story.text}</p>)}

          {(!isMediaReady || isMediaWaiting) && !mediaFailed && (story.image || story.video) && <div className="absolute inset-0 flex items-center justify-center z-10"><LoaderCircleIcon className="size-8 text-white animate-spin" /></div>}
          {mediaFailed && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 text-white"><p className="text-sm">Couldn't load this status</p><div className="flex gap-2"><button onClick={retryMedia} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm"><RotateCwIcon className="size-4" /> Retry</button><button onClick={goNext} className="rounded-full bg-white/15 px-3 py-1.5 text-sm">Skip</button></div></div>}
        </div>

        {!isHeld && (story.image || story.video) && story.text && <div className={`pointer-events-none absolute inset-x-0 z-10 px-4 ${isMine ? "bottom-20" : "bottom-24"}`}><p className="mx-auto max-w-[90%] rounded-2xl bg-black/45 px-4 py-2.5 text-center text-[15px] leading-snug text-white">{story.text}</p></div>}

        {story.video && !isHeld && <button onClick={(event) => { event.stopPropagation(); const video = videoRef.current; if (!video) return; const next = !isMuted; video.muted = next; setIsMuted(next); }} className="absolute top-16 right-3 z-30 size-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white" aria-label={isMuted ? "Unmute video" : "Mute video"}>{isMuted ? <VolumeXIcon className="w-4 h-4" /> : <Volume2Icon className="w-4 h-4" />}</button>}

        {!isMine && !isHeld && <div className="absolute bottom-4 left-3 right-3 z-30 flex items-center gap-2">
          <form onSubmit={handleSendReply} className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-black/55 px-4 py-2.5">
            <input ref={replyInputRef} value={replyText} onChange={(event) => setReplyText(event.target.value)} onFocus={() => setIsReplyFocused(true)} onBlur={() => setIsReplyFocused(false)} placeholder={replySent ? "Sent" : "Reply..."} maxLength={2000} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/70" aria-label="Reply to status" />
            {replyText.trim() && <button type="submit" disabled={isSendingReply} aria-label="Send reply" className="text-white disabled:opacity-50">{isSendingReply ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}</button>}
          </form>
          <button onClick={handleLike} disabled={isLiking} aria-label={isLiked ? "Unlike status" : "Like status"} className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-black/55 text-white transition-transform ${isLiked ? "scale-110 text-rose-400" : ""}`}>
            <HeartIcon className={`size-5 transition-all ${isLiked ? "fill-current animate-pulse" : ""}`} />
          </button>
        </div>}

        {isMine && <div className="absolute bottom-4 left-3 right-3 z-30">
          {viewersList ? <div className="bg-black/70 rounded-lg p-3 max-h-56 overflow-y-auto touch-auto">
            <div className="flex items-center justify-between mb-2"><p className="text-white/80 text-xs">{viewersList.viewCount} views · {viewersList.likeCount} likes</p><button onClick={() => setViewersList(null)} aria-label="Close viewers" className="text-white/70"><XIcon className="size-4" /></button></div>
            {viewerRows.map((viewer) => <div key={viewer.userId._id} className="flex items-center gap-2 py-1">
              <img src={viewer.userId.profilePic || "/avatar.svg"} alt="" draggable={false} className="size-7 rounded-full object-cover" />
              <span className="min-w-0 flex-1 truncate text-white text-sm">{viewer.userId.fullName}{viewer.userId.isBadged && <VerifiedBadge className="ml-1 inline size-3" />}</span>
              {viewer.liked && <HeartIcon className="size-3.5 fill-rose-400 text-rose-400" />}
              <time className="text-[10px] text-white/55">{new Date(viewer.viewedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
            </div>)}
          </div> : <button onClick={handleShowViewers} className="flex items-center gap-1.5 text-white/80 text-sm bg-black/50 rounded-full px-3 py-1.5"><EyeIcon className="w-4 h-4" /> {totalStoryViews} views · {totalStoryLikes} likes</button>}
        </div>}
      </div>
    </div>
  );
}

export default StoryViewerModal;
