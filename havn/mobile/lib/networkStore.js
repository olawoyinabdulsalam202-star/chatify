import { create } from "zustand";

export const useNetworkStore = create((set) => ({
  isOffline: false,
  setOffline: (isOffline) => set({ isOffline }),
}));

export const setOffline = (value) => useNetworkStore.getState().setOffline(value);
