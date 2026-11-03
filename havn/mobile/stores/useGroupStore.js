import { create } from "zustand";
import { api } from "../lib/api";
import { clearCache, readCache, writeCache } from "../lib/cache";

const merge = (items, message) => [...items.filter((item) => String(item._id) !== String(message._id)), message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
const latest = (messages) => (Array.isArray(messages) ? messages : []).slice(-200);

function cacheGroups(get, groups = get().groups, unread = get().unread) {
  writeCache("groups", { groups, unread });
}

function cacheGroupMessages(get, id) {
  writeCache(`groupMessages.${id}`, latest(get().messages));
}

export const useGroupStore = create((set, get) => ({
  groups: [],
  messages: [],
  selectedId: null,
  unread: {},
  isLoading: false,
  cacheHydrated: false,
  load: async ({ quiet = false } = {}) => {
    if (!get().cacheHydrated) {
      const cached = await readCache("groups");
      if (cached && Array.isArray(cached.groups)) set({ groups: cached.groups.filter(Boolean), unread: cached.unread || {}, cacheHydrated: true });
      else set({ cacheHydrated: true });
    }
    if (!quiet) set({ isLoading: !get().groups.length });
    try {
      const response = await api("/groups");
      const old = get().groups;
      const groups = (Array.isArray(response) ? response : []).filter(Boolean).map((group) => {
        const previous = old.find((item) => String(item._id) === String(group._id));
        return { ...previous, ...group };
      });
      set({ groups });
      cacheGroups(get, groups);
    } catch (error) {
      if (error.status && !quiet && !get().groups.length) throw error;
    } finally {
      if (!quiet) set({ isLoading: false });
    }
  },
  open: async (id) => {
    const key = String(id);
    if (!get().cacheHydrated) {
      const cached = await readCache("groups");
      if (cached && Array.isArray(cached.groups)) set({ groups: cached.groups.filter(Boolean), unread: cached.unread || {}, cacheHydrated: true });
      else set({ cacheHydrated: true });
      get().load({ quiet: true });
    }
    const cachedGroup = get().groups.find((item) => String(item._id) === key) || null;
    const cachedMessages = await readCache(`groupMessages.${key}`);
    const hasCachedMessages = Array.isArray(cachedMessages);
    const unread = { ...get().unread, [key]: 0 };
    set({ selectedId: key, messages: hasCachedMessages ? latest(cachedMessages) : get().selectedId === key ? get().messages : [], unread });
    cacheGroups(get, get().groups, unread);
    const refresh = async () => {
      const [groupResult, messageResult] = await Promise.all([api(`/groups/${key}`), api(`/groups/${key}/messages`)]);
      const group = groupResult || cachedGroup;
      const messages = hasCachedMessages ? merge(cachedMessages, Array.isArray(messageResult) ? messageResult : []) : latest(messageResult);
      const groups = group ? get().groups.map((item) => String(item._id) === key ? { ...item, ...group } : item) : get().groups;
      set({ groups, ...(String(get().selectedId) === key ? { messages: latest(messages) } : {}) });
      cacheGroups(get, groups);
      writeCache(`groupMessages.${key}`, latest(messages));
      return group;
    };
    if (cachedGroup) {
      refresh().catch(() => {});
      return cachedGroup;
    }
    try {
      return await refresh();
    } catch (error) {
      throw error;
    }
  },
  close: () => { if (get().selectedId === null) return; set({ selectedId: null }); },
  clearUnread: (id) => {
    const key = String(id);
    if (!(Number(get().unread[key]) || 0)) return;
    const unread = { ...get().unread, [key]: 0 };
    set({ unread });
    cacheGroups(get, get().groups, unread);
  },
  removeGroup: (id) => {
    const key = String(id);
    const groups = get().groups.filter((item) => String(item._id) !== key);
    const unread = { ...get().unread };
    delete unread[key];
    set({ groups, unread, ...(get().selectedId === key ? { selectedId: null, messages: [] } : {}) });
    cacheGroups(get, groups, unread);
    clearCache(`groupMessages.${key}`);
  },
  syncOpenGroup: async () => {
    const id = get().selectedId;
    if (!id) return;
    try {
      const messages = await api(`/groups/${id}/messages`);
      if (String(get().selectedId) !== String(id)) return;
      set({ messages: merge(get().messages, Array.isArray(messages) ? messages : []).slice(-200) });
      cacheGroupMessages(get, id);
    } catch {}
  },
  receive: (message) => {
    const key = String(message.groupId);
    if (String(get().selectedId) === key) {
      set({ messages: merge(get().messages, message).slice(-200) });
      cacheGroupMessages(get, key);
    } else {
      const unread = { ...get().unread, [key]: (get().unread[key] || 0) + 1 };
      set({ unread });
      cacheGroups(get, get().groups, unread);
    }
    const groups = get().groups.map((group) => String(group._id) === key ? { ...group, lastMessage: message } : group);
    set({ groups });
    cacheGroups(get, groups);
  },
  send: async (id, payload) => {
    const message = await api(`/groups/${id}/messages`, { method: "POST", body: payload });
    set({ messages: merge(get().messages, message).slice(-200) });
    cacheGroupMessages(get, id);
    return message;
  },
  editMessage: (message) => { set({ messages: get().messages.map((item) => String(item._id) === String(message._id) ? { ...item, ...message } : item) }); if (get().selectedId) cacheGroupMessages(get, get().selectedId); },
  setGroups: (groups) => { set({ groups }); cacheGroups(get, groups); },
}));
