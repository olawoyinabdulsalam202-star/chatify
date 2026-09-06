import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore";
import VerifiedBadge from "./VerifiedBadge";
import { presenceLabel } from "../lib/lastSeen";

function ChatsList() {
  const { getMyChatPartners, chats, isUsersLoading, setSelectedUser, selectedUser, unreadCounts } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      {chats.map((chat) => {
        const unread = unreadCounts[chat._id] || 0;
        return (
          <div
            key={chat._id}
            className={`p-4 rounded-lg cursor-pointer transition-colors ${
              selectedUser?._id === chat._id
                ? "bg-cyan-500/25 ring-1 ring-cyan-500/40"
                : "bg-cyan-500/10 hover:bg-cyan-500/20"
            }`}
            onClick={() => setSelectedUser(chat)}
          >
            <div className="flex items-center gap-3">
              <div className={`avatar ${onlineUsers.includes(chat._id) ? "online" : "offline"}`}>
                <div className="size-12 rounded-full">
                  <img src={chat.profilePic || "/avatar.svg"} alt={chat.fullName} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-slate-200 font-medium truncate flex items-center gap-1">
                  <span className="truncate">{chat.fullName}</span>
                  {chat.isBadged && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
                </h4>
                <p
                  className={`text-xs truncate ${
                    onlineUsers.includes(chat._id) ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {presenceLabel({
                    isOnline: onlineUsers.includes(chat._id),
                    lastSeenAt: chat.lastSeenAt,
                  })}
                </p>
              </div>
              {unread > 0 && (
                <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
export default ChatsList;