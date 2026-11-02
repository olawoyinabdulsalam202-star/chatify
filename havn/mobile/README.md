# Havn Android app

This is the native Expo Router app. It uses Expo SDK 58 and plain JavaScript.

## Install and run

1. Install Node.js 22.13 or newer and npm.
2. From `havn/mobile`, run `npm install`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the API origin. The checked-in local example uses `https://api.kairos-va.com`.
4. Place the Firebase Android config at `mobile/google-services.json` for local native builds.
5. Run `npx expo start` and scan the terminal QR code with Expo Go, or run `npx expo start --android` with an Android emulator open.

## Expo Go

Install Expo Go from Google Play, connect the phone and development computer to the same network, then start the project with `npx expo start`. Use the Expo Go scanner to open the project. Remote push registration is intentionally skipped in Expo Go; it requires a development or release build with native Firebase configuration.

## Video status trimming

The status editor previews the source video and selects a clip up to 30 seconds. The original is uploaded to Cloudinary with an eagerly generated trimmed MP4 transformation. In a development build, `react-native-video-trim` can replace the Cloudinary trim path with a native trimmer if needed.

The web `frontend/src/components/CreateStoryModal.jsx` still rejects videos above 15MB before trimming. Apply the same trim and derived-size flow to the web status composer in a later change.

## Firebase file secret and EAS

Do not commit `google-services.json`. For EAS, create an environment variable named `GOOGLE_SERVICES_JSON` with type **File**, upload the Firebase Android `google-services.json`, and select the same EAS environment for the build. `app.config.js` maps the file secret path to `android.googleServicesFile`. For a local EAS build, place the file at `mobile/google-services.json` instead.

## Build an APK later

Run `npx eas-cli login`, configure the project with `npx eas-cli build:configure`, then run `npx eas-cli build --platform android --profile preview`. The preview profile produces an installable APK. The production profile produces an Android App Bundle.

## Native calling development build

Voice and video calling uses `react-native-webrtc`, React Native Firebase Messaging, Notifee, and InCallManager. These native modules do not run in Expo Go. Install the dependencies from `package.json`, then create and install a fresh development build with `npx eas-cli build --platform android --profile development`. Start Metro with `npx expo start --dev-client` and open the installed Havn development client. Rebuild after changing any native dependency or Android permission.

EAS must have the Android `google-services.json` file secret configured as described above. Firebase Messaging uses that configuration. The app registers the Android FCM token once through `POST /api/push/device`; Expo Notifications remains responsible for the permission/channel UI and returns the same native FCM device token. Do not register a second token provider.

Configure calling on the backend with `STUN_URLS` (comma-separated STUN URLs). For production, configure a TURN service and set `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`. For coturn shared-secret authentication, set `TURN_URLS` and `TURN_STATIC_AUTH_SECRET`; the API returns one-hour time-based credentials. When no TURN URLs are set, the API returns the same Open Relay fallback used by the web call client. Both web and mobile fetch ICE configuration from `GET /api/calls/ice-servers`; no TURN credentials belong in a client build.

Incoming-call full-screen intents require Android 14's full-screen notification permission. Havn checks it on the incoming call screen and opens the system setting when it is denied. Battery optimization settings vary by manufacturer; Havn includes a device-specific guide and a settings shortcut.

Physical-device checks are required for microphone/camera permission prompts, voice and video in both directions (web-to-mobile and mobile-to-web), Bluetooth and speaker routing, lock-screen ringing and answer/decline actions, Android 14 full-screen permission, battery optimization behavior, FCM cancellation across multiple devices, and TURN connectivity on cellular and restrictive Wi-Fi. Expo export only checks the JavaScript bundle; it cannot validate those native behaviors.

## Screens and behavior

- Email login, signup, OTP verification, and a browser password-reset link.
- AI conversation, DM list/search, text and image messages, reply previews, receipts, typing and presence.
- QR-based web-device approval, linked-device revocation, notifications registration, and app-version gating.

DM pagination is currently local: `GET /api/messages/:id` returns the complete conversation and has no `before` or `limit` cursor. The app reveals older messages in batches from that response.
