import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

let storySocketHandlers = null;
const viewedStoryIds = new Set();

export const useStoryStore = create((set, get) => ({
  feed: [], // [{ user, stories: [...] }]
  myStories: [],
  isLoading: false,
  viewerIndex: null, // { groupIndex, storyIndex } while the viewer modal is open

  // Clears every per-account field on logout so the next user on this tab
  // never sees the previous user's story feed.
  resetStoryState: () => {
    viewedStoryIds.clear();
    set({ feed: [], myStories: [], viewerIndex: null, isLoading: false });
  },

  getStoriesFeed: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/stories/feed");
      set({ feed: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load stories");
    } finally {
      set({ isLoading: false });
    }
  },

  getMyStories: async () => {
    try {
      const res = await axiosInstance.get("/stories/mine");
      set({ myStories: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load your stories");
    }
  },

  createStory: async ({ image, video, text, backgroundColor }) => {
    try {
      const res = await axiosInstance.post("/stories", { image, video, text, backgroundColor });
      set({ myStories: [res.data, ...get().myStories] });
      toast.success("Story posted");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to post story");
      return null;
    }
  },

  updateStory: async (storyId, { text, backgroundColor }) => {
    try {
      const res = await axiosInstance.put(`/stories/${storyId}`, { text, backgroundColor });
      set({ myStories: get().myStories.map((s) => (s._id === storyId ? res.data : s)) });
      toast.success("Story updated");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update story");
      return null;
    }
  },

  viewStory: async (storyId) => {
    if (viewedStoryIds.has(String(storyId))) return;
    viewedStoryIds.add(String(storyId));
    try {
      const res = await axiosInstance.post(`/stories/${storyId}/view`);
      set({
        feed: get().feed.map((group) => ({
          ...group,
          stories: group.stories.map((story) => story._id === storyId ? res.data : story),
        })),
      });
    } catch {
      viewedStoryIds.delete(String(storyId));
    }
  },

  toggleStoryLike: async (storyId) => {
    try {
      const res = await axiosInstance.post(`/stories/${storyId}/like`);
      const patchStory = (story) => story._id === storyId
        ? { ...story, likes: res.data.liked
          ? [...(story.likes || []).filter((like) => String(like.userId?._id || like.userId) !== String(useAuthStore.getState().authUser?._id)), { userId: useAuthStore.getState().authUser?._id, likedAt: new Date().toISOString() }]
          : (story.likes || []).filter((like) => String(like.userId?._id || like.userId) !== String(useAuthStore.getState().authUser?._id)) }
        : story;
      set({
        feed: get().feed.map((group) => ({ ...group, stories: group.stories.map(patchStory) })),
        myStories: get().myStories.map(patchStory),
      });
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Couldn't update your like.");
    }
  },

  sendStoryReply: async (receiverId, storyReply, text) => {
    const sent = await useChatStore.getState().sendMessage({ text, storyReply }, receiverId);
    if (!sent) throw new Error("Couldn't send your reply.");
    return sent;
  },

  deleteStory: async (storyId) => {
    try {
      await axiosInstance.delete(`/stories/${storyId}`);
      set({ myStories: get().myStories.filter((s) => s._id !== storyId) });
      toast.success("Story deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete story");
    }
  },

  getStoryViewers: async (storyId) => {
    try {
      const res = await axiosInstance.get(`/stories/${storyId}/viewers`);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load viewers");
      return { viewers: [], viewCount: 0, likeCount: 0 };
    }
  },

  openViewer: (groupIndex, storyIndex = 0) => set({ viewerIndex: { groupIndex, storyIndex } }),
  closeViewer: () => set({ viewerIndex: null }),

  subscribeToStoryEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    const handlers = {
      newStory: () => {
        // Someone posted — refresh the feed so their ring shows up.
        get().getStoriesFeed();
      },
      storyDeleted: ({ storyId }) => {
        set({
          feed: get()
            .feed.map((group) => ({ ...group, stories: group.stories.filter((s) => s._id !== storyId) }))
            .filter((group) => group.stories.length > 0),
        });
      },
      storyUpdated: (story) => {
        set({
          feed: get().feed.map((group) => ({
            ...group,
            stories: group.stories.map((s) => (s._id === story._id ? { ...s, ...story } : s)),
          })),
          myStories: get().myStories.map((s) => (s._id === story._id ? story : s)),
        });
      },
      storyViewed: ({ storyId, viewerId }) => {
        const addViewer = (story) => {
          if (story._id !== storyId || story.viewers?.some((viewer) => String(viewer.userId?._id || viewer.userId) === String(viewerId))) return story;
          return { ...story, viewers: [...(story.viewers || []), { userId: viewerId, viewedAt: new Date().toISOString() }] };
        };
        set({ myStories: get().myStories.map(addViewer) });
      },
      storyLiked: ({ storyId, likerId }) => {
        const update = (story) => story._id !== storyId || story.likes?.some((like) => String(like.userId?._id || like.userId) === String(likerId))
          ? story
          : { ...story, likes: [...(story.likes || []), { userId: likerId, likedAt: new Date().toISOString() }] };
        set({
          myStories: get().myStories.map(update),
          feed: get().feed.map((group) => ({ ...group, stories: group.stories.map(update) })),
        });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    storySocketHandlers = handlers;
  },

  // Releases the handler slot even when the socket is already gone — logout
  // nulls the socket before ChatPage unmounts, and an early return here would
  // leave the slot filled so the next login never re-subscribes.
  unsubscribeFromStoryEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!storySocketHandlers) return;
    if (socket) {
      Object.entries(storySocketHandlers).forEach(([event, handler]) => socket.off(event, handler));
    }
    storySocketHandlers = null;
  },
}));
