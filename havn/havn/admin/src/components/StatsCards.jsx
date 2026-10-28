import {
  UsersIcon,
  BanIcon,
  BadgeCheckIcon,
  MessageSquareIcon,
  UsersRoundIcon,
} from "lucide-react";

const CARDS = [
  { key: "totalUsers", label: "Users", icon: UsersIcon },
  { key: "bannedUsers", label: "Banned", icon: BanIcon },
  { key: "badgedUsers", label: "Badged", icon: BadgeCheckIcon },
  { key: "totalGroups", label: "Groups", icon: UsersRoundIcon },
  { key: "totalMessages", label: "Messages", icon: MessageSquareIcon },
];

const format = (n) => (typeof n === "number" ? n.toLocaleString() : "—");

function StatsCards({ stats, isLoading }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {CARDS.map(({ key, label, icon: Icon }) => (
        <div key={key} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Icon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">{label}</span>
          </div>
          <p className="text-2xl font-semibold text-slate-100">
            {isLoading && !stats ? "…" : format(stats?.[key])}
          </p>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;
