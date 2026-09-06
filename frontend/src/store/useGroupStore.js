import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

let groupSocketHandlers = null;

// Monotonic counter for optimistic message ids. `temp-${Date.now()}` collides
// when two messages are sent inside the same millisecond (double-tap Enter, or
// send-then-send on a fast connection): both get the same _id, React warns about
// duplicate keys, and the reconcile step then strips BOTH while appending only
// one server message — so a message silently vanishes until reload.
let tempIdCounter = 0;
const nextTempId = () => `temp-${Date.now()}-${++tempIdCounter}`;

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isGroupsLoading: false,
  isGroupMessagesLoading: false,
  replyTarget: null,
  botTypingGroupId: null,
  receivedGroupInvites: [], // pending invites addressed to me: [{ inviteId, group, from }]
  pendingGroupInvites: [], // for the currently open group's admin view: [{ inviteId, to }]
  viewOnceCache: {}, // messageId -> { imageUrl, videoUrl, duration }, memory only

  setReplyTarget: (message) => set({ replyTarget: message }),
  clearReplyTarget: () => set({ replyTarget: null }),

  setSelectedGroup: (group) => set({ selectedGroup: group, groupMessages: [] }),

  // Clears every per-account field on logout so the next user on this tab
  // never sees the previous user's groups or messages.
  resetGroupState: () =>
    set({
      groups: [],
      selectedGroup: null,
      groupMessages: [],
      replyTarget: null,
      botTypingGroupId: null,
      receivedGroupInvites: [],
      pendingGroupInvites: [],
      viewOnceCache: {},
    }),

  fetchGroupDetails: async (groupId) => {
    try {
      const res = await axiosInstance.get(`/groups/${groupId}`);
      set({
        selectedGroup: res.data,
        groups: get().groups.map((g) => (g._id === groupId ? { ...g, ...res.data } : g)),
      });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load group details");
      return null;
    }
  },

  getMyGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async ({ name, description, avatar, type, memberIds }) => {
    try {
      const res = await axiosInstance.post("/groups", { name, description, avatar, type, memberIds });
      // Filter before prepending, exactly like the message reconcile.
      //
      // The server joins the creator's sockets to the new group room and then
      // emits "groupCreated" to that room, so the creator receives an echo of
      // their own group. When that echo wins the race against this response,
      // the groupCreated handler finds no match (the list is still empty) and
      // inserts it — and this line then prepended a second, identical copy.
      // That's the group appearing twice from a single create.
      set({ groups: [res.data, ...get().groups.filter((g) => g._id !== res.data._id)] });
      toast.success(`${type === "channel" ? "Channel" : "Group"} created`);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return null;
    }
  },

  updateGroup: async (groupId, data) => {
    try {
      const res = await axiosInstance.put(`/groups/${groupId}`, data);
      set({
        groups: get().groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: get().selectedGroup?._id === groupId ? res.data : get().selectedGroup,
      });
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
    }
  },

  inviteMembers: async (groupId, memberIds) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/invites`, { memberIds });
      toast.success(res.data.message || "Invites sent");
      get().fetchGroupPendingInvites(groupId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send invites");
    }
  },

  fetchGroupPendingInvites: async (groupId) => {
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/invites`);
      set({ pendingGroupInvites: res.data });
    } catch (error) {
      console.log("Error fetching pending group invites:", error);
    }
  },

  cancelGroupInvite: async (groupId, inviteId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}/invites/${inviteId}`);
      set({ pendingGroupInvites: get().pendingGroupInvites.filter((i) => i.inviteId !== inviteId) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel invite");
    }
  },

  // Invites addressed to me, from any group.
  fetchMyGroupInvites: async () => {
    try {
      const res = await axiosInstance.get("/groups/invites");
      set({ receivedGroupInvites: res.data });
    } catch (error) {
      console.log("Error fetching group invites:", error);
    }
  },

  respondToGroupInvite: async (inviteId, action) => {
    try {
      const res = await axiosInstance.put(`/groups/invites/${inviteId}/respond`, { action });
      set({ receivedGroupInvites: get().receivedGroupInvites.filter((i) => i.inviteId !== inviteId) });
      if (action === "accept") {
        set({ groups: get().groups.some((g) => g._id === res.data._id) ? get().groups : [res.data, ...get().groups] });
        toast.success(`You've joined ${res.data.name}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't respond to invite");
    }
  },

  // `newAdminId` is only meaningful when the last admin is leaving: it names
  // who inherits the group. The server falls back to the longest-standing
  // member if it's omitted, so passing nothing is always safe.
  removeMember: async (groupId, memberId, newAdminId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}`, {
        // DELETE carries a body only via the `data` key in axios.
        data: newAdminId ? { newAdminId } : undefined,
      });
      const { authUser } = useAuthStore.getState();

      // The last member out deletes the group server-side.
      if (res.data?.deleted) {
        set({
          groups: get().groups.filter((g) => g._id !== groupId),
          selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup,
          groupMessages: get().selectedGroup?._id === groupId ? [] : get().groupMessages,
        });
        return;
      }

      if (memberId === authUser._id) {
        // left/removed from the group ourselves
        set({
          groups: get().groups.filter((g) => g._id !== groupId),
          selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup,
        });
      } else {
        set({
          groups: get().groups.map((g) => (g._id === groupId ? res.data : g)),
          selectedGroup: get().selectedGroup?._id === groupId ? res.data : get().selectedGroup,
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  },

  setMemberRole: async (groupId, memberId, role) => {
    try {
      const res = await axiosInstance.put(`/groups/${groupId}/members/${memberId}/role`, { role });
      set({
        groups: get().groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: get().selectedGroup?._id === groupId ? res.data : get().selectedGroup,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change role");
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}`);
      set({
        groups: get().groups.filter((g) => g._id !== groupId),
        selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup,
      });
      toast.success("Group deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete group");
    }
  },

  getGroupMessages: async (groupId) => {
    set({ isGroupMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      set({ groupMessages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isGroupMessagesLoading: false });
    }
  },

  sendGroupMessage: async (messageData) => {
    const { selectedGroup, groupMessages, replyTarget } = get();
    const { authUser } = useAuthStore.getState();
    const tempId = nextTempId();

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      groupId: selectedGroup._id,
      text: messageData.text,
      // A view-once attachment is never shown in the sender's own bubble — the
      // server redacts it from every payload, so echoing the local copy here
      // would show the sender something nobody else can see.
      image: messageData.viewOnce ? undefined : messageData.image,
      video: messageData.viewOnce ? undefined : messageData.video,
      videoDuration: messageData.videoDuration,
      viewOnce: !!messageData.viewOnce,
      viewOnceIsVideo: !!(messageData.viewOnce && messageData.video),
      viewOnceViewerCount: 0,
      gif: messageData.gif,
      sticker: messageData.sticker,
      audio: messageData.audio,
      audioDuration: messageData.audioDuration,
      createdAt: new Date().toISOString(),
      replyTo: replyTarget
        ? {
            messageId: replyTarget._id,
            senderId: replyTarget.senderId,
            text: replyTarget.isDeleted
              ? "This message was deleted"
              : replyTarget.text ||
                (replyTarget.viewOnce
                  ? "👁 View-once"
                  : replyTarget.image
                  ? "📷 Photo"
                  : replyTarget.video
                  ? "📹 Video"
                  : replyTarget.audio
                  ? "🎤 Voice note"
                  : replyTarget.sticker
                  ? "Sticker"
                  : "GIF"),
          }
        : undefined,
      isOptimistic: true,
    };

    set({ groupMessages: [...groupMessages, optimisticMessage], replyTarget: null });

    try {
      const res = await axiosInstance.post(`/groups/${selectedGroup._id}/messages`, {
        ...messageData,
        replyToId: replyTarget?._id,
      });
      // Drop the optimistic copy AND any copy of the real message that the
      // socket echo already inserted, then append exactly one.
      //
      // The server broadcasts newGroupMessage to the whole group room and the
      // sender is in that room, so the echo of your own message usually beats
      // this response. The echo's dedupe check compares real _ids against a
      // list that still only holds `temp-…`, so it finds no match and appends.
      // Filtering on tempId alone then left that echoed copy in place and
      // concat added a second one — two identical _ids, which is the React
      // "two children with the same key" warning and the message appearing 2x.
      set({
        groupMessages: [
          ...get().groupMessages.filter((m) => m._id !== tempId && m._id !== res.data._id),
          res.data,
        ],
      });
    } catch (error) {
      set({ groupMessages: get().groupMessages.filter((m) => m._id !== tempId) });
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  editGroupMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/edit/${messageId}`, { text });
      set({ groupMessages: get().groupMessages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
    }
  },

  deleteGroupMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/delete/${messageId}`);
      set({ groupMessages: get().groupMessages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  // Reveals a group view-once message for this member.
  //
  // Group view-once is "once each": the server records this member as having
  // viewed it and only destroys the media after every member has. The URL comes
  // back exactly once and is held in memory here — never persisted — so closing
  // the tab really does lose it.
  openGroupViewOnce: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/view-once/${messageId}`);
      const media = {
        imageUrl: res.data.imageUrl || null,
        videoUrl: res.data.videoUrl || null,
        duration: res.data.duration || null,
      };
      set({
        viewOnceCache: { ...get().viewOnceCache, [messageId]: media },
        // Mark it used for this member so the bubble can't offer a second open
        // after a refetch replaces the list.
        groupMessages: get().groupMessages.map((m) =>
          m._id === messageId ? { ...m, viewOnceOpenedByMe: true } : m
        ),
      });
      return media;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't open this");
      return null;
    }
  },

  toggleGroupReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.put(`/messages/react/${messageId}`, { emoji });
      set({ groupMessages: get().groupMessages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to react");
    }
  },

  subscribeToGroupEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    const handlers = {
      newGroupMessage: (message) => {
        const { selectedGroup, groupMessages } = get();
        if (selectedGroup && message.groupId === selectedGroup._id) {
          if (groupMessages.some((m) => m._id === message._id)) return; // already have it (optimistic/REST echo)
          set({ groupMessages: [...groupMessages, message] });
          if (message.senderId?.isBot && get().botTypingGroupId === selectedGroup._id) {
            set({ botTypingGroupId: null });
          }
        }
      },
      messageEdited: (updatedMessage) => {
        if (!updatedMessage.groupId) return; // handled by useChatStore
        set({
          groupMessages: get().groupMessages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        });
      },
      messageDeleted: (updatedMessage) => {
        if (!updatedMessage.groupId) return; // handled by useChatStore
        set({
          groupMessages: get().groupMessages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        });
      },
      messageReaction: (updatedMessage) => {
        if (!updatedMessage.groupId) return; // handled by useChatStore
        set({
          groupMessages: get().groupMessages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        });
      },
      // Someone in the group opened a view-once message. Updates the "N viewed"
      // count for everyone, and once `destroyed` arrives the media is gone
      // server-side for good — so the bubble must stop offering an open to
      // anyone who never used their view.
      viewOnceOpened: ({ messageId, groupId, viewerCount, destroyed }) => {
        if (!groupId) return; // DM version is handled by useChatStore
        set({
          groupMessages: get().groupMessages.map((m) =>
            m._id === messageId
              ? {
                  ...m,
                  viewOnceViewerCount: viewerCount ?? m.viewOnceViewerCount,
                  // Only flip the per-member flag when the media is actually
                  // gone. Flipping it on someone else's open would wrongly tell
                  // this member they'd already looked.
                  viewOnceOpenedByMe: destroyed ? true : m.viewOnceOpenedByMe,
                  viewOnceOpened: destroyed ? true : m.viewOnceOpened,
                }
              : m
          ),
        });
      },
      groupInviteReceived: ({ inviteId, group, from }) => {
        set({ receivedGroupInvites: [{ inviteId, group, from }, ...get().receivedGroupInvites] });
        toast(`${from.fullName} invited you to join "${group.name}"`, { icon: "📨" });
      },
      groupCreated: (group) => {
        if (!get().groups.some((g) => g._id === group._id)) {
          set({ groups: [group, ...get().groups] });
        }
      },
      groupUpdated: (group) => {
        set({
          groups: get().groups.map((g) => (g._id === group._id ? group : g)),
          selectedGroup: get().selectedGroup?._id === group._id ? group : get().selectedGroup,
        });
      },
      groupDeleted: ({ groupId }) => {
        set({
          groups: get().groups.filter((g) => g._id !== groupId),
          selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup,
        });
      },
      botTyping: ({ groupId }) => {
        if (get().selectedGroup?._id === groupId) set({ botTypingGroupId: groupId });
      },
      botStopTyping: ({ groupId }) => {
        if (get().botTypingGroupId === groupId) set({ botTypingGroupId: null });
      },
      // Re-sync the open group's messages after any socket reconnect, so a
      // dev-server restart or brief network drop can never silently lose a
      // message that arrived during the gap.
      connect: () => {
        const { selectedGroup } = get();
        if (selectedGroup) get().getGroupMessages(selectedGroup._id);
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    groupSocketHandlers = handlers;
  },

  // Releases the handler slot even when the socket is already gone — logout
  // nulls the socket before ChatPage unmounts, and an early return here would
  // leave the slot filled so the next login never re-subscribes.
  unsubscribeFromGroupEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!groupSocketHandlers) return;
    if (socket) {
      Object.entries(groupSocketHandlers).forEach(([event, handler]) => socket.off(event, handler));
    }
    groupSocketHandlers = null;
  },
}));
