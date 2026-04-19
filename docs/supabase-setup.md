# Supabase Setup

Supabase is optional for local note-taking, but required for account-based auth, sharing, remote usage tracking, social push delivery, delete-account cleanup, and cloud-backed sync/media features.

## 1. App Environment

Add these values to `.env.local` or your EAS environment:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
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
3. Use the iOS and Android client IDs in the app environment.

## 3. Database, Storage, And Migrations

Apply every migration under `supabase/migrations/` in order.

The migration history currently covers:

- base auth-linked profiles, `user_usage` including daily photo usage, and notes sync primitives
- friendships, friend invites, shared posts, and shared-post coordinates
- note length constraints, note colors, live photo columns, and sync tombstones
- sticker sync columns, sticker asset GC indexes, and the sticker asset registry
- profile visibility hardening, invite-token hardening, and the remove-friend fix
- social push token support through the `device_push_tokens` migration

The backend storage surface now includes media and cleanup concerns for:

- `note-media`
- `shared-post-media`
- `room-post-media`
- sticker asset buckets referenced by the registry tables

Note: the `20260327133000_remove_storage_cleanup_triggers.sql` migration removes the earlier SQL storage cleanup trigger approach. Storage cleanup is now handled by edge functions and app/server workflows.

## 4. Realtime And Push

The initial migration adds these tables to the `supabase_realtime` publication:

- `user_usage`
- `friendships`
- `friend_invites`
- `shared_posts`

Push delivery is separate from Realtime:

- the app registers Expo push tokens through `register_push_token` / `unregister_push_token` RPCs
- `services/socialPushService.ts` invokes the `send-social-notifications` edge function for friend-accepted and shared-post events

## 5. Edge Functions

This repo includes three checked-in Supabase edge functions:

### `delete-account`

Path:

- `supabase/functions/delete-account/index.ts`

Server env:

- `SUPABASE_SERVICE_ROLE_KEY`

Behavior:

- requires an authenticated user with a recent sign-in
- aborts before deleting the auth user if owned-media, sticker-asset, or push-token cleanup fails
- deletes owned media, sticker asset records, and registered push tokens before deleting the auth user

### `send-social-notifications`

Path:

- `supabase/functions/send-social-notifications/index.ts`

Server env:

- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_ACCESS_TOKEN` optional, depending on your Expo push project setup

Behavior:

- authenticates the caller through the request JWT
- resolves recipients from friendships or shared-post audience data
- loads Expo push tokens from `device_push_tokens`
- sends Expo push payloads for friend-accepted and shared-post events

### `cleanup-sticker-assets`

Path:

- `supabase/functions/cleanup-sticker-assets/index.ts`

Server env:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STICKER_GC_SECRET` required; callers must send it as `Authorization: Bearer <secret>`

Behavior:

- requires the configured bearer secret even for manual or scheduled runs
- accepts optional POST JSON for `dryRun`, `maxAgeDays`, and `limit`
- scans stale sticker assets
- removes unreferenced storage objects in batches
- deletes orphaned registry rows

## 6. Native Builds

- Supabase auth itself does not require Firebase native config files.
- Google sign-in is driven by OAuth client IDs.
- The iOS URL scheme is derived from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `app.config.js`.
- Push delivery still uses Firebase config files plus Expo project ID; see `docs/fcm-setup.md`.
