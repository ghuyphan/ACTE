# FCM Setup

This app uses `expo-notifications` and Expo push tokens for social push notifications.
For Android delivery, Expo still requires Firebase Cloud Messaging (FCM) to be configured.

## What The App Expects

- `google-services.json` at the repo root, preferred
- `GoogleService-Info.plist` at the repo root, preferred
- `EXPO_PUBLIC_EAS_PROJECT_ID` in your environment for `getExpoPushTokenAsync`

`app.config.ts` will fall back to:

- `android/app/google-services.json`
- `ios/Noto/GoogleService-Info.plist`

but those native folders are generated, so the repo-root files are safer for clean prebuilds.

## Android FCM Steps

1. Open Firebase Console and create or reuse the Firebase project for package `com.acte.app`.
2. Add an Android app with package name `com.acte.app`.
3. Download `google-services.json`.
4. Put that file at the repo root as `google-services.json`.
5. In Firebase Console, create or locate the FCM v1 service account credentials.
6. Upload the FCM v1 service account key to your Expo/EAS Android credentials.

## iOS Push Steps

1. Add an iOS app with bundle id `com.acte.app` in Firebase if you want the plist managed there too.
2. Download `GoogleService-Info.plist`.
3. Put that file at the repo root as `GoogleService-Info.plist`.
4. Configure APNs credentials in Expo/EAS for iOS push delivery.

## Expo And Server Setup

1. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in your app environment. Production builds now require it.
2. Deploy the Supabase migration for `device_push_tokens`.
3. Deploy the `send-social-notifications` Supabase edge function.
4. Set `EXPO_ACCESS_TOKEN` on the edge function environment if your Expo push project requires authenticated sends.

## Quick Verification

1. Sign in on two physical devices.
2. Accept notification permissions on both.
3. Confirm an Expo push token is registered after sign-in.
4. Accept a friend invite on one device and verify the other device receives a push.
5. Share a memory on one device and verify recipients receive a push that opens the shared post.

## Current Repo Status

- `app.config.ts` now reads Firebase service files from stable repo-root paths.
- The existing `android/app/google-services.json` appears to be placeholder data, so Android FCM should be replaced with a real Firebase config before testing push delivery.
- The checked-in Android manifest should no longer contain a literal Maps key; keep `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` in environment-backed secrets only.
