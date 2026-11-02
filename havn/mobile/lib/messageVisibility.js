import AsyncStorage from "@react-native-async-storage/async-storage";

const keyFor = (userId) => `havn.hiddenMessages.${userId}`;

export async function loadHiddenMessages(userId) {
  if (!userId) return [];
  try {
    const value = await AsyncStorage.getItem(keyFor(userId));
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function hideMessageForMe(userId, messageId) {
  if (!userId || !messageId) return [];
  const current = await loadHiddenMessages(userId);
  const next = [...new Set([...current, String(messageId)])];
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  return next;
}

export async function hideMessagesForMe(userId, messageIds) {
  if (!userId || !Array.isArray(messageIds) || !messageIds.length) return loadHiddenMessages(userId);
  const current = await loadHiddenMessages(userId);
  const next = [...new Set([...current, ...messageIds.map(String)])];
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  return next;
}
