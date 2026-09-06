// Browsers refuse to start audio that wasn't triggered by a user gesture. An
// incoming call is the worst case for that rule: the sound needs to start on a
// socket event, seconds or hours after the last time the user touched the page,
// so `new Audio(...).play()` throws NotAllowedError and the call arrives in
// total silence. That's the "calls are silenced automatically" bug.
//
// The way around it is to get playback permission *while* we still have a
// gesture to spend. The first time the user taps or types anywhere in the app we
// start the real ringtone element at zero volume and immediately pause it. That
// counts as user-initiated playback, which permanently blesses that specific
// element — every later play() on it is allowed without a gesture.
//
// Priming a throwaway element does not work: the permission attaches to the
// element, not to the page. So the element primed here has to be the exact one
// the ringtone plays through, which is why this module owns it.

const RINGTONE_SRC = "/sounds/notification.mp3";

let ringtone = null;
let unlocked = false;
let initialized = false;
const listeners = new Set();

function getRingtone() {
  if (!ringtone) {
    ringtone = new Audio(RINGTONE_SRC);
    ringtone.loop = true;
    ringtone.preload = "auto";
  }
  return ringtone;
}

function notify() {
  listeners.forEach((cb) => {
    try {
      cb(unlocked);
    } catch {
      // A broken subscriber must not stop the others from being told.
    }
  });
}

async function unlock() {
  if (unlocked) return true;

  const audio = getRingtone();

  try {
    // Volume 0 rather than `muted`: muted playback is always permitted and so
    // grants nothing, while a real (if inaudible) play is what earns the
    // permission. The user hears nothing either way.
    audio.volume = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    unlocked = true;
    return true;
  } catch {
    // Still blocked — the caller falls back to vibration and a visible
    // tap-to-enable-sound control.
    return false;
  } finally {
    // Always restore full volume, never a "previous" value.
    //
    // This used to capture audio.volume before muting and restore that. Two
    // ways that silenced the ringtone: the restore runs in `finally`, so on the
    // success path it could land while play() was still starting, and if unlock
    // ever ran twice the second call captured the already-zeroed volume and
    // wrote 0 back permanently. The element is ours and only ever plays the
    // ringtone, so 1 is the only correct resting value.
    audio.volume = 1;
  }
}

// Attach once per page load. Called from app startup; safe to call repeatedly.
export function initAudioUnlock() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;

  // pointerdown covers mouse and touch; keydown covers keyboard-only use, which
  // also counts as a gesture and matters for accessibility.
  const events = ["pointerdown", "keydown"];

  const handler = async () => {
    const ok = await unlock();
    if (ok) {
      // Only stop listening once we've actually succeeded. If the first gesture
      // lands before the audio file is fetchable, later gestures get a turn.
      events.forEach((event) => document.removeEventListener(event, handler));
      notify();
    }
  };

  events.forEach((event) => document.addEventListener(event, handler, { passive: true }));
}

export function isAudioUnlocked() {
  return unlocked;
}

// Lets UI show a "tap to enable sound" affordance and drop it the moment audio
// becomes available.
export function subscribeToAudioUnlock(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Starts the ringtone. Resolves to true if sound is actually playing, false if
// the browser refused — the caller decides what to do about a silent ring.
export async function startRingtone() {
  const audio = getRingtone();
  audio.loop = true;
  // Force audible volume at ring time. Belt-and-braces against the element
  // being left at 0 by a failed unlock attempt — a silent ringtone is
  // indistinguishable from a broken call, which is the bug this whole module
  // exists to prevent.
  audio.volume = 1;
  audio.muted = false;
  try {
    // Rewinding can throw InvalidStateError if metadata hasn't loaded yet, and
    // that must not be mistaken for "autoplay was blocked" — so it's inside the
    // try and non-fatal.
    audio.currentTime = 0;
  } catch {
    // Not loaded yet; it'll start from 0 on its own.
  }
  try {
    await audio.play();
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function stopRingtone() {
  if (!ringtone) return;
  ringtone.pause();
  ringtone.currentTime = 0;
}

// Vibration is a separate permission track from audio: it works without a prior
// gesture on Android/Chrome, so it's the one signal we can rely on when sound is
// blocked. iOS Safari ignores it, which is why it's a supplement, not a
// replacement.
export function startVibration() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return () => {};

  const pattern = [400, 200, 400, 1000];
  const tick = () => navigator.vibrate(pattern);
  tick();
  const interval = setInterval(tick, 2000);

  return () => {
    clearInterval(interval);
    navigator.vibrate(0);
  };
}
