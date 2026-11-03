import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_POINTER_KEY = "havn.cache.userId";
const timers = new Map();

async function activeUserId() {
  try {
    const { useAuthStore } = await import("../stores/useAuthStore");
    const userId = useAuthStore.getState().authUser?._id;
    if (userId) {
      await AsyncStorage.setItem(USER_POINTER_KEY, String(userId));
      return String(userId);
    }
  } catch {}
  return AsyncStorage.getItem(USER_POINTER_KEY).catch(() => null);
}

function keyFor(userId, name) {
  return `havn.cache.${userId}.${name}`;
}

export async function readCache(name) {
  try {
    const userId = await activeUserId();
    if (!userId) return null;
    const value = await AsyncStorage.getItem(keyFor(userId, name));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function writeCache(name, value) {
  try {
    const userId = await activeUserId();
    if (!userId) return;
    const key = keyFor(userId, name);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(async () => {
      timers.delete(key);
      try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
    }, 500));
  } catch {}
}

export async function clearCache(prefix = "", userId = null) {
  try {
    const id = userId ? String(userId) : await activeUserId();
    if (!id) return;
    const cachePrefix = `havn.cache.${id}.${prefix}`;
    for (const [key, timer] of timers) {
      if (key.startsWith(cachePrefix)) {
        clearTimeout(timer);
        timers.delete(key);
      }
    }
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(cachePrefix));
    if (keys.length) await AsyncStorage.multiRemove(keys);
    if (!prefix) {
      const pointer = await AsyncStorage.getItem(USER_POINTER_KEY).catch(() => null);
      if (pointer === id) await AsyncStorage.removeItem(USER_POINTER_KEY);
    }
  } catch {}
}
