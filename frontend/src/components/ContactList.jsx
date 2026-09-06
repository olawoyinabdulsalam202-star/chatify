import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { UserPlusIcon, ClockIcon, MessageCircleIcon } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import { presenceLabel } from "../lib/lastSeen";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, setActiveTab, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { friends, sentPending, sendRequest, fetchStatus } = useFriendStore();

  useEffect(() => {
    getAllContacts();
    fetchStatus();
  }, [getAllContacts, fetchStatus]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <>
      {allContacts.map((contact) => {
        const isFriend = friends.includes(contact._id);
        const isPending = sentPending.includes(contact._id);

        return (
          <div
            key={contact._id}
            className="bg-cyan-500/10 p-4 rounded-lg hover:bg-cyan-500/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`avatar ${onlineUsers.includes(contact._id) ? "online" : "offline"}`}>
                <div className="size-12 rounded-full">
                  <img src={contact.profilePic || "/avatar.svg"} alt={contact.fullName} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-slate-200 font-medium truncate flex items-center gap-1">
                  <span className="truncate">{contact.fullName}</span>
                  {contact.isBadged && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
                </h4>
                <p
                  className={`text-xs truncate ${
                    onlineUsers.includes(contact._id) ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {presenceLabel({
                    isOnline: onlineUsers.includes(contact._id),
                    lastSeenAt: contact.lastSeenAt,
                  })}
                </p>
              </div>

              {isFriend ? (
                <button
                  onClick={() => {
                    setSelectedUser(contact);
                    setActiveTab("chats");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 text-xs font-medium transition-colors"
                >
                  <MessageCircleIcon className="size-3.5" />
                  Message
                </button>
              ) : isPending ? (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-xs font-medium">
                  <ClockIcon className="size-3.5" />
                  Request sent
                </span>
              ) : (
                <button
                  onClick={() => sendRequest(contact._id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
                >
                  <UserPlusIcon className="size-3.5" />
                  Add friend
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
export default ContactList;
