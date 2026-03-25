# Supabase Setup

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

Do not add a Supabase `service_role` key to the app.

## 2. Auth Providers

In the Supabase dashboard:

1. Enable Email authentication.
2. Enable Google authentication.
3. Paste the Google Web OAuth client ID and secret into the Google auth provider settings.
4. Add the Supabase Google callback URL from the Auth provider page into Google Cloud's authorized redirect URIs.

In Google Cloud:

1. Create Web, iOS, and Android OAuth clients in the same project.
2. Use the Web client for Supabase Auth provider setup.
3. Use the iOS and Android client IDs in `.env.local`.

## 3. Database And Storage

Apply the migration under `supabase/migrations/` to create:

- Auth-linked profile and usage tables
- Notes, friendships, invites, shared posts, rooms, room members, room invites, and room posts
- RLS policies and RPC functions
- Private storage buckets for note, shared, and room media
- Realtime publication entries for the tables used by the app

## 4. Realtime

Enable Realtime for:

- `user_usage`
- `friendships`
- `friend_invites`
- `shared_posts`

## 5. Native Builds

The app no longer uses Firebase native config files. Google sign-in is configured with OAuth client IDs and an iOS URL scheme derived from the iOS client ID.

## 6. Account Deletion Function

This repo now includes `supabase/functions/delete-account/index.ts`.

Deploy it before shipping account-based builds:

1. `supabase functions deploy delete-account`
2. Set `SUPABASE_SERVICE_ROLE_KEY` for the function environment.
3. Keep the service-role key out of the app bundle.

The app calls this function from the Profile screen, then clears local account-scoped notes on-device.
