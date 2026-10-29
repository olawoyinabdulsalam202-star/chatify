import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "havn.sidebarWidth";
const DEFAULT_RATIO = 0.38;
const MIN_WIDTH = 320;

function getDefaultWidth() {
  return Math.max(MIN_WIDTH, Math.round(window.innerWidth * DEFAULT_RATIO));
}

function getMaxWidth() {
  return Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.45));
}

function clampWidth(value) {
  const maxWidth = getMaxWidth();
  return Math.max(MIN_WIDTH, Math.min(maxWidth, Math.round(value)));
}

function getInitialWidth() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const value = stored === null || stored.trim() === "" ? NaN : Number(stored);
    const hasSavedCustomWidth = Number.isFinite(value) && value >= MIN_WIDTH && value !== 380;
    const width = hasSavedCustomWidth ? clampWidth(value) : clampWidth(getDefaultWidth());
    window.localStorage.setItem(STORAGE_KEY, String(width));
    return width;
  } catch {
    return clampWidth(DEFAULT_WIDTH);
  }
}

export function useSidebarWidth() {
  const [width, setWidth] = useState(getInitialWidth);
  const [maxWidth, setMaxWidth] = useState(getMaxWidth);
  const widthRef = useRef(width);
  widthRef.current = width;

  const persistWidth = useCallback((value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clampWidth(value)));
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const nextMaxWidth = getMaxWidth();
      const currentWidth = widthRef.current;
      const nextWidth = clampWidth(currentWidth);
      setMaxWidth(nextMaxWidth);
      setWidth(nextWidth);
      widthRef.current = nextWidth;
      if (nextWidth !== currentWidth) persistWidth(nextWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [persistWidth]);

  const updateWidth = useCallback((value) => {
    setWidth(clampWidth(value));
  }, []);

  return { width, maxWidth, setWidth: updateWidth, persistWidth, clampWidth };
}
