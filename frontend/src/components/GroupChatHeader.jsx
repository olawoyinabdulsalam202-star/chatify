import { useEffect, useRef, useState } from "react";
import {
  XIcon,
  ArrowLeftIcon,
  UsersIcon,
  HashIcon,
  MegaphoneIcon,
  LogOutIcon,
  MoreVerticalIcon,
  InfoIcon,
} from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import VerifiedBadge from "./VerifiedBadge";
import GroupInfoModal from "./GroupInfoModal";

function GroupChatHeader() {
  const { selectedGroup, setSelectedGroup, removeMember } = useGroupStore();
  const { authUser } = useAuthStore();
  const [showInfo, setShowInfo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const myMembership = selectedGroup.members.find(
    (m) => (m.userId._id || m.userId) === authUser._id
  );
  const isAdmin = myMembership?.role === "admin";

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape" && menuOpen) setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [menuOpen]);

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
      <button
        onClick={() => setShowInfo(true)}
        className="flex items-center space-x-3 text-left flex-1 min-w-0"
      >
        <span className="md:hidden mr-1" onClick={(e) => { e.stopPropagation(); setSelectedGroup(null); }}>
          <ArrowLeftIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors" />
        </span>

        <div className="size-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
          {selectedGroup.avatar ? (
            <img src={selectedGroup.avatar} alt={selectedGroup.name} className="size-full object-cover" />
          ) : selectedGroup.type === "channel" ? (
            <MegaphoneIcon className="w-5 h-5 text-slate-400" />
          ) : (
            <HashIcon className="w-5 h-5 text-slate-400" />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="text-slate-200 font-medium truncate flex items-center gap-1">
            {selectedGroup.name}
            {selectedGroup.creatorIsBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
          </h3>
          <p className="text-slate-400 text-sm flex items-center gap-1">
            <UsersIcon className="w-3 h-3" /> {selectedGroup.members.length} members
            {selectedGroup.type === "channel" && !isAdmin ? " · read-only" : ""}
          </p>
        </div>
      </button>

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
              onClick={() => {
                setShowInfo(true);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800"
            >
              <InfoIcon className="w-4 h-4" /> View info
            </button>
            <button
              onClick={() => {
                removeMember(selectedGroup._id, authUser._id);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-slate-800"
            >
              <LogOutIcon className="w-4 h-4" /> Leave group
            </button>
            <button
              onClick={() => {
                setSelectedGroup(null);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800"
            >
              <XIcon className="w-4 h-4" /> Close
            </button>
          </div>
        )}
      </div>

      {showInfo && <GroupInfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
}

export default GroupChatHeader;
