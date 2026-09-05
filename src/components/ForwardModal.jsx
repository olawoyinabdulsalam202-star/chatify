import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import { XIcon } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";

function ForwardModal({ message, onClose }) {
  const { chats, allContacts, getMyChatPartners, getAllContacts, forwardMessage } = useChatStore();
  const { friends, fetchStatus } = useFriendStore();

  useEffect(() => {
    getMyChatPartners();
    getAllContacts();
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge chats + contacts, de-duped by _id, restricted to friends (you can
  // only message people you're friends with now).
  const seen = new Set();
  const people = [...chats, ...allContacts].filter((p) => {
    if (seen.has(p._id) || !friends.includes(p._id)) return false;
    seen.add(p._id);
    return true;
  });

  const handleForward = (userId) => {
    forwardMessage(message, userId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-sm max-h-96 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-slate-200 font-medium">Forward to…</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {people.length === 0 && (
            <p className="text-sm text-slate-500 p-4">No contacts to forward to yet.</p>
          )}
          {people.map((person) => (
            <button
              key={person._id}
              onClick={() => handleForward(person._id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 text-left"
            >
              <img
                src={person.profilePic || "/avatar.svg"}
                alt={person.fullName}
                className="w-9 h-9 rounded-full object-cover"
              />
              <span className="text-slate-200 text-sm flex items-center gap-1">
                {person.fullName}
                {person.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ForwardModal;
