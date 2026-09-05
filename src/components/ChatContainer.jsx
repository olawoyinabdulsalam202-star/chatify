import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import ForwardModal from "./ForwardModal";
import toast from "react-hot-toast";
import {
  CheckIcon,
  CheckCheckIcon,
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
  CopyIcon,
  ReplyIcon,
  ForwardIcon,
  SmileIcon,
  StickerIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
  PlayIcon,
  VideoIcon,
} from "lucide-react";
import ViewOnceViewer from "./ViewOnceViewer";
import ViewOnceBubble from "./ViewOnceBubble";
import AudioBubble from "./AudioBubble";
import { useStickerStore } from "../store/useStickerStore";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageTicks({ status }) {
  if (status === "seen") return <CheckCheckIcon className="w-3.5 h-3.5 text-white" />;
  if (status === "delivered") return <CheckCheckIcon className="w-3.5 h-3.5 opacity-70" />;
  return <CheckIcon className="w-3.5 h-3.5 opacity-70" />;
}

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    editMessage,
    deleteMessage,
    typingUserId,
    setReplyTarget,
    toggleReaction,
    openViewOnce,
    viewOnceCache,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const saveSticker = useStickerStore((s) => s.saveSticker);
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  // Tracks the last message count we scrolled for, so the auto-scroll only
  // fires when a real new message arrives — not on every re-render (reconciles,
  // reactions, sidebar refreshes), which is what made the view jump up and down.
  const prevCountRef = useRef(0);
  // Holds the pending long-press timer and a flag so the click that ends a
  // long-press doesn't immediately toggle the reveal back off.
  const longPressRef = useRef({ timer: null, fired: false });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openReactionsId, setOpenReactionsId] = useState(null);
  // Touch devices have no hover, so the per-message action triggers (react /
  // more) would never appear. Tapping a bubble sets this to reveal them; tapping
  // empty space in the scroll area clears it. Desktop still reveals on hover.
  const [activeMsgId, setActiveMsgId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [forwardingMessage, setForwardingMessage] = useState(null);
  // Fullscreen media viewer: { type: "image" | "video", url }. One piece of
  // state for both so a photo and a video can't ever be open at once.
  const [fullMedia, setFullMedia] = useState(null);
  // { imageUrl, videoUrl, duration } while a view-once item is open fullscreen.
  const [viewOnceMedia, setViewOnceMedia] = useState(null);

  useEffect(() => {
    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    // clean up
    return () => unsubscribeFromMessages();
  }, [selectedUser, getMessagesByUserId, subscribeToMessages, unsubscribeFromMessages]);

  // Scroll to the newest message only when the count actually grows. Editing a
  // reaction, reconciling an optimistic send, or a background sidebar refresh
  // all re-run this effect with the same messages — scrolling on those (and with
  // "smooth", which restarts mid-animation) is what made the pane drift up and
  // down. We also set scrollTop directly instead of scrollIntoView so it never
  // nudges any ancestor scroll container.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (messages.length > prevCountRef.current) {
      container.scrollTop = container.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages, typingUserId]);

  // Smart-cancel: while a message's menu (or quick-reactions) is open, a tap
  // anywhere else on the screen closes it. The menu and its trigger stop click
  // propagation, so only taps outside them reach this document listener.
  useEffect(() => {
    if (!openMenuId && !openReactionsId) return;
    const close = () => {
      setOpenMenuId(null);
      setOpenReactionsId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId, openReactionsId]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    setOpenMenuId(null);
  };

  const startEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.text);
    setOpenMenuId(null);
  };

  const submitEdit = (e, messageId) => {
    e.preventDefault();
    if (!editText.trim()) return;
    editMessage(messageId, editText.trim());
    setEditingId(null);
  };

  const handleDelete = (messageId) => {
    deleteMessage(messageId);
    setOpenMenuId(null);
  };

  const handleReply = (msg) => {
    setReplyTarget(msg);
    setOpenMenuId(null);
  };

  const handleSaveSticker = (url) => {
    saveSticker(url);
    setOpenMenuId(null);
  };

  const handleReact = (messageId, emoji) => {
    toggleReaction(messageId, emoji);
    setOpenReactionsId(null);
    setOpenMenuId(null);
  };

  // Group reactions like { "👍": [userId1, userId2] } for compact pill display.
  const groupReactions = (reactions = []) => {
    const groups = {};
    reactions.forEach((r) => {
      groups[r.emoji] = groups[r.emoji] || [];
      groups[r.emoji].push(r.userId);
    });
    return groups;
  };

  return (
    <>
      <ChatHeader />
      <div
        ref={scrollContainerRef}
        className="flex-1 px-3 sm:px-6 overflow-y-auto py-6 sm:py-8"
        onClick={() => setActiveMsgId(null)}
      >
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isMine = msg.senderId === authUser._id;
              const reactionGroups = groupReactions(msg.reactions);
              // Caption-less media (image, video, gif, sticker) drops its bubble so
              // it reads edge-to-edge, like WhatsApp. View-once and audio keep theirs.
              const isMediaOnly =
                (msg.image || msg.video || msg.gif || msg.sticker) &&
                !msg.text &&
                !msg.isDeleted &&
                !msg.viewOnce;

              return (
                <div key={msg._id} className={`chat ${isMine ? "chat-end" : "chat-start"}`}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (longPressRef.current.fired) {
                        longPressRef.current.fired = false;
                        return;
                      }
                      setActiveMsgId((cur) => (cur === msg._id ? null : msg._id));
                    }}
                    onTouchStart={() => {
                      if (msg.isDeleted) return;
                      longPressRef.current.fired = false;
                      longPressRef.current.timer = setTimeout(() => {
                        longPressRef.current.fired = true;
                        setActiveMsgId(msg._id);
                        setOpenMenuId(msg._id);
                      }, 500);
                    }}
                    onTouchEnd={() => clearTimeout(longPressRef.current.timer)}
                    onTouchMove={() => clearTimeout(longPressRef.current.timer)}
                    className={`chat-bubble relative group ${
                      isMediaOnly
                        ? "bg-transparent p-0 text-slate-200"
                        : isMine
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {!msg.isDeleted && (
                      <div className="absolute -top-2 -right-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenReactionsId(openReactionsId === msg._id ? null : msg._id)}
                          className={`w-6 h-6 rounded-full bg-slate-900/80 flex items-center justify-center text-slate-300 ${activeMsgId === msg._id ? "opacity-100" : "opacity-0"} group-hover:opacity-100 transition-opacity`}
                        >
                          <SmileIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === msg._id ? null : msg._id)}
                          className={`w-6 h-6 rounded-full bg-slate-900/80 flex items-center justify-center text-slate-300 ${activeMsgId === msg._id ? "opacity-100" : "opacity-0"} group-hover:opacity-100 transition-opacity`}
                        >
                          <MoreVerticalIcon className="w-3.5 h-3.5" />
                        </button>

                        {openReactionsId === msg._id && (
                          <div className="absolute right-0 top-7 bg-slate-900 border border-slate-700 rounded-full shadow-xl z-10 flex px-2 py-1 gap-1">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReact(msg._id, emoji)}
                                className="text-lg hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {openMenuId === msg._id && (
                          <div className="absolute right-0 top-7 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-10 text-sm overflow-hidden">
                            <button
                              onClick={() => handleReply(msg)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-200"
                            >
                              <ReplyIcon className="w-3.5 h-3.5" /> Reply
                            </button>
                            {!msg.viewOnce && (
                              <button
                                onClick={() => setForwardingMessage(msg)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-200"
                              >
                                <ForwardIcon className="w-3.5 h-3.5" /> Forward
                              </button>
                            )}
                            {msg.text && (
                              <button
                                onClick={() => handleCopy(msg.text)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-200"
                              >
                                <CopyIcon className="w-3.5 h-3.5" /> Copy
                              </button>
                            )}
                            {msg.sticker && (
                              <button
                                onClick={() => handleSaveSticker(msg.sticker)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-200"
                              >
                                <StickerIcon className="w-3.5 h-3.5" /> Save sticker
                              </button>
                            )}
                            {isMine && msg.text && (
                              <button
                                onClick={() => startEdit(msg)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-200"
                              >
                                <PencilIcon className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            {isMine && (
                              <button
                                onClick={() => handleDelete(msg._id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-red-400"
                              >
                                <TrashIcon className="w-3.5 h-3.5" /> Delete for everyone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.isDeleted ? (
                      <p className="italic opacity-60 text-sm">This message was deleted</p>
                    ) : (
                      <>
                        {msg.replyTo && (
                          <div className="mb-2 pl-2 border-l-2 border-white/30 text-xs opacity-80 truncate max-w-[240px]">
                            {msg.replyTo.text}
                          </div>
                        )}

                        {msg.image && !msg.viewOnce && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullMedia({ type: "image", url: msg.image });
                            }}
                            className="block"
                          >
                            <img
                              src={msg.image}
                              alt="Shared"
                              className="rounded-lg h-48 object-cover max-w-full"
                            />
                          </button>
                        )}
                        {msg.video && !msg.viewOnce && (
                          // Tapping opens fullscreen, same as a photo. The
                          // inline element has no `controls` on purpose: a
                          // control bar would swallow the tap, so the thumbnail
                          // is a poster with a play badge and all playback
                          // happens in the fullscreen viewer.
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullMedia({ type: "video", url: msg.video });
                            }}
                            className="block relative rounded-lg overflow-hidden"
                          >
                            <video
                              src={msg.video}
                              playsInline
                              muted
                              preload="metadata"
                              className="rounded-lg max-h-64 max-w-full pointer-events-none"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <span className="size-12 rounded-full bg-black/60 flex items-center justify-center">
                                <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                              </span>
                            </span>
                          </button>
                        )}
                        {msg.viewOnce && (
                          <ViewOnceBubble
                            msg={msg}
                            isMine={isMine}
                            cached={viewOnceCache[msg._id]}
                            onOpen={openViewOnce}
                            onOpenMedia={setViewOnceMedia}
                          />
                        )}
                        {msg.gif && (
                          <img src={msg.gif} alt="GIF" className="rounded-lg max-h-60 max-w-full object-contain" />
                        )}
                        {msg.sticker && (
                          <img src={msg.sticker} alt="Sticker" className="w-32 h-32 object-contain" />
                        )}
                        {msg.audio && (
                          <AudioBubble src={msg.audio} duration={msg.audioDuration} isMine={isMine} />
                        )}

                        {editingId === msg._id ? (
                          <form
                            onSubmit={(e) => submitEdit(e, msg._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 flex gap-2"
                          >
                            <input
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 bg-slate-900/60 text-sm rounded px-2 py-1 outline-none"
                            />
                            <button type="submit" className="text-xs text-cyan-300">
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-slate-400"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          msg.text && <p className="mt-2 break-words">{msg.text}</p>
                        )}
                      </>
                    )}

                    <p className="text-xs mt-1 opacity-75 flex items-center gap-1">
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {msg.isEdited && !msg.isDeleted && <span className="italic">· edited</span>}
                      {isMine && !msg.isDeleted && <MessageTicks status={msg.status} />}
                    </p>

                    {Object.keys(reactionGroups).length > 0 && (
                      <div
                        className="absolute -bottom-3 left-2 flex gap-0.5 bg-slate-900 border border-slate-700 rounded-full px-1.5 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(reactionGroups).map(([emoji, userIds]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg._id, emoji)}
                            className="text-xs flex items-center gap-0.5"
                            title={`${userIds.length} reacted`}
                          >
                            {emoji}
                            {userIds.length > 1 && <span className="text-slate-400">{userIds.length}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {typingUserId === selectedUser._id && (
              <div className="chat chat-start">
                <div className="chat-bubble bg-slate-800 text-slate-400 text-sm italic">typing…</div>
              </div>
            )}

            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser.fullName} />
        )}
      </div>

      {forwardingMessage && (
        <ForwardModal message={forwardingMessage} onClose={() => setForwardingMessage(null)} />
      )}

      {viewOnceMedia && (
        <ViewOnceViewer
          imageUrl={viewOnceMedia.imageUrl}
          videoUrl={viewOnceMedia.videoUrl}
          duration={viewOnceMedia.duration}
          senderName={selectedUser?.fullName}
          onClose={() => setViewOnceMedia(null)}
        />
      )}

      {fullMedia && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setFullMedia(null)}
        >
          <button
            onClick={() => setFullMedia(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
            aria-label="Close"
          >
            <XIcon className="w-7 h-7" />
          </button>
          {fullMedia.type === "video" ? (
            <video
              src={fullMedia.url}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              controls
              autoPlay
              playsInline
              // Without this the backdrop's onClick fires on every tap of the
              // scrubber or volume slider and closes the video mid-playback.
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={fullMedia.url}
              alt="Shared"
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      <MessageInput />
    </>
  );
}

export default ChatContainer;
