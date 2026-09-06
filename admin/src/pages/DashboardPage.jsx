import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  LogOutIcon,
  SearchIcon,
  LoaderIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanIcon,
  Trash2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { useAdminAuthStore } from "../store/useAdminAuthStore";
import { useAdminStore } from "../store/useAdminStore";
import StatsCards from "../components/StatsCards";
import UsersTable from "../components/UsersTable";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "banned", label: "Banned" },
  { key: "badged", label: "Badged" },
  { key: "admins", label: "Admins" },
];

function DashboardPage() {
  const { authUser, logout } = useAdminAuthStore();
  const {
    stats,
    isLoadingStats,
    users,
    total,
    pages,
    query,
    isLoadingUsers,
    actioningId,
    getStats,
    getUsers,
    banUser,
    unbanUser,
    setBadge,
    deleteUser,
  } = useAdminStore();

  const [searchInput, setSearchInput] = useState("");
  // { type: "ban" | "delete", user } — drives the confirmation modal.
  const [pending, setPending] = useState(null);
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    getStats();
    getUsers();
  }, [getStats, getUsers]);

  // Debounced search — one request after typing settles, resetting to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query.search) getUsers({ search: searchInput, page: 1 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const openBan = (user) => {
    setBanReason("");
    setPending({ type: "ban", user });
  };

  const confirmPending = async () => {
    if (!pending) return;
    const { type, user } = pending;
    setPending(null);
    if (type === "ban") await banUser(user._id, banReason.trim());
    if (type === "delete") await deleteUser(user._id);
  };

  const page = query.page;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100 leading-tight">Havn Admin</h1>
              <p className="text-xs text-slate-500 leading-tight">
                {authUser?.username ? `@${authUser.username}` : authUser?.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <StatsCards stats={stats} isLoading={isLoadingStats} />

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name…"
                className="input pl-9"
              />
            </div>

            <div className="flex gap-1 bg-slate-800 rounded-lg p-1 shrink-0">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => getUsers({ filter: f.key, page: 1 })}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    query.filter === f.key
                      ? "bg-cyan-500 text-white"
                      : "text-slate-300 hover:text-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoadingUsers && users.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <LoaderIcon className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : (
            <UsersTable
              users={users}
              actioningId={actioningId}
              onBan={openBan}
              onUnban={unbanUser}
              onBadge={setBadge}
              onDelete={(user) => setPending({ type: "delete", user })}
            />
          )}

          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>{total.toLocaleString()} total</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isLoadingUsers}
                onClick={() => getUsers({ page: page - 1 })}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages || isLoadingUsers}
                onClick={() => getUsers({ page: page + 1 })}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {pending && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-20"
          onClick={() => setPending(null)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  pending.type === "delete"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-cyan-500/15 text-cyan-400"
                }`}
              >
                {pending.type === "delete" ? (
                  <Trash2Icon className="w-5 h-5" />
                ) : (
                  <BanIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {pending.type === "delete" ? "Delete user" : "Ban user"}
                </h2>
                <p className="text-sm text-slate-400">
                  {pending.user.username ? `@${pending.user.username}` : pending.user.fullName}
                </p>
              </div>
            </div>

            {pending.type === "delete" ? (
              <div className="flex items-start gap-2 text-sm text-slate-300 bg-red-500/10 rounded-lg p-3 mb-5">
                <AlertTriangleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>
                  This permanently removes the account, its messages, and its stories, and drops it
                  from every group. This can't be undone.
                </span>
              </div>
            ) : (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={3}
                  placeholder="Shown to the user when they're signed out."
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                  pending.type === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-cyan-500 hover:bg-cyan-600"
                }`}
              >
                {pending.type === "delete" ? "Delete" : "Ban"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
