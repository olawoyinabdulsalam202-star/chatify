import { useEffect, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { HashIcon, MegaphoneIcon, PlusIcon, CheckIcon, XIcon } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import CreateGroupModal from "./CreateGroupModal";

function GroupsList() {
  const {
    groups,
    isGroupsLoading,
    getMyGroups,
    setSelectedGroup,
    selectedGroup,
    receivedGroupInvites,
    respondToGroupInvite,
  } = useGroupStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getMyGroups();
  }, [getMyGroups]);

  return (
    <>
      {receivedGroupInvites.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-xs uppercase text-slate-500 font-medium px-1">
            Invites ({receivedGroupInvites.length})
          </p>
          {receivedGroupInvites.map((invite) => (
            <div key={invite.inviteId} className="bg-cyan-500/10 p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {invite.group.avatar ? (
                    <img src={invite.group.avatar} alt={invite.group.name} className="size-full object-cover" />
                  ) : invite.group.type === "channel" ? (
                    <MegaphoneIcon className="w-4 h-4 text-slate-400" />
                  ) : (
                    <HashIcon className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-slate-200 text-sm font-medium truncate">{invite.group.name}</h4>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    Invited by {invite.from.fullName}
                    {invite.from.isBadged && <VerifiedBadge className="w-3 h-3" />}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => respondToGroupInvite(invite.inviteId, "accept")}
                    className="p-2 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors"
                    title="Accept"
                  >
                    <CheckIcon className="size-4" />
                  </button>
                  <button
                    onClick={() => respondToGroupInvite(invite.inviteId, "decline")}
                    className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-400 transition-colors"
                    title="Decline"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="w-full flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg p-3 mb-2 transition-colors text-sm font-medium"
      >
        <PlusIcon className="w-4 h-4" />
        New group or channel
      </button>

      {isGroupsLoading ? (
        <p className="text-slate-500 text-sm text-center py-6">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">
          No groups yet — create one to get started.
        </p>
      ) : (
        groups.map((group) => (
          <div
            key={group._id}
            onClick={() => setSelectedGroup(group)}
            className={`p-4 rounded-lg cursor-pointer transition-colors ${
              selectedGroup?._id === group._id
                ? "bg-cyan-500/25 ring-1 ring-cyan-500/40"
                : "bg-cyan-500/10 hover:bg-cyan-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                {group.avatar ? (
                  <img src={group.avatar} alt={group.name} className="size-full object-cover" />
                ) : group.type === "channel" ? (
                  <MegaphoneIcon className="w-5 h-5 text-slate-400" />
                ) : (
                  <HashIcon className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-slate-200 font-medium truncate flex items-center gap-1">
                  {group.name}
                  {group.creatorIsBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
                </h4>
                <p className="text-slate-500 text-xs">
                  {group.type === "channel" ? "Channel" : "Group"} · {group.members.length} members
                </p>
              </div>
            </div>
          </div>
        ))
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </>
  );
}

export default GroupsList;
