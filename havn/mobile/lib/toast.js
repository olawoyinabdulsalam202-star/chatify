import { useSyncExternalStore } from "react";

let active = null;
let queue = [];
let listeners = new Set();
let sequence = 0;
let timer = null;
const notify = () => listeners.forEach((listener) => listener());

function advance() {
  clearTimeout(timer);
  active = queue.shift() || null;
  notify();
  if (active) timer = setTimeout(dismissToast, 2500);
}

export function showToast(message, type = "info") {
  const item = { id: ++sequence, message: String(message || ""), type };
  if (active) queue.push(item);
  else { active = item; notify(); timer = setTimeout(dismissToast, 2500); }
}

export function dismissToast() {
  if (!active) return;
  advance();
}

export const toast = {
  success: (message) => showToast(message, "success"),
  error: (message) => showToast(message, "error"),
  info: (message) => showToast(message, "info"),
};

export function useToastState() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => active, () => null);
}
