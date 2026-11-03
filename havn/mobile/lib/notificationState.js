let activeContext = null;

export function setActiveNotificationContext(context) {
  activeContext = context || null;
}

export function clearActiveNotificationContext(kind, id) {
  if (activeContext?.kind === kind && (!id || String(activeContext.id) === String(id))) activeContext = null;
}

export function isNotificationTargetOpen(data = {}) {
  if (!activeContext) return false;
  const kind = data.kind;
  if (["dm", "status-reply"].includes(kind)) return activeContext.kind === "dm" && String(activeContext.id) === String(data.chatId);
  if (kind === "group" || kind === "group-added" || (kind === "reaction" && (data.targetType === "group" || data.groupId))) {
    return activeContext.kind === "group" && String(activeContext.id) === String(data.groupId || data.chatId);
  }
  if (kind === "reaction") return activeContext.kind === "dm" && String(activeContext.id) === String(data.chatId);
  if (kind === "status" || kind === "status-new") {
    return activeContext.kind === "status" && (String(activeContext.storyId) === String(data.storyId || data.chatId) || String(activeContext.authorId) === String(data.authorId));
  }
  if (kind === "friend") return activeContext.kind === "dm" && String(activeContext.id) === String(data.chatId);
  return false;
}
