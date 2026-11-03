import { format, isToday, isYesterday } from "date-fns";

export function formatLastSeen(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const day = isToday(date) ? "today" : isYesterday(date) ? "yesterday" : format(date, "MMM d");
  return `Last seen ${day} at ${format(date, "h:mm a")}`;
}

export function presenceLabel({ online, lastSeenAt }) {
  return online ? "Online" : formatLastSeen(lastSeenAt) || "";
}
