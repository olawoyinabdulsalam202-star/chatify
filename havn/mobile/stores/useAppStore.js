import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAppStore = create((set) => ({
  androidRelease: null,
  updateDismissed: false,
  soundEnabled: true,
  hydrateSound: async () => {
    try {
      const saved = await AsyncStorage.getItem("havn.soundEnabled");
      if (saved === "true" || saved === "false") set({ soundEnabled: saved === "true" });
    } catch (error) {
      console.warn("Could not load sound preference:", error.message);
    }
  },
  setSoundEnabled: async (soundEnabled) => {
    set({ soundEnabled });
    try { await AsyncStorage.setItem("havn.soundEnabled", String(soundEnabled)); }
    catch (error) { console.warn("Could not save sound preference:", error.message); }
  },
  setAndroidRelease: (androidRelease) => set({ androidRelease, updateDismissed: false }),
  dismissUpdate: () => set({ updateDismissed: true }),
}));
