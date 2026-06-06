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

The checked-in migration history currently contains follow-up migrations only. It does not yet contain a trustworthy baseline that can create the deployed schema from an empty database. Do not treat `docs/supabase-schema.md` as an executable source of truth, and do not invent a baseline from the app's TypeScript types.

Until the baseline recovery below is completed, apply the existing files under `supabase/migrations/` only to an environment whose schema and migration history have been compared with the authoritative linked project.

### Recovering the authoritative baseline

This work requires a Supabase access token, the production project ref, and the database password. Run it from a clean branch and use a disposable local Supabase database for validation:

```sh
export SUPABASE_ACCESS_TOKEN="..."
npx supabase link --project-ref "<project-ref>"
npx supabase migration list --linked
npx supabase db dump --linked --schema public,storage \
  --file /tmp/noto-linked-schema.sql
```

Then:

1. Review the dump instead of applying it directly to production. Remove Supabase-managed internals while retaining all app-owned tables, functions, triggers, grants, and RLS policies.
2. Capture app-owned storage bucket configuration separately. Bucket rows are data and may not be represented by a schema-only dump.
3. Create an initial baseline migration that runs before the existing `202604...` follow-up files.
4. Start local Supabase and run `npx supabase db reset --local` from an empty database.
5. Run authorization tests with at least two users. Verify cross-user note/media denial, invite acceptance, friendship access, direct-chat membership, response/reaction ownership, push-token RPC access, and profile visibility.
6. Compare the rebuilt local schema and policies with the linked project before merging or deploying the baseline.

Never run `supabase db reset --linked` while recovering or testing the baseline.

For a readable snapshot of the app-facing Supabase tables and storage buckets, see `docs/supabase-schema.md`.

The current checked-in migrations cover:

- media path ownership hardening for note and shared-post storage policies
- legacy room schema cleanup through `20260426123000_drop_legacy_room_schema.sql`
- server-authoritative usage recomputation through `20260426133000_server_authoritative_user_usage.sql`
- service-role social push throttling through `20260426140000_social_notification_rate_limits.sql`
- usage daily-date cast fix through `20260426143000_fix_user_usage_daily_date_cast.sql`

The backend storage surface now includes media and cleanup concerns for:

- `note-media`
- `shared-post-media`
- sticker asset buckets referenced by the registry tables

Storage cleanup is handled by edge functions and app/server workflows. The old SQL storage cleanup trigger migrations were removed from the repo because they are no longer part of the current schema history.

## 4. Realtime And Push

The applied Supabase schema publishes these tables to Realtime:

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
