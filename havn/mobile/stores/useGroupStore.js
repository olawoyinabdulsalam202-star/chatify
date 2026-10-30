import { create } from "zustand";
import { api } from "../lib/api";

const merge = (items, message) => [...items.filter((item) => String(item._id) !== String(message._id)), message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

export const useGroupStore = create((set, get) => ({
  groups: [],
  messages: [],
  selectedId: null,
  unread: {},
  load: async () => { const groups = await api("/groups"); set({ groups: Array.isArray(groups) ? groups : [] }); },
  open: async (id) => {
    set({ selectedId: String(id), messages: [], unread: { ...get().unread, [String(id)]: 0 } });
    const [group, messages] = await Promise.all([api(`/groups/${id}`), api(`/groups/${id}/messages`)]);
    set({ groups: get().groups.map((item) => String(item._id) === String(id) ? group : item), messages: Array.isArray(messages) ? messages : [] });
    return group;
  },
  close: () => set({ selectedId: null }),
  receive: (message) => {
    if (String(get().selectedId) === String(message.groupId)) set({ messages: merge(get().messages, message) });
    else set({ unread: { ...get().unread, [String(message.groupId)]: (get().unread[String(message.groupId)] || 0) + 1 } });
    set({ groups: get().groups.map((group) => String(group._id) === String(message.groupId) ? { ...group, lastMessage: message } : group) });
  },
  send: async (id, payload) => {
    const message = await api(`/groups/${id}/messages`, { method: "POST", body: payload });
    set({ messages: merge(get().messages, message) });
    return message;
  },
  editMessage: (message) => set({ messages: get().messages.map((item) => String(item._id) === String(message._id) ? { ...item, ...message } : item) }),
  setGroups: (groups) => set({ groups }),
}));
