import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router'
import { initAudioUnlock } from './lib/audioUnlock'
import { syncPushSubscription } from './lib/push'

// Start listening for the first tap/keypress straight away. Autoplay permission
// for the ringtone has to be earned from a real user gesture, and an incoming
// call never gets one of its own — so we bank it here, at startup.
initAudioUnlock()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// --- PWA service worker: install + auto-update ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Re-register an existing push grant. Permission survives across visits but
    // the server-side subscription row may not, so this keeps them in step
    // without prompting anyone again.
    syncPushSubscription();

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Check for a new version every time the app loads, and every 60s while
      // open. Finding one is all this does — surfacing it is UpdatePrompt's job.
      setInterval(() => registration.update(), 60_000);
    }).catch((err) => console.error("SW registration failed:", err));
  });
}

// Deliberately no automatic reload on updatefound/activated or controllerchange.
// A new worker claiming the page (which happens on the SW's own update cycle —
// roughly every 60s in dev, and on every deploy in production) would otherwise
// reload the app out from under whoever's mid-conversation. That's the "the page
// reloads when a message arrives while the chat is open" bug: the reload rode
// the SW cycle, not the message. Updates are instead offered through the
// UpdatePrompt banner (App.jsx), which reloads only when the user taps Update.
