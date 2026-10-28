import {
  BadgeCheckIcon,
  BanIcon,
  Trash2Icon,
  ShieldIcon,
  RotateCcwIcon,
  LoaderIcon,
} from "lucide-react";

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function Avatar({ user }) {
  if (user.profilePic) {
    return (
      <img
        src={user.profilePic}
        alt={user.fullName}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }
  const initial = (user.fullName || user.username || "?").charAt(0).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-medium shrink-0">
      {initial}
    </div>
  );
}

function Tag({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-700 text-slate-300",
    accent: "bg-cyan-500/15 text-cyan-300",
    danger: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

function UsersTable({ users, actioningId, onBan, onUnban, onDelete, onBadge }) {
  if (users.length === 0) {
    return (
      <div className="text-center text-slate-400 py-16 border border-slate-800 rounded-xl">
        No users match this view.
      </div>
    );
  }

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400 text-left">
              <th className="font-medium px-4 py-3">User</th>
              <th className="font-medium px-4 py-3">Status</th>
              <th className="font-medium px-4 py-3 whitespace-nowrap">Joined</th>
              <th className="font-medium px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const busy = actioningId === user._id;
              return (
                <tr key={user._id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <div className="text-slate-200 truncate">
                          {user.username ? `@${user.username}` : user.fullName}
                        </div>
                        <div className="text-slate-500 text-xs truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {user.isAdmin && (
                        <Tag tone="accent">
                          <ShieldIcon className="w-3 h-3 mr-1" />
                          Admin
                        </Tag>
                      )}
                      {user.isBadged && <Tag tone="accent">Badged</Tag>}
                      {user.isBanned && <Tag tone="danger">Banned</Tag>}
                      {!user.isAdmin && !user.isBadged && !user.isBanned && (
                        <Tag>Member</Tag>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {busy ? (
                        <LoaderIcon className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onBadge(user._id, !user.isBadged)}
                            title={user.isBadged ? "Remove badge" : "Grant badge"}
                            className={`p-1.5 rounded-lg hover:bg-slate-700 transition-colors ${
                              user.isBadged ? "text-cyan-400" : "text-slate-400"
                            }`}
                          >
                            <BadgeCheckIcon className="w-4 h-4" />
                          </button>

                          {user.isBanned ? (
                            <button
                              type="button"
                              onClick={() => onUnban(user._id)}
                              title="Unban"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                              <RotateCcwIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBan(user)}
                              disabled={user.isAdmin}
                              title={user.isAdmin ? "Can't ban an admin" : "Ban"}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            >
                              <BanIcon className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDelete(user)}
                            disabled={user.isAdmin}
                            title={user.isAdmin ? "Can't delete an admin" : "Delete"}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UsersTable;
