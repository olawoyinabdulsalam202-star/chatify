// Desktop: Enter sends, Shift+Enter inserts a newline (the universal chat-app
// convention). Mobile: Enter always inserts a newline — there's no keyboard
// modifier to hold on a touch keyboard, so intercepting Enter there would
// remove the only way to add a line break, and sending stays a deliberate tap
// on the send button.
//
// Pointer type, not screen width, is what actually distinguishes the two —
// it holds up on a touch laptop or a resized desktop window, where a width
// check would guess wrong.
export function isDesktopPointer() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(pointer: fine)").matches;
}

// Attach as onKeyDown on the message textarea. `onSend` is called with the
// same event React gives onKeyDown — callers that expect a submit-shaped
// event (calling e.preventDefault()) can treat it the same way.
export function handleEnterToSend(e, onSend) {
  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent?.isComposing) return;
  if (!isDesktopPointer()) return; // let the keyboard insert a newline
  e.preventDefault();
  onSend(e);
}
