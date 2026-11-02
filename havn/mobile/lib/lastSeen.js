export function formatLastSeen(value) {
  if (!value) return null;
  const elapsedMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes)) return null;
  if (elapsedMinutes < 1) return "last seen just now";
  if (elapsedMinutes < 60) return `last seen ${elapsedMinutes}m ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "last seen yesterday";
  if (days < 7) return `last seen ${days}d ago`;
  return "last seen a while ago";
}

export function presenceLabel({ online, lastSeenAt }) {
  return online ? "Online" : formatLastSeen(lastSeenAt) || "Offline";
}
