import { create } from "zustand";
import { api } from "../lib/api";

export const useStoryStore = create((set, get) => ({
  feed: [],
  mine: [],
  loading: false,
  error: "",
  load: async () => {
    set({ loading: true, error: "" });
    try {
      const [feed, mine] = await Promise.all([api("/stories/feed"), api("/stories/mine")]);
      set({ feed: Array.isArray(feed) ? feed : [], mine: Array.isArray(mine) ? mine : [] });
    } catch (error) { set({ error: error.message }); }
    finally { set({ loading: false }); }
  },
  create: async (payload) => {
    const story = await api("/stories", { method: "POST", body: payload });
    set({ mine: [story, ...get().mine] });
    return story;
  },
  viewed: async (storyId) => api(`/stories/${storyId}/view`, { method: "POST" }),
  like: async (storyId) => {
    const result = await api(`/stories/${storyId}/like`, { method: "POST" });
    const currentUserId = String((await import("./useAuthStore")).useAuthStore.getState().authUser?._id);
    const patch = (story) => String(story._id) !== String(storyId) ? story : {
      ...story,
      likes: result.liked
        ? [...(story.likes || []).filter((item) => String(item.userId?._id || item.userId) !== currentUserId), { userId: currentUserId, likedAt: new Date().toISOString() }]
        : (story.likes || []).filter((item) => String(item.userId?._id || item.userId) !== currentUserId),
    };
    set({ mine: get().mine.map(patch), feed: get().feed.map((group) => ({ ...group, stories: group.stories.map(patch) })) });
    return result;
  },
  viewers: async (storyId) => api(`/stories/${storyId}/viewers`),
}));
