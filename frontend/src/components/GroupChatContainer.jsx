import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import GroupChatHeader from "./GroupChatHeader";
import GroupMessageInput from "./GroupMessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import {
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
  ReplyIcon,
  SmileIcon,
  BotIcon,
  PlayIcon,
  StickerIcon,
  XIcon,
} from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import ViewOnceBubble from "./ViewOnceBubble";
import ViewOnceViewer from "./ViewOnceViewer";
import AudioBubble from "./AudioBubble";
import { useStickerStore } from "../store/useStickerStore";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function GroupChatContainer() {
  const {
    selectedGroup,
    groupMessages,
    isGroupMessagesLoading,
    getGroupMessages,
    editGroupMessage,
    deleteGroupMessage,
    toggleGroupReaction,
    setReplyTarget,
    replyTarget,
    botTypingGroupId,
    openGroupViewOnce,
    viewOnceCache,
  } = useGroupStore();
  const { authUser } = useAuthStore();
  const saveSticker = useStickerStore((s) => s.saveSticker);
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  // Only auto-scroll when the message count actually grows, so re-renders from
  // reconciles/reactions/refreshes don't yank the pane up and down.
  const prevCountRef = useRef(0);
  // Tracks the long-press-to-reveal timer per bubble and whether the press
  // already fired, so the follow-up click doesn't immediately toggle it off.
  const longPressRef = useRef({ timer: null, fired: false });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openReactionsId, setOpenReactionsId] = useState(null);
  // Reveals a message's action row by tap on touch devices (no hover). Tapping
  // the bubble toggles it; tapping empty scroll space clears it. Hover still
  // works on desktop.
  const [activeMsgId, setActiveMsgId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  // { imageUrl, videoUrl, duration } while a view-once item is open fullscreen.
  const [viewOnceMedia, setViewOnceMedia] = useState(null);
  // { type: "image" | "video", url } for the normal fullscreen media viewer.
  const [fullMedia, setFullMedia] = useState(null);

  useEffect(() => {
    getGroupMessages(selectedGroup._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup._id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (groupMessages.length > prevCountRef.current) {
      container.scrollTop = container.scrollHeight;
    }
    prevCountRef.current = groupMessages.length;
  }, [groupMessages, botTypingGroupId]);

  // Smart-cancel: while a menu or reactions popover is open, a tap anywhere on
  // the page closes it. The popovers themselves stopPropagation, so a tap on
  // their own buttons never reaches here.
  useEffect(() => {
    if (!openMenuId && !openReactionsId) return;
    const close = () => {
      setOpenMenuId(null);
      setOpenReactionsId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId, openReactionsId]);

  const memberById = (id) => {
    const m = selectedGroup.members.find((m) => (m.userId._id || m.userId) === id);
    if (m?.userId?._id) return m.userId;
    return null;
  };

  return (
    <>
      <GroupChatHeader />

      <div
        ref={scrollContainerRef}
        className="flex-1 px-3 sm:px-6 overflow-y-auto py-6 sm:py-8"
        onClick={() => setActiveMsgId(null)}
      >
        {groupMessages.length > 0 && !isGroupMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-1">
            {groupMessages.map((msg, index) => {
              const isMine = msg.senderId._id
                ? msg.senderId._id === authUser._id
                : msg.senderId === authUser._id;
              const sender = msg.senderId._id ? msg.senderId : memberById(msg.senderId) || {};
              const isBot = sender.isBot;

              // WhatsApp-style grouping: only show the avatar + name once per
              // consecutive run of messages from the same sender, not on
              // every single message.
              const senderId = sender._id || msg.senderId;
              const prevMsg = groupMessages[index - 1];
              const prevSenderId = prevMsg
                ? prevMsg.senderId._id || prevMsg.senderId
                : null;
              const isFirstInRun = senderId !== prevSenderId;
              // Caption-less media (image, video, gif, sticker) drops its bubble so
              // it reads edge-to-edge, like WhatsApp. The per-run sender name still
              // renders above it. View-once and audio keep their bubble.
              const isMediaOnly =
                (msg.image || msg.video || msg.gif || msg.sticker) &&
                !msg.text &&
                !msg.isDeleted &&
                !msg.viewOnce;

              return (
                <div
                  key={msg._id}
                  className={`chat ${isMine ? "chat-end" : "chat-start"} group ${isFirstInRun ? "mt-4" : "mt-0.5"}`}
                >
                  {!isMine && (
                    <div className="chat-image avatar self-end">
                      <div className="w-8 rounded-full">
                        {isFirstInRun && (
                          <img src={sender.profilePic || "/avatar.svg"} alt={sender.fullName || "Member"} />
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      // A long-press already revealed the actions; swallow the
                      // click it fires on release so it doesn't toggle them off.
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
                        // The group ⋮ menu is Edit/Delete — own messages only.
                        // For others, revealing the action row is enough.
                        if (isMine) setOpenMenuId(msg._id);
                      }, 500);
                    }}
                    onTouchEnd={() => clearTimeout(longPressRef.current.timer)}
                    onTouchMove={() => clearTimeout(longPressRef.current.timer)}
                    className={`chat-bubble relative ${
                      isMediaOnly
                        ? "bg-transparent p-0 text-slate-200"
                        : isMine
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-800 text-slate-200"
                    } ${msg.isDeleted ? "italic opacity-60" : ""}`}
                  >
                    {!isMine && isFirstInRun && (
                      <div className="text-xs font-semibold text-cyan-400 mb-0.5 flex items-center gap-1">
                        {isBot && <BotIcon className="w-3 h-3" />}
                        {sender.fullName || "Member"}
                        {sender.isBadged && <VerifiedBadge className="w-3 h-3" />}
                      </div>
                    )}
                    {msg.replyTo && (
                      <div className="mb-1.5 pl-2 border-l-2 border-white/30 text-xs opacity-75 truncate max-w-[220px]">
                        {msg.replyTo.text}
                      </div>
                    )}

                    {msg.isDeleted ? (
                      <p className="text-sm">This message was deleted</p>
                    ) : (
                      <>
                        {msg.text && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                        {msg.image && !msg.viewOnce && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullMedia({ type: "image", url: msg.image });
                            }}
                            className="block mt-1"
                          >
                            <img
                              src={msg.image}
                              alt="Shared"
                              className="rounded-lg h-48 object-cover max-w-full"
                            />
                          </button>
                        )}
                        {msg.video && !msg.viewOnce && (
                          // No inline `controls`: a control bar would swallow
                          // the tap that opens the fullscreen viewer, so the
                          // thumbnail is a muted poster with a play badge.
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullMedia({ type: "video", url: msg.video });
                            }}
                            className="block relative rounded-lg overflow-hidden mt-1"
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
                            isGroup
                            cached={viewOnceCache[msg._id]}
                            onOpen={openGroupViewOnce}
                            onOpenMedia={setViewOnceMedia}
                          />
                        )}
                        {msg.gif && (
                          <img src={msg.gif} alt="GIF" className="rounded-lg max-h-60 max-w-full object-contain mt-1" />
                        )}
                        {msg.sticker && (
                          <img src={msg.sticker} alt="Sticker" className="w-32 h-32 object-contain mt-1" />
                        )}
                        {msg.audio && (
                          <AudioBubble src={msg.audio} duration={msg.audioDuration} isMine={isMine} />
                        )}
                      </>
                    )}

                    {msg.reactions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        {Object.entries(
                          msg.reactions.reduce((acc, r) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleGroupReaction(msg._id, emoji)}
                            className="bg-black/20 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5"
                          >
                            {emoji} {count > 1 && count}
                          </button>
                        ))}
                      </div>
                    )}

                    {!msg.isDeleted && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute top-0 ${
                          isMine ? "-left-20" : "-right-20"
                        } ${activeMsgId === msg._id ? "opacity-100" : "opacity-0"} group-hover:opacity-100 transition-opacity flex items-center gap-1`}
                      >
                        <button
                          onClick={() => setOpenReactionsId(openReactionsId === msg._id ? null : msg._id)}
                          className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-cyan-400"
                        >
                          <SmileIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setReplyTarget(msg)}
                          className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-cyan-400"
                        >
                          <ReplyIcon className="w-3.5 h-3.5" />
                        </button>
                        {msg.sticker && (
                          <button
                            onClick={() => saveSticker(msg.sticker)}
                            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-cyan-400"
                            title="Save sticker"
                          >
                            <StickerIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isMine && (
                          <button
                            onClick={() => setOpenMenuId(openMenuId === msg._id ? null : msg._id)}
                            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200"
                          >
                            <MoreVerticalIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {openReactionsId === msg._id && (
                      <div
                        className="absolute -top-10 left-0 bg-slate-800 border border-slate-700 rounded-full px-2 py-1 flex gap-1 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              toggleGroupReaction(msg._id, emoji);
                              setOpenReactionsId(null);
                            }}
                            className="hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {openMenuId === msg._id && (
                      <div
                        className="absolute top-6 right-0 bg-slate-800 border border-slate-700 rounded-lg py-1 z-10 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {msg.text && (
                          <button
                            onClick={() => {
                              setEditingId(msg._id);
                              setEditText(msg.text);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                          >
                            <PencilIcon className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                        <button
                          onClick={() => {
                            deleteGroupMessage(msg._id);
                            setOpenMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700"
                        >
                          <TrashIcon className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === msg._id && (
                    <div className="chat-footer flex items-center gap-2 mt-1">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          editGroupMessage(msg._id, editText);
                          setEditingId(null);
                        }}
                        className="text-xs text-cyan-400"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {botTypingGroupId === selectedGroup._id && (
              <div className="chat chat-start mt-4">
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <BotIcon className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>
                <div className="chat-bubble bg-slate-800 text-slate-200 flex items-center gap-1 py-3">
                  <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-1.5 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
        ) : isGroupMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            No messages yet — say hello.
          </div>
        )}
      </div>

      {replyTarget && (
        <div className="px-3 sm:px-6 pb-2 max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between bg-slate-800/60 border-l-2 border-cyan-500 rounded px-3 py-1.5 text-xs">
            <span className="text-slate-400 truncate">Replying: {replyTarget.text || "Attachment"}</span>
            <button onClick={() => setReplyTarget(null)} className="text-slate-500 hover:text-slate-300 ml-2">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <GroupMessageInput />

      {viewOnceMedia && (
        <ViewOnceViewer
          imageUrl={viewOnceMedia.imageUrl}
          videoUrl={viewOnceMedia.videoUrl}
          duration={viewOnceMedia.duration}
          senderName={selectedGroup?.name}
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
              // Stops a tap on the scrubber from bubbling to the backdrop and
              // closing the video mid-playback.
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
    </>
  );
}

export default GroupChatContainer;
