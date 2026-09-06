import { useEffect, useState } from "react";
import { XIcon, ShieldIcon, UserMinusIcon, LogOutIcon, Trash2Icon, PlusIcon, BotIcon } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import VerifiedBadge from "./VerifiedBadge";

function GroupInfoModal({ onClose }) {
  const {
    selectedGroup,
    fetchGroupDetails,
    inviteMembers,
    pendingGroupInvites,
    fetchGroupPendingInvites,
    cancelGroupInvite,
    removeMember,
    setMemberRole,
    deleteGroup,
    updateGroup,
  } = useGroupStore();
  const { allContacts, getAllContacts } = useChatStore();
  const { authUser } = useAuthStore();
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [pickedIds, setPickedIds] = useState([]);
  const [showSuccessor, setShowSuccessor] = useState(false);
  const [successorId, setSuccessorId] = useState("");

  useEffect(() => {
    fetchGroupDetails(selectedGroup._id);
    getAllContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup._id]);

  const group = selectedGroup;
  const myMembership = group.members.find((m) => (m.userId._id || m.userId) === authUser._id);
  const isAdmin = myMembership?.role === "admin";
  const isCreator = (group.createdBy._id || group.createdBy) === authUser._id;

  useEffect(() => {
    if (isAdmin) fetchGroupPendingInvites(group._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group._id, isAdmin]);

  const existingMemberIds = new Set(group.members.map((m) => m.userId._id || m.userId));
  const invitedIds = new Set(pendingGroupInvites.map((i) => i.to._id));
  const addableContacts = allContacts.filter((c) => !existingMemberIds.has(c._id) && !invitedIds.has(c._id));

  const handleAddSelected = async () => {
    if (pickedIds.length === 0) return;
    await inviteMembers(group._id, pickedIds);
    setPickedIds([]);
    setShowAddMembers(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${group.name}" for everyone? This can't be undone.`)) {
      deleteGroup(group._id);
      onClose();
    }
  };

  // Leaving is only complicated in one case: you're the last admin and other
  // people are staying. A group with no admin can never be managed again, so
  // the seat has to be handed over before you walk out.
  const otherMembers = group.members.filter((m) => (m.userId._id || m.userId) !== authUser._id);
  const otherAdmins = otherMembers.filter((m) => m.role === "admin");
  const isLastAdmin = isAdmin && otherAdmins.length === 0 && otherMembers.length > 0;
  const isLastMember = otherMembers.length === 0;

  const handleLeave = () => {
    if (isLastMember) {
      if (!window.confirm(`You're the last member. Leaving will delete "${group.name}". Continue?`)) {
        return;
      }
      removeMember(group._id, authUser._id);
      onClose();
      return;
    }

    if (isLastAdmin) {
      setShowSuccessor(true); // pick who takes over first
      return;
    }

    removeMember(group._id, authUser._id);
    onClose();
  };

  const confirmLeaveWithSuccessor = () => {
    if (!successorId) return;
    removeMember(group._id, authUser._id, successorId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h3 className="text-slate-100 font-medium truncate flex items-center gap-1">
            {group.name}
            {group.creatorIsBadged && <VerifiedBadge className="w-4 h-4" />}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {group.description && (
          <p className="px-4 pt-3 text-sm text-slate-400">{group.description}</p>
        )}

        {group.type !== "channel" && (
          <div className="flex items-center justify-between mx-4 mt-3 p-3 bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2">
              <BotIcon className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-sm text-slate-200">AI assistant</p>
                <p className="text-xs text-slate-500">Let members @-mention the bot in this group</p>
              </div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-success"
              checked={group.botEnabled !== false}
              disabled={!isAdmin}
              onChange={(e) => updateGroup(group._id, { botEnabled: e.target.checked })}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase text-slate-500 font-medium">
              {group.members.length} members
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowAddMembers((v) => !v)}
                className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Invite
              </button>
            )}
          </div>

          {showAddMembers && (
            <div className="bg-slate-900/50 rounded-lg p-2 mb-2 space-y-1 max-h-40 overflow-y-auto">
              {addableContacts.length === 0 ? (
                <p className="text-xs text-slate-500 px-2 py-1">No more contacts to invite.</p>
              ) : (
                addableContacts.map((c) => (
                  <label key={c._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pickedIds.includes(c._id)}
                      onChange={() =>
                        setPickedIds((prev) =>
                          prev.includes(c._id) ? prev.filter((x) => x !== c._id) : [...prev, c._id]
                        )
                      }
                      className="checkbox checkbox-xs checkbox-primary"
                    />
                    <span className="text-xs text-slate-300">{c.fullName}</span>
                  </label>
                ))
              )}
              {addableContacts.length > 0 && (
                <button
                  onClick={handleAddSelected}
                  disabled={pickedIds.length === 0}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs rounded py-1.5 mt-1"
                >
                  Send invite{pickedIds.length > 1 ? "s" : ""} {pickedIds.length || ""}
                </button>
              )}
            </div>
          )}

          {isAdmin && pendingGroupInvites.length > 0 && (
            <div className="bg-slate-900/30 rounded-lg p-2 mb-2 space-y-1">
              <p className="text-[10px] uppercase text-slate-500 px-1">Invited, waiting to accept</p>
              {pendingGroupInvites.map((invite) => (
                <div key={invite.inviteId} className="flex items-center justify-between px-1 py-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                    {invite.to.fullName}
                    {invite.to.isBadged && <VerifiedBadge className="w-3 h-3" />}
                  </span>
                  <button
                    onClick={() => cancelGroupInvite(group._id, invite.inviteId)}
                    className="text-slate-500 hover:text-red-400 text-[10px] uppercase shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}

          {group.members.map((m) => {
            // The server decides what this viewer may see: admins get real
            // names, ordinary members get "Member" for everyone else. The
            // fallback here is only for a not-yet-populated payload (a socket
            // update that arrived before the details fetch), which is why it no
            // longer invents the "Member" label itself — doing that made every
            // name vanish for admins too, whenever an unpopulated group landed.
            const user = m.userId?._id ? m.userId : { _id: m.userId, fullName: "…", profilePic: "" };
            const isBot = user.isBot;
            return (
              <div key={user._id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {isBot ? (
                      <BotIcon className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <img src={user.profilePic || "/avatar.svg"} alt={user.fullName} className="size-full object-cover" />
                    )}
                  </div>
                  <span className="text-sm text-slate-200 truncate flex items-center gap-1">
                    {user.fullName}
                    {user._id === authUser._id && " (you)"}
                    {user.isBadged && <VerifiedBadge className="w-3 h-3" />}
                  </span>
                  {m.role === "admin" && (
                    <span className="text-[10px] uppercase bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                      admin
                    </span>
                  )}
                </div>
                {isAdmin && user._id !== authUser._id && !isBot && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      title={m.role === "admin" ? "Demote" : "Make admin"}
                      onClick={() => setMemberRole(group._id, user._id, m.role === "admin" ? "member" : "admin")}
                      className="text-slate-400 hover:text-cyan-400"
                    >
                      <ShieldIcon className="w-4 h-4" />
                    </button>
                    <button
                      title="Remove"
                      onClick={() => removeMember(group._id, user._id)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <UserMinusIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Successor picker — only shown when the last admin is leaving and
            somebody has to inherit the group. */}
        {showSuccessor && (
          <div className="mx-4 mb-3 p-3 bg-slate-900/70 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-200 mb-1">Choose a new admin</p>
            <p className="text-xs text-slate-500 mb-2">
              You're the only admin. Pick who takes over before you leave.
            </p>
            <select
              value={successorId}
              onChange={(e) => setSuccessorId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="">Select a member…</option>
              {otherMembers.map((m) => {
                const u = m.userId._id ? m.userId : { _id: m.userId, fullName: "Member" };
                if (u.isBot) return null; // the bot can't administer a group
                return (
                  <option key={u._id} value={u._id}>
                    {u.fullName}
                  </option>
                );
              })}
            </select>
            <div className="flex gap-2 mt-2">
              <button
                onClick={confirmLeaveWithSuccessor}
                disabled={!successorId}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs rounded py-2"
              >
                Make admin & leave
              </button>
              <button
                onClick={() => setShowSuccessor(false)}
                className="px-3 border border-slate-700 text-slate-300 text-xs rounded py-2 hover:bg-slate-700/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-slate-700/50 flex gap-2">
          <button
            onClick={handleLeave}
            className="flex-1 flex items-center justify-center gap-1.5 border border-slate-700 text-slate-300 rounded-lg py-2 text-sm hover:bg-slate-700/50"
          >
            <LogOutIcon className="w-4 h-4" /> Leave
          </button>
          {isCreator && (
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-1.5 border border-red-900 text-red-400 rounded-lg py-2 text-sm hover:bg-red-900/20"
            >
              <Trash2Icon className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupInfoModal;
