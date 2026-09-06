import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAdminStore } from "../store/useAdminStore";
import VerifiedBadge from "../components/VerifiedBadge";
import {
  ArrowLeftIcon,
  SearchIcon,
  BanIcon,
  CheckCircleIcon,
  Trash2Icon,
  BadgeCheckIcon,
  UsersIcon,
} from "lucide-react";

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-100">{value ?? "—"}</p>
    </div>
  );
}

function BanModal({ user, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-slate-100 font-medium mb-3">Ban {user.fullName}?</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional, shown to the user)"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 mb-4"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Ban user
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboardPage() {
  const {
    users,
    total,
    page,
    pages,
    search,
    filter,
    stats,
    isLoading,
    setSearch,
    setFilter,
    fetchStats,
    fetchUsers,
    banUser,
    unbanUser,
    deleteUser,
    setUserBadge,
  } = useAdminStore();

  const [banningUser, setBanningUser] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchUsers(1), 350); // debounce search
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  const handleDelete = (user) => {
    if (window.confirm(`Permanently delete ${user.fullName}'s account? This can't be undone.`)) {
      deleteUser(user._id);
    }
  };

  return (
    <div className="relative z-10 min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-slate-400 hover:text-slate-200">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-cyan-400" /> Admin dashboard
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Users" value={stats?.totalUsers} />
          <StatCard label="Banned" value={stats?.bannedUsers} />
          <StatCard label="Badged" value={stats?.badgedUsers} />
          <StatCard label="Groups" value={stats?.totalGroups} />
          <StatCard label="Messages" value={stats?.totalMessages} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username…"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 pl-9 pr-4 text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm"
          >
            <option value="all">All users</option>
            <option value="banned">Banned</option>
            <option value="badged">Badged</option>
            <option value="admins">Admins</option>
          </select>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-t border-slate-700/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={u.profilePic || "/avatar.svg"}
                          alt={u.fullName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <span className="flex items-center gap-1">
                          {u.fullName}
                          {u.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
                          {u.isAdmin && (
                            <span className="text-[10px] uppercase bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                              admin
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-400">{u.email}</td>
                    <td className="px-4 py-2">
                      {u.isBanned ? (
                        <span className="text-red-400 text-xs">
                          Banned{u.banReason ? `: ${u.banReason}` : ""}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-xs">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title={u.isBadged ? "Remove badge" : "Grant badge"}
                          onClick={() => setUserBadge(u._id, !u.isBadged)}
                          className={`p-1.5 rounded-lg hover:bg-slate-700/50 ${
                            u.isBadged ? "text-cyan-400" : "text-slate-500"
                          }`}
                        >
                          <BadgeCheckIcon className="w-4 h-4" />
                        </button>
                        {u.isBanned ? (
                          <button
                            title="Unban"
                            onClick={() => unbanUser(u._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-emerald-400"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            title="Ban"
                            disabled={u.isAdmin}
                            onClick={() => setBanningUser(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <BanIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          title="Delete"
                          disabled={u.isAdmin}
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => fetchUsers(page - 1)}
              className="px-3 py-1 rounded-lg bg-slate-800/50 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-slate-400">
              Page {page} of {pages} · {total} users
            </span>
            <button
              disabled={page >= pages}
              onClick={() => fetchUsers(page + 1)}
              className="px-3 py-1 rounded-lg bg-slate-800/50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {banningUser && (
        <BanModal
          user={banningUser}
          onClose={() => setBanningUser(null)}
          onConfirm={(reason) => {
            banUser(banningUser._id, reason);
            setBanningUser(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminDashboardPage;
