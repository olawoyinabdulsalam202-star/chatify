import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

// Recently-used stickers live only on this device — they're a convenience, not
// account state, so localStorage is the right home. Capped so the list stays a
// quick-access row rather than a second full tray.
const RECENTS_KEY = "stickerRecents";
const RECENTS_CAP = 24;

const loadRecents = () => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
};

const saveRecents = (recents) => {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // A full or unavailable storage just means no recents — not worth a toast.
  }
};

export const useStickerStore = create((set, get) => ({
  stickers: [], // the account's saved + created stickers (the "Yours" tab)
  recents: loadRecents(), // hosted URLs, most-recent first (this device only)
  isLoading: false,
  hasFetched: false,

  fetchStickers: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/stickers");
      set({ stickers: res.data, hasFetched: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't load stickers");
    } finally {
      set({ isLoading: false });
    }
  },

  createSticker: async (image) => {
    try {
      const res = await axiosInstance.post("/stickers", { image });
      set({ stickers: [res.data, ...get().stickers] });
      toast.success("Sticker added");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't create sticker");
      return null;
    }
  },

  // Favorite a sticker someone sent — the backend is idempotent, so this is safe
  // to call on one you may already have.
  saveSticker: async (url) => {
    try {
      const res = await axiosInstance.post("/stickers/save", { url });
      // Don't double-insert if it was already in the tray.
      if (!get().stickers.some((s) => s._id === res.data._id)) {
        set({ stickers: [res.data, ...get().stickers] });
      }
      toast.success("Sticker saved");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't save sticker");
      return null;
    }
  },

  deleteSticker: async (id) => {
    try {
      await axiosInstance.delete(`/stickers/${id}`);
      set({ stickers: get().stickers.filter((s) => s._id !== id) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't remove sticker");
    }
  },

  // Called every time a sticker is sent, so the picker's Recent row mirrors what
  // you actually reach for. De-duped, newest first, capped.
  pushRecent: (url) => {
    const recents = [url, ...get().recents.filter((u) => u !== url)].slice(0, RECENTS_CAP);
    set({ recents });
    saveRecents(recents);
  },

  clearStickerState: () => {
    // Recents are per-device and not tied to identity, so logout leaves them —
    // but the account's tray must go so the next user never sees it.
    set({ stickers: [], hasFetched: false });
  },
}));
