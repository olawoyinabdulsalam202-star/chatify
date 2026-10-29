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

## Firebase file secret and EAS

Do not commit `google-services.json`. For EAS, create an environment variable named `GOOGLE_SERVICES_JSON` with type **File**, upload the Firebase Android `google-services.json`, and select the same EAS environment for the build. `app.config.js` maps the file secret path to `android.googleServicesFile`. For a local EAS build, place the file at `mobile/google-services.json` instead.

## Build an APK later

Run `npx eas-cli login`, configure the project with `npx eas-cli build:configure`, then run `npx eas-cli build --platform android --profile preview`. The preview profile produces an installable APK. The production profile produces an Android App Bundle.

## Screens and behavior

- Email login, signup, OTP verification, and a browser password-reset link.
- AI conversation, DM list/search, text and image messages, reply previews, receipts, typing and presence.
- QR-based web-device approval, linked-device revocation, notifications registration, and app-version gating.

DM pagination is currently local: `GET /api/messages/:id` returns the complete conversation and has no `before` or `limit` cursor. The app reveals older messages in batches from that response.
