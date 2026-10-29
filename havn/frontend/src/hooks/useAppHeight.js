let animationFrame = 0;
let initialized = false;

function readAppHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-h", `${Math.round(height)}px`);
}

function scheduleAppHeight() {
  if (animationFrame) return;
  animationFrame = window.requestAnimationFrame(() => {
    animationFrame = 0;
    readAppHeight();
  });
}

export function initializeAppHeight() {
  if (initialized) return;
  initialized = true;
  readAppHeight();
  window.addEventListener("resize", scheduleAppHeight, { passive: true });
  window.addEventListener("orientationchange", scheduleAppHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleAppHeight, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleAppHeight, { passive: true });
}
