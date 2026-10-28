// Turns a Date into the short "last seen" phrasing every list uses, in the
// same relative style as WhatsApp. Shared so the contact list, chats list and
// chat header can't drift apart in wording.
export function formatLastSeen(date, now = Date.now()) {
  if (!date) return "offline";
  const diffMs = now - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "online";
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `last seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "last seen yesterday";
  if (diffDay < 7) return `last seen ${diffDay}d ago`;
  return "last seen a while ago";
}
