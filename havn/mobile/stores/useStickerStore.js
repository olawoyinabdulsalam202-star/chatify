import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../lib/api";

const RECENTS_KEY = "havn.stickerRecents";
const RECENTS_CAP = 24;

export const useStickerStore = create((set, get) => ({
  stickers: [],
  recents: [],
  isLoading: false,
  isCreating: false,
  error: "",
  hasFetched: false,
  loadRecents: async () => {
    try {
      const value = await AsyncStorage.getItem(RECENTS_KEY);
      const recents = value ? JSON.parse(value) : [];
      set({ recents: Array.isArray(recents) ? recents.filter((url) => typeof url === "string") : [] });
    } catch { set({ recents: [] }); }
  },
  fetchStickers: async () => {
    set({ isLoading: true, error: "" });
    try {
      const stickers = await api("/stickers");
      set({ stickers: Array.isArray(stickers) ? stickers : [], hasFetched: true });
      return stickers;
    } catch (error) {
      set({ error: error.message || "Couldn't load stickers", hasFetched: true });
      return null;
    } finally { set({ isLoading: false }); }
  },
  createSticker: async (image) => {
    set({ isCreating: true, error: "" });
    try {
      const sticker = await api("/stickers", { method: "POST", body: { image } });
      set({ stickers: [sticker, ...get().stickers] });
      return sticker;
    } catch (error) {
      set({ error: error.message || "Couldn't create sticker" });
      return null;
    } finally { set({ isCreating: false }); }
  },
  saveSticker: async (url) => {
    set({ error: "" });
    try {
      const sticker = await api("/stickers/save", { method: "POST", body: { url } });
      if (!get().stickers.some((item) => String(item._id) === String(sticker._id))) set({ stickers: [sticker, ...get().stickers] });
      return sticker;
    } catch (error) {
      set({ error: error.message || "Couldn't save sticker" });
      return null;
    }
  },
  deleteSticker: async (id) => {
    set({ error: "" });
    try {
      await api(`/stickers/${id}`, { method: "DELETE" });
      set({ stickers: get().stickers.filter((item) => String(item._id) !== String(id)) });
      return true;
    } catch (error) {
      set({ error: error.message || "Couldn't remove sticker" });
      return false;
    }
  },
  pushRecent: (url) => {
    const recents = [url, ...get().recents.filter((item) => item !== url)].slice(0, RECENTS_CAP);
    set({ recents });
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(recents)).catch(() => {});
  },
  clearStickerState: () => set({ stickers: [], isLoading: false, isCreating: false, error: "", hasFetched: false }),
}));
