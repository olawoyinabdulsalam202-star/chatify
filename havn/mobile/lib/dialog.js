import { useSyncExternalStore } from "react";

let current = null;
let listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function showDialog(title, message = "", buttons = []) {
  return new Promise((resolve) => {
    const actions = Array.isArray(buttons) && buttons.length ? buttons : [{ text: "OK", style: "default" }];
    current = { title: String(title || ""), message: String(message || ""), buttons: actions, resolve };
    notify();
  });
}

export function dismissDialog(result = null) {
  const dialog = current;
  current = null;
  notify();
  dialog?.resolve(result);
}

export function useDialogState() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => current, () => null);
}
