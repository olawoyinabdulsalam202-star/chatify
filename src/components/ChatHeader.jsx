import { XIcon, ArrowLeftIcon, PhoneIcon, VideoIcon, MoreVerticalIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import VerifiedBadge from "./VerifiedBadge";
import { presenceLabel } from "../lib/lastSeen";

function ChatHeader() {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, callState } = useCallStore();
  const isOnline = onlineUsers.includes(selectedUser._id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // "last seen 5m ago" is relative to now, so it has to be recomputed as time
  // passes — otherwise the line a user is staring at silently goes stale. A
  // minute is the finest granularity the label shows, so ticking faster would
  // re-render for nothing.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isOnline) return; // nothing to age while they're connected
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [isOnline]);

  const presence = presenceLabel({ isOnline, lastSeenAt: selectedUser.lastSeenAt });

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key !== "Escape") return;
      // Escape backs out of the menu first, then closes the chat.
      if (menuOpen) setMenuOpen(false);
      else setSelectedUser(null);
    };

    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1">
      <div className="flex items-center space-x-3">
        {/* Back arrow on mobile only */}
        <button className="md:hidden mr-1" onClick={() => setSelectedUser(null)}>
          <ArrowLeftIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors" />
        </button>

        <div className={`avatar ${isOnline ? "online" : "offline"}`}>
          <div className="w-12 rounded-full">
            <img src={selectedUser.profilePic || "/avatar.svg"} alt={selectedUser.fullName} />
          </div>
        </div>

        <div>
          <h3 className="text-slate-200 font-medium flex items-center gap-1">
            {selectedUser.fullName}
            {selectedUser.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
          </h3>
          <p className={`text-sm ${isOnline ? "text-emerald-400" : "text-slate-400"}`}>{presence}</p>
          {selectedUser.settings?.awayMessage && (
            <p className="text-slate-500 text-xs italic mt-0.5">
              {selectedUser.settings.awayMessage}
            </p>
          )}
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`text-slate-400 hover:text-slate-200 transition-colors ${menuOpen ? "text-slate-200" : ""}`}
          aria-label="More options"
        >
          <MoreVerticalIcon className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 py-1 text-sm overflow-hidden">
            <button
              disabled={!isOnline || callState !== "idle"}
              onClick={() => {
                startCall(selectedUser, "audio");
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <PhoneIcon className="w-4 h-4" /> Voice call
            </button>
            <button
              disabled={!isOnline || callState !== "idle"}
              onClick={() => {
                startCall(selectedUser, "video");
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <VideoIcon className="w-4 h-4" /> Video call
            </button>
            <button
              onClick={() => {
                setSelectedUser(null);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800"
            >
              <XIcon className="w-4 h-4" /> Close chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default ChatHeader;