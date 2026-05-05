# Supabase Schema Reference

This file is a context snapshot for app and edge-function work. It is not an executable migration. Apply SQL changes through ordered files in `supabase/migrations/`.

## Current App-Facing Tables

### `public.profiles`

Auth-linked profile row keyed by `auth.users.id`.

- Primary key: `id`
- Foreign keys: `id -> auth.users(id)`
- Important fields: `username`, `display_name`, `photo_url`, `username_set_at`, `updated_at`
- Constraints: username is required, lower-case/number/dot/underscore only, 1-20 chars

### `public.notes`

Remote sync copy of local notes.

- Primary key: `id`
- Foreign keys: `user_id -> auth.users(id)`
- Important fields: note type/content, location, favorite state, prompt/mood fields, stickers/doodles, live photo fields, dual-capture fields, timestamps
- Constraints: `type` is `text` or `photo`; content is at most 300 chars; `location_name` is at most 100 chars; latitude/longitude/radius are bounded; dual facing is `front` or `back`; dual layout is `top-left`
- Media ownership: `photo_path`, `paired_video_path`, `dual_primary_photo_path`, and `dual_secondary_photo_path` should live under `<user_id>/...`

### `public.note_tombstones`

Deleted note marker for sync.

- Primary key: `note_id`
- Foreign keys: `user_id -> auth.users(id)`
- Important fields: `deleted_at`

### `public.user_usage`

Per-user usage counters used by quota and sync flows.

- Primary key: `user_id`
- Foreign keys: `user_id -> auth.users(id)`
- Important fields: total note/photo counts, daily photo count/date, `last_synced_at`
- Ownership: app clients read this table, but writes should flow through server recomputation from `public.notes`

### `public.friend_invites`

Invite records for friend onboarding.

- Primary key: `id`
- Foreign keys: `inviter_user_id -> auth.users(id)`, `accepted_by_user_id -> auth.users(id)`
- Important fields: inviter snapshots, `token`, `token_hash`, accepted/revoked/expiry timestamps
- Constraints: `token` is unique when present

### `public.friendships`

Directional friendship rows. Mutual friendships are represented as two rows.

- Primary key: `(user_id, friend_user_id)`
- Foreign keys: both user ids reference `auth.users(id)`
- Important fields: profile snapshots, optional per-user `friend_nickname`, `friended_at`, `last_shared_at`, invite provenance

### `public.friend_groups`

User-owned sharing shortcuts. A group belongs only to its owner and expands to normal shared-post audience ids.

- Primary key: `id`
- Foreign keys: `owner_user_id -> auth.users(id)`
- Important fields: `name`, created/updated timestamps

### `public.friend_group_members`

Membership rows for user-owned friend groups.

- Primary key: `(group_id, friend_user_id)`
- Foreign keys: `group_id -> public.friend_groups(id)`, `(owner_user_id, friend_user_id) -> public.friendships(user_id, friend_user_id)`
- Important fields: group owner and friend user id

### `public.shared_posts`

Posts shared with friends, usually derived from notes.

- Primary key: `id`
- Foreign keys: `author_user_id -> auth.users(id)`
- Important fields: author snapshots, `audience_user_ids`, text/photo content, source note, location, stickers/doodles, live photo fields, dual-capture fields, timestamps
- Constraints: `type` is `text` or `photo`; text is at most 300 chars; `place_name` is at most 100 chars; optional coordinates are bounded; dual facing is `front` or `back`; dual layout is `top-left`
- Media ownership: `photo_path`, `paired_video_path`, `dual_primary_photo_path`, and `dual_secondary_photo_path` should live under `<author_user_id>/...`

### `public.shared_post_tombstones`

Deleted shared-post marker.

- Primary key: `post_id`
- Foreign keys: `author_user_id -> auth.users(id)`
- Important fields: `deleted_at`

### `public.shared_post_responses`

Lightweight emoji/text responses attached to a shared post.

- Primary key: `id`
- Foreign keys: `post_id -> public.shared_posts(id)`, `author_user_id -> auth.users(id)`
- Important fields: author snapshots, optional emoji, short response text, `created_at`

### `public.device_push_tokens`

Expo push token registry for social notifications.

- Primary key: `expo_push_token`
- Foreign keys: `user_id -> auth.users(id)`
- Important fields: `platform`, `installation_id`, `app_version`, created/updated/last-seen timestamps
- Constraints: platform is `ios` or `android`

### `public.social_notification_events`

Idempotency and delivery-state tracking for social push events.

- Primary key: `(event_type, actor_user_id, resource_id)`
- Foreign keys: `actor_user_id -> auth.users(id)`, `recipient_user_id -> auth.users(id)`
- Important fields: delivery state, claim/attempt/delivery timestamps
- Constraints: delivery state is `pending`, `processing`, or `delivered`

### `public.social_notification_rate_limit_events`

Server-owned throttle ledger for social push sends.

- Primary key: `id`
- Foreign keys: `actor_user_id -> auth.users(id)`, `recipient_user_id -> auth.users(id)`
- Important fields: `event_type`, actor/recipient ids, optional resource id, `created_at`
- Access: service-role RPC only; app clients should not select or mutate this table directly

### `public.sticker_assets`

Registry for uploaded sticker image assets.

- Primary key: `id`
- Foreign keys: `owner_user_id -> auth.users(id)`
- Important fields: content hash, MIME type, dimensions, byte size, storage bucket/path, created/last-seen timestamps
- Constraints: dimensions are positive; byte size is positive when present
- Media ownership: storage paths should stay in owner-scoped sticker locations

### `public.sticker_asset_refs`

References from notes or shared posts to sticker assets.

- Primary key: `(container_type, container_id, asset_id)`
- Foreign keys: `asset_id -> public.sticker_assets(id)`, `owner_user_id -> auth.users(id)`
- Important fields: container type/id, created timestamp
- Constraints: container type is `note` or `shared_post`

## Storage Buckets

- `note-media`: private note photos, live-photo video files, dual-capture photos, and owned sticker assets.
- `shared-post-media`: private shared-post media visible through shared-post audience policies.

## Migration Notes

- Treat this document as a readable schema map only.
- Durable schema changes belong in `supabase/migrations/`.
- The media path hardening migration validates owner-prefixed note/shared-post paths and refreshes storage policies that depend on database media path columns.
