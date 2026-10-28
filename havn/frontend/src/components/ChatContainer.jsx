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
  DownloadIcon,
  UserPlusIcon,
  BanIcon,
  FlagIcon,
} from "lucide-react";
import ViewOnceViewer from "./ViewOnceViewer";
import ViewOnceBubble from "./ViewOnceBubble";
import AudioBubble from "./AudioBubble";
import { useStickerStore } from "../store/useStickerStore";
import { getFontStack, loadFont } from "../lib/fonts";
import { getDownloadUrl } from "../lib/downloadMedia";
import { useFriendStore } from "../store/useFriendStore";
import MessageMedia from "./MessageMedia";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageTicks({ status }) {
  if (status === "seen") return <CheckCheckIcon className="w-3.5 h-3.5 text-blue-300" />;
  if (status === "delivered") return <CheckCheckIcon className="w-3.5 h-3.5 text-slate-300" />;
  return <CheckIcon className="w-3.5 h-3.5 text-slate-300" />;
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
  const { addByUsername, blockUser, reportUser } = useFriendStore();
  const selectedUserId = selectedUser?._id;
  const saveSticker = useStickerStore((s) => s.saveSticker);
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  // Tracks the last message count we scrolled for, so the auto-scroll only
  // fires when a real new message arrives — not on every re-render (reconciles,
  // reactions, sidebar refreshes), which is what made the view jump up and down.
  const prevCountRef = useRef(0);
  const nearBottomRef = useRef(true);
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

  const handleAddContact = async () => {
    const connected = await addByUsername(selectedUser.username);
    if (connected) useChatStore.getState().setSelectedUser({ ...selectedUser, ...connected, isFriend: true });
  };

  const handleBlock = async () => {
    if (await blockUser(selectedUser._id)) useChatStore.getState().setSelectedUser(null);
  };

  const handleReport = async () => {
    const reason = window.prompt("Why are you reporting this user?");
    if (reason?.trim()) await reportUser(selectedUser._id, reason.trim());
  };

  const downloadMedia = () => {
    const link = document.createElement("a");
    link.href = getDownloadUrl(fullMedia.url);
    link.download = `havn-${Date.now()}.${fullMedia.type === "video" ? "mp4" : "jpg"}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    if (!selectedUserId) return;
    nearBottomRef.current = true;
    prevCountRef.current = 0;
    getMessagesByUserId(selectedUserId);
    subscribeToMessages();

    // clean up
    return () => unsubscribeFromMessages();
  }, [selectedUserId, getMessagesByUserId, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    messages.forEach((message) => loadFont(message.senderFontFamily));
  }, [messages]);

  // Scroll to the newest message only when the count actually grows. Editing a
  // reaction, reconciling an optimistic send, or a background sidebar refresh
  // all re-run this effect with the same messages — scrolling on those (and with
  // "smooth", which restarts mid-animation) is what made the pane drift up and
  // down. Setting scrollTop directly never nudges an ancestor scroll container.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (messages.length > prevCountRef.current && nearBottomRef.current) {
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
      {selectedUser.isFriend === false && (
        <div className="shrink-0 flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
          <span className="flex-1">Not in your contacts</span>
          <button onClick={handleBlock} className="flex items-center gap-1 hover:text-red-300"><BanIcon className="size-3.5" /> Block</button>
          <button onClick={handleReport} className="flex items-center gap-1 hover:text-amber-300"><FlagIcon className="size-3.5" /> Report</button>
          <button onClick={handleAddContact} className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200"><UserPlusIcon className="size-3.5" /> Add</button>
        </div>
      )}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6 sm:px-6 sm:py-8"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        onClick={() => setActiveMsgId(null)}
      >
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isMine = msg.senderId === authUser._id;
              const reactionGroups = groupReactions(msg.reactions);
              // Photo and video messages use a compact media bubble; other media keeps its existing layout.
              const hasPhotoVideo = Boolean((msg.image || msg.video) && !msg.viewOnce && !msg.isDeleted);
              const isMediaOnly =
                (msg.gif || msg.sticker) &&
                !hasPhotoVideo &&
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
                    className={`chat-bubble relative group max-w-[82%] sm:max-w-[75%] ${
                      hasPhotoVideo
                        ? `${isMine ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-200"} p-1`
                        : isMediaOnly
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
                        {msg.storyReply && (
                          <div className="mb-2 flex max-w-[260px] items-center gap-2 rounded-lg bg-black/15 p-2">
                            {msg.storyReply.thumbnail && <img src={msg.storyReply.thumbnail} alt="" draggable={false} className="size-12 shrink-0 rounded-md object-cover" />}
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Status</p>
                              <p className="truncate text-xs opacity-80">{msg.storyReply.text || "Photo or video status"}</p>
                            </div>
                          </div>
                        )}
                        {msg.replyTo && (
                          <div className="mb-2 pl-2 border-l-2 border-white/30 text-xs opacity-80 truncate max-w-[240px]">
                            {msg.replyTo.text}
                          </div>
                        )}

                        {hasPhotoVideo && (
                          <MessageMedia
                            image={msg.image}
                            video={msg.video}
                            caption={msg.text}
                            fontFamily={msg.senderFontFamily}
                            createdAt={msg.createdAt}
                            edited={msg.isEdited && !msg.isDeleted}
                            ticks={isMine ? <MessageTicks status={msg.status} /> : null}
                            onOpen={(type, url) => setFullMedia({ type, url })}
                            captionContent={editingId === msg._id ? (
                              <form onSubmit={(e) => submitEdit(e, msg._id)} onClick={(e) => e.stopPropagation()} className="flex gap-2">
                                <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} className="min-w-0 flex-1 rounded bg-slate-900/60 px-2 py-1 text-sm outline-none" />
                                <button type="submit" className="text-xs text-cyan-300">Save</button>
                                <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
                              </form>
                            ) : null}
                          />
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
                          <img  src={msg.gif} alt="GIF" className="rounded-lg max-h-60 max-w-full object-contain" />
                        )}
                        {msg.sticker && (
                          <img  src={msg.sticker} alt="Sticker" className="w-32 h-32 object-contain" />
                        )}
                        {msg.audio && (
                          <AudioBubble src={msg.audio} duration={msg.audioDuration} isMine={isMine} />
                        )}

                        {!hasPhotoVideo && editingId === msg._id ? (
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
                          !hasPhotoVideo && msg.text && <p style={{ fontFamily: getFontStack(msg.senderFontFamily) }} className="mt-2 break-words">{msg.text}</p>
                        )}
                      </>
                    )}

                    {!hasPhotoVideo && <p className="text-xs mt-1 opacity-75 flex items-center gap-1">
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {msg.isEdited && !msg.isDeleted && <span className="italic">· edited</span>}
                      {isMine && !msg.isDeleted && <MessageTicks status={msg.status} />}
                    </p>}

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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadMedia();
            }}
            className="absolute top-4 right-16 z-10 flex items-center gap-2 rounded-lg bg-slate-800/90 px-3 py-2 text-sm text-white"
          >
            <DownloadIcon className="h-4 w-4" /> Download
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
