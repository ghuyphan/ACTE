# Supabase Setup

Supabase is optional for local note-taking, but required for account-based auth, shared moments, remote usage tracking, and media sync.

## 1. App Environment

Add these values to `.env.local`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_SUPPORT_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL`
- `EXPO_PUBLIC_SUPPORT_EMAIL`

Do not place a Supabase `service_role` key in the app bundle.

## 2. Auth Providers

In the Supabase dashboard:

1. Enable Email auth.
2. Enable Google auth.
3. Put the Google Web OAuth client ID and secret into the Google provider settings.
4. Add Supabase's Google callback URL to the Google Cloud OAuth client.

In Google Cloud:

1. Create Web, iOS, and Android OAuth clients in the same project.
2. Use the Web client for Supabase provider setup.
3. Use the iOS and Android client IDs in `.env.local`.

## 3. Database And Storage

Apply every migration under `supabase/migrations/` in order.

The migration history currently sets up:

- `user_usage` and auth-linked profile metadata
- Notes sync primitives
- Friend invites, friendships, and shared posts
- Room tables and policies that are already present in the backend schema
- Storage buckets for `note-media`, `shared-post-media`, and `room-post-media`
- Later schema hardening for note colors, stickers, shared coordinates, and policy fixes

Note: the latest migration removes SQL storage-cleanup triggers because Supabase Storage now blocks that direct delete pattern.

## 4. Realtime

The initial migration adds these tables to the `supabase_realtime` publication:

- `user_usage`
- `friendships`
- `friend_invites`
- `shared_posts`

## 5. Native Builds

- The app does not use Firebase native config files.
- Google sign-in is driven by OAuth client IDs.
- The iOS URL scheme is derived from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `app.config.ts`.

## 6. Delete-Account Function

This repo includes `supabase/functions/delete-account/index.ts`.

Deploy it before shipping account-enabled builds:

1. `supabase functions deploy delete-account`
2. Set `SUPABASE_SERVICE_ROLE_KEY` for the function environment.
3. Keep the service-role key out of the app bundle.

The app calls this function from the profile flow and then clears local account-scoped data on-device.
