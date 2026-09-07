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
// Same asset, its own element. The message ping must not share state with the
// looping ringtone (a call can be ringing when a message lands), and the
// browser's autoplay grant attaches per element — so this one has to be primed
// separately during the unlock gesture or it stays blocked forever.
const NOTIFICATION_SRC = "/sounds/notification.mp3";

let ringtone = null;
let notifSound = null;
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

function getNotifSound() {
  if (!notifSound) {
    notifSound = new Audio(NOTIFICATION_SRC);
    notifSound.preload = "auto";
  }
  return notifSound;
}

// Plays an element inaudibly and immediately pauses it. That counts as
// user-initiated playback, which permanently blesses that specific element so
// every later play() on it is allowed with no fresh gesture. volume is always
// restored to 1, even if play() rejects, so a failed attempt can never leave an
// element permanently silent.
async function prime(audio) {
  try {
    audio.volume = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  } finally {
    audio.volume = 1;
  }
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

  try {
    // Volume 0 rather than `muted`: muted playback is always permitted and so
    // grants nothing, while a real (if inaudible) play is what earns the
    // permission. The user hears nothing either way.
    await prime(getRingtone());

    // Prime the message ping on the SAME gesture. Its autoplay grant is
    // independent of the ringtone's, so this is the only chance to bless it —
    // this is the fix for "notification sound is silent in production", where
    // the chat store's per-message `new Audio()` had never earned permission
    // and was blocked. Best-effort: a failure here must not undo the ringtone
    // unlock, so it's swallowed and the ping simply retries on a later gesture.
    try {
      await prime(getNotifSound());
    } catch {
      // ignore — ping stays silent until a future gesture primes it
    }

    unlocked = true;
    return true;
  } catch {
    // Still blocked — the caller falls back to vibration and a visible
    // tap-to-enable-sound control.
    return false;
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

// Fire-and-forget message ping. Plays through the persistent element primed at
// unlock, so it sounds even long after the last gesture — unlike the per-message
// `new Audio("/sounds/notification.mp3")` the chat store built before, which
// never earned autoplay permission and was silently swallowed in production.
// Non-looping, and rewound to the start each call so back-to-back messages each
// ping instead of one being ignored because the last is still playing.
export function playNotificationSound() {
  const audio = getNotifSound();
  audio.loop = false;
  audio.volume = 1;
  audio.muted = false;
  try {
    audio.currentTime = 0;
  } catch {
    // Metadata not loaded yet; it'll start from 0 on its own.
  }
  audio.play().catch(() => {
    // Still blocked because no gesture ever landed. Nothing to do — the unread
    // badge already reflects the message, so we just stay silent.
  });
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
