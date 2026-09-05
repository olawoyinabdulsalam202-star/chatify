// Renders the presence line for a contact: "Online", or "last seen 5m ago".
//
// Formatting lives on the client, not the server, because the string is
// relative to *now* — a value baked in at response time would freeze and read
// "last seen 2m ago" an hour later. The server sends the raw timestamp and this
// re-derives the phrasing on every render.
//
// Wording follows WhatsApp/Telegram: short and relative near the present, then
// coarser as it recedes, since "last seen 4271m ago" is useless to anyone.

export function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return null; // hidden by their privacy setting, or never seen

  const then = new Date(lastSeenAt).getTime();
  if (Number.isNaN(then)) return null;

  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);

  // Under a minute reads as "just now" rather than "0m ago". Clock skew between
  // server and device can make diffMs slightly negative, which this also covers.
  if (min < 1) return "last seen just now";
  if (min < 60) return `last seen ${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `last seen ${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day === 1) return "last seen yesterday";
  if (day < 7) return `last seen ${day}d ago`;

  // Beyond a week the exact figure stops being actionable, and a precise date
  // reveals more about someone's habits than the feature needs to.
  return "last seen a while ago";
}

// The single line shown under a name. `isOnline` comes from the live socket
// list, which always wins — a live connection is more current than any
// stored timestamp.
export function presenceLabel({ isOnline, lastSeenAt }) {
  if (isOnline) return "Online";
  return formatLastSeen(lastSeenAt) || "Offline";
}
