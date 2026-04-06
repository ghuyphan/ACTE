# FCM Setup

This app uses `expo-notifications` and Expo push tokens for social push notifications.
For Android delivery, Expo still requires Firebase Cloud Messaging (FCM) to be configured.

## What The App Expects

- `google-services.json` at the repo root, preferred for local native work
- `GoogleService-Info.plist` at the repo root, preferred for local native work
- `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` file-path envs as EAS-friendly alternatives
- `EXPO_PUBLIC_EAS_PROJECT_ID` in your environment for `getExpoPushTokenAsync`

[`app.config.js`](../app.config.js) will otherwise fall back to:

- `android/app/google-services.json`
- `ios/Noto/GoogleService-Info.plist`

but those native folders are generated and git-ignored here, so repo-root files or EAS secret file paths are safer for clean prebuilds.

## Android FCM Steps

1. Open Firebase Console and create or reuse the Firebase project for package `com.acte.app`.
2. Add an Android app with package name `com.acte.app`.
3. Download `google-services.json`.
4. Put that file at the repo root as `google-services.json`, or inject its path through `GOOGLE_SERVICES_JSON` in EAS.
5. In Firebase Console, create or locate the FCM v1 service account credentials.
6. Upload the FCM v1 service account key to your Expo/EAS Android credentials.

## iOS Push Steps

1. Add an iOS app with bundle id `com.acte.app` in Firebase if you want the plist managed there too.
2. Download `GoogleService-Info.plist`.
3. Put that file at the repo root as `GoogleService-Info.plist`, or inject its path through `GOOGLE_SERVICE_INFO_PLIST` in EAS.
4. Configure APNs credentials in Expo/EAS for iOS push delivery.

## Expo And Supabase Setup

1. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in your app environment.
2. Apply the `20260329100000_add_social_push_tokens.sql` migration.
3. Deploy the `send-social-notifications` Supabase edge function.
4. Set `SUPABASE_SERVICE_ROLE_KEY` for the function environment.
5. Set `EXPO_ACCESS_TOKEN` on the function if your Expo push project requires authenticated sends.

Client-side registration and routing currently live in:

- `services/socialPushService.ts`
- `hooks/app/useSocialPushRegistration.ts`
- `hooks/app/useAppNotificationRouting.ts`
- `app/_layout.tsx`
- `components/app/AppProviders.tsx`

## Quick Verification

1. Sign in on two physical devices.
2. Accept notification permissions on both.
3. Confirm an Expo push token is registered after sign-in.
4. Accept a friend invite on one device and verify the other device receives a push.
5. Share a memory on one device and verify recipients receive a push that opens the shared post.

## Current Repo Integration Points

- `app.config.js` resolves Firebase files from repo-root paths first, then generated native fallbacks.
- Root Firebase config files are git-ignored, so treat them as local or CI/EAS secrets rather than committed assets.
- Social push registration is auth-aware and only runs on native platforms with Supabase configured.
