# Noto Long-Term Polish Roadmap

Date: 2026-04-26  
Scope: Expo/React Native app, local SQLite persistence, Supabase sync/functions/migrations, widgets, native modules, build config, and release hardening.  
Method: parallel read-only review lanes for frontend, services/security, database/sync, and native/config, plus local spot checks. No app code was changed for this report.

## Executive Summary

Noto has a strong local-first shape and a lot of recent hardening work is visible: dual media cleanup is better covered, delete-all sync paging has improved, background location can be conditionally declared, media paths are owner-scoped, release build checks are stricter, and the iOS dual-camera queue issue appears to have been addressed. The remaining long-term polish work is concentrated in five areas:

1. Cloud media authority now has owner-prefix guards, but still needs SQL/RLS integration tests before the risk is fully retired.
2. Local and remote sync paths have stale-snapshot races. A user can edit while sync is uploading/importing and later lose newer local state.
3. The main app shell has very large orchestration surfaces. `HomeScreen`, `syncService`, `database`, `sharedFeedStore`, and widget providers are doing too much in one place.
4. Build and native release paths are stricter locally, but need release/prebuild verification coverage.
5. Some UI polish items are really product quality risks: invisible state resets, stale memoized media, small tap targets, and per-card timers.

## P0 / P1: Fix First

### 1. Bind all remote media paths to their owner before reads or deletes

**Status:** Addressed locally by `supabase/migrations/20260426120000_harden_media_path_ownership.sql`, owner-prefixed upload paths, stricter client/edge path guards, and regression coverage for unsafe/cross-owner paths plus current migration ownership constraints.

**Area:** Supabase storage, RLS, account deletion, sharing  
**Evidence:**

- The previously applied shared-post media visibility policy allowed `shared-post-media` reads when a visible `shared_posts` row referenced `storage.objects.name`.
- Older migrations had the same general model for shared post visibility, where row references could imply storage access unless path ownership was checked.
- `supabase/functions/delete-account/index.ts:136` collects path values from user-owned rows and deletes them with a service-role client.

**Risk:** A modified client can create or update a row it owns, point a media path column at another object's path, and then use that row to read or delete media it should not control. RLS proves row visibility, but not path ownership.

**Recommended fix:**

- Add database constraints or trigger validation for every media path column:
  - `notes.photo_path`, `notes.paired_video_path`, dual paths.
  - `shared_posts.photo_path`, `shared_posts.paired_video_path`, dual paths.
- Enforce path prefix rules:
  - Note media: `<user_id>/...`.
  - Shared post media: `<author_user_id>/...`.
- Update storage policies to verify both row visibility and path prefix ownership.
- In service-role cleanup, filter paths through the same prefix validator before deletion.
- Prefer a small SQL helper such as `is_valid_user_media_path(owner uuid, path text)` and use it consistently.

**Test ideas:**

- SQL policy test where user A creates a shared post row referencing user B's storage object and user A/B/friend attempts to read it.
- Edge-function test where account deletion ignores a forged path outside the deleting user's prefix.

### 2. Stop account deletion from missing dual-capture media

**Status:** Addressed locally in `supabase/functions/delete-account/index.ts`; dual paths are selected and filtered before storage cleanup.

**Area:** Supabase edge function, storage cleanup  
**Evidence:** `supabase/functions/delete-account/index.ts:7` and `:106` only select `photo_path`, `paired_video_path`, and `sticker_placements_json`.

**Risk:** Dual-capture objects can remain after account deletion, especially `dual_primary_photo_path` and `dual_secondary_photo_path`.

**Recommended fix:**

- Extend `MediaRow` with `dual_primary_photo_path` and `dual_secondary_photo_path`.
- Select and remove dual paths for both `notes` and `shared_posts`.
- Apply the owner-prefix validator from item 1 before deletion.

### 3. Make sync writes optimistic instead of stale-snapshot overwrites

**Status:** Further addressed locally with a durable `local_revision` field in SQLite and Supabase notes. Sync now serializes local revisions, imports same-timestamp remote edits when their revision is newer, and uses queued revision metadata as an additional stale-write guard. Targeted sync metadata patches remain future work.

**Area:** local database, sync queue, offline correctness  
**Evidence:**

- `services/syncService.ts:2239` reads a note, performs network/media work, and later writes local metadata.
- `services/syncService.ts:2145` uses `upsertNoteForScope`.
- `services/database.ts:2492` updates every note column on conflict.
- Remote merge around `services/syncService.ts:2423` has the same stale write shape.

**Risk:** A user can edit a note while sync is uploading or importing. When the in-flight sync finishes, it can write an older snapshot over the newer local state.

**Recommended fix:**

- Add `local_revision` or use `updated_at` as an optimistic lock.
- Before post-sync local writes, re-read the current row in the same transaction.
- If the row changed since the sync snapshot, patch only sync metadata/media fields that are still valid, or requeue reconciliation.
- Avoid full-row upserts for sync metadata updates. Use targeted updates where possible.

**Test ideas:**

- Create note, start mocked upload, edit caption before upload resolves, assert caption survives.
- Import remote update while local edit happens, assert conflict policy is explicit and tested.

### 4. Fix local read-modify-write races in note mutations

**Status:** Addressed locally in `services/database.ts`; `updateNote` and `toggleFavorite` read their base note rows inside the serialized write transaction and increment a persisted local revision for conflict-aware sync.

**Area:** SQLite mutation model  
**Evidence:**

- `services/database.ts:1870` reads the existing note before transaction work in `updateNote`.
- `services/database.ts:2024` writes many columns based on the computed replacement.
- `services/database.ts:2098` has a stale read shape in `toggleFavorite`.

**Risk:** Concurrent partial edits can overwrite each other. This gets more likely as save, detail sheet edits, sync, widgets, and sharing all touch notes.

**Recommended fix:**

- Move the read inside `withDatabaseTransaction`.
- Update only changed columns for partial updates.
- Introduce an optimistic `local_revision INTEGER NOT NULL DEFAULT 0`.
- Return a conflict result when `WHERE id = ? AND owner_uid = ? AND local_revision = ?` updates zero rows.

### 5. Route every database write through one operation queue

**Status:** Addressed locally in `services/database.ts`; direct Android database operations now wait behind active transactions, and transactions use the raw connection internally so transaction-scoped statements do not deadlock on the outer operation queue.

**Area:** SQLite isolation, Android stability  
**Evidence:**

- `services/database.ts:1294` serializes only callers using `withDatabaseTransaction`.
- `services/database.ts:263` serializes Android individual statements, not whole logical transactions.
- Sync repository code in `services/syncService.ts` uses direct `db.runAsync` paths.

**Risk:** Non-transaction writes can interleave with a manual `BEGIN IMMEDIATE` / `COMMIT` window. This undermines the transaction queue's safety.

**Recommended fix:**

- Expose one database write API and route all write operations through it.
- Keep a transaction-scoped executor that bypasses nested queueing only while inside the transaction.
- Add lint or code review rule: no direct `getDB().runAsync` writes outside database repository functions.

### 6. Prevent same-UID auth refreshes from blanking shared feed state

**Status:** Addressed locally in `hooks/useSharedFeedStore.tsx` by keying destructive reset behavior to UID changes and preserving same-user feed state.

**Area:** frontend state, social feed race  
**Evidence:** `hooks/useSharedFeedStore.tsx:943` resets session/snapshot based on the whole `user` object.

**Risk:** Profile reconciliation, username changes, avatar updates, or auth refreshes can change object identity while `user.uid` is unchanged. The feed can clear, flicker, restart hydration, and recreate subscriptions unnecessarily.

**Recommended fix:**

- Gate destructive reset only on UID changes.
- Keep latest user object in a ref for service calls.
- Avoid committing an empty snapshot when UID is unchanged.
- Add a test that changes display name/photo URL for the same UID and asserts feed items remain.

### 7. Harden Android release signing escape hatch

**Status:** Addressed locally in `plugins/withAndroidReleaseHardening.js`; debug-signed release builds are blocked for EAS/production contexts.

**Area:** release safety  
**Evidence:** `plugins/withAndroidReleaseHardening.js:52` allows `ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true` to select debug signing before EAS-managed signing.

**Risk:** If this env leaks into production or EAS release, a release artifact can be debug-signed.

**Recommended fix:**

- Throw when `ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true` and `EAS_BUILD=true`.
- Allow debug-signed release only for local smoke profiles.
- Include release signing verification in release docs and CI.

### 8. Downsample iOS widget images before decoding

**Status:** Addressed locally in `widgets/ios/LocketWidget.swift`; path and base64 image loading now use thumbnail decoding with a max pixel size.

**Area:** iOS widget memory/performance  
**Evidence:** `widgets/ios/LocketWidget.swift:1021` uses `UIImage(contentsOfFile:)` directly.

**Risk:** WidgetKit extensions have tight memory budgets. Loading full-resolution user photos can crash or produce blank widgets.

**Recommended fix:**

- Replace direct `UIImage(contentsOfFile:)` with `CGImageSourceCreateThumbnailAtIndex`.
- Cap max pixels by widget family.
- Add size guards for base64 images and sticker assets.
- Prefer staged widget thumbnails from the app process.

## P2: Next Wave

### 9. Revoke direct client writes to `user_usage`

**Status:** Addressed locally by `supabase/migrations/20260426133000_server_authoritative_user_usage.sql`; sync now calls `recompute_user_usage` instead of upserting client-computed counters. Future server-side quota enforcement should build on this projection plus a RevenueCat entitlement mirror.

**Area:** billing, quota enforcement  
**Evidence:** The applied Supabase schema allowed users to update their own `user_usage`; the old sync path wrote client-computed usage from `services/syncService.ts`.

**Risk:** A modified client can reset counters and bypass free photo limits. RevenueCat/Plus UI state is also client-observed.

**Recommended fix:**

- Revoke direct update policy on `user_usage`.
- Maintain counters with triggers or security-definer RPCs.
- Mirror RevenueCat entitlements server-side via webhook before enforcing premium server decisions.

### 10. Add push notification rate limits and mute controls

**Status:** Rate-limit foundation addressed locally by `supabase/migrations/20260426140000_social_notification_rate_limits.sql` and the `send-social-notifications` edge function. Mute/block controls remain future product work.

**Area:** social backend, abuse prevention  
**Evidence:** `supabase/functions/send-social-notifications/index.ts` fans out to recipient devices; `services/sharedFeedService.ts` invokes sends after sharing.

**Risk:** A legitimate friend can send many shared posts and repeatedly push every recipient device.

**Recommended fix:**

- Add per-actor and per-recipient cooldowns.
- Store notification events with rate-limit windows.
- Add mute/block controls and enforce them in the edge function.

### 11. Catch fire-and-forget shared media hydration failures

**Status:** Addressed locally in `hooks/useSharedFeedStore.tsx`; background hydration logs failures instead of rethrowing into `void` callers.

**Area:** frontend async reliability  
**Evidence:** `hooks/useSharedFeedStore.tsx:648` rethrows from `hydrateSharedPostMediaWhenReady`, while several callers use `void`.

**Risk:** Failed media download/cache patch can become an unhandled promise rejection.

**Recommended fix:**

- Make background hydration absorb and log expected failures.
- Or require every `void hydrate...` call to attach `.catch`.
- Add a mocked failing-media test.

### 12. Fix feed-card memo comparison for synced photo URIs

**Status:** Addressed locally in `components/home/NotesFeed.tsx`; photo-card memo comparison now includes `photoSyncedLocalUri`, with a regression test covering sync hydration of a display URI.

**Area:** frontend rendering correctness  
**Evidence:** `components/home/NotesFeed.tsx:65` compares a subset of note media fields, while display URI resolution can use `photoSyncedLocalUri`.

**Risk:** A card can stay stale after sync/hydration populates a displayable URI.

**Recommended fix:**

- Compare a precomputed `displayPhotoUri`.
- Or include all fields consumed by `getNotePhotoUri`.
- Add a regression test where `photoSyncedLocalUri` changes without `photoLocalUri`.

### 13. Make note and shared-post cards' main visual surface actionable

**Status:** Addressed locally in `components/home/MemoryCardPrimitives.tsx`; note and shared-post visual cards are now full-surface accessible press targets, while footer export/detail and status badges remain separate controls.

**Area:** UX, accessibility  
**Evidence:** `components/home/MemoryCardPrimitives.tsx:558` limits primary open action to small metadata/chevron controls.

**Risk:** The biggest visible surface is inert, and accessibility users get small duplicate targets.

**Recommended fix:**

- Wrap each visual card in a single accessible `Pressable`.
- Keep secondary actions separate.
- Ensure hit targets are at least 44x44 points.

### 14. Scope or clear Android tab search state

**Status:** Addressed locally in `components/screens/search/SearchScreen.tsx`; Android tab search query is cleared on search-screen blur, with regression coverage in `__tests__/searchScreen.test.tsx`.

**Area:** navigation state  
**Evidence:** `hooks/useAndroidTabSearchState.ts:8` uses a process-global singleton; `clearAndroidTabSearch` exists but is not wired.

**Risk:** Last query can survive tab changes, account changes, or remounts.

**Recommended fix:**

- Clear on Search blur/unmount or tab switch.
- If persistence is desired, scope it by user/session and document it.

### 15. Add a unique constraint for sync queue coalescing

**Status:** Addressed locally in `services/database.ts` and `services/syncService.ts`; queue coalescing now uses a partial unique index and atomic `ON CONFLICT` updates, with regression coverage pinning the migration and enqueue SQL shape.

**Area:** sync queue correctness  
**Evidence:** `services/database.ts:1071` creates a non-unique `(owner_uid, coalesce_key)` index; enqueue does select-then-insert/update at `services/database.ts:431`.

**Risk:** Concurrent enqueues can create duplicate work for the same entity.

**Recommended fix:**

- Add partial unique index: `(owner_uid, coalesce_key) WHERE coalesce_key IS NOT NULL`.
- Use atomic `INSERT ... ON CONFLICT DO UPDATE`.

### 16. Enable SQLite foreign keys on every connection

**Status:** Addressed locally in `services/database.ts` by enabling foreign keys after database open, with regression coverage that pins the connection-level PRAGMA during initialization.

**Area:** local persistence integrity  
**Evidence:** `services/database.ts:659` sets WAL but not `PRAGMA foreign_keys = ON`; tables declare cascades around `services/database.ts:696`.

**Risk:** Declared `ON DELETE CASCADE` behavior is not enforced by default in SQLite.

**Recommended fix:**

- Run `PRAGMA foreign_keys = ON` immediately after opening the database.
- Keep explicit cleanup as defense in depth.
- Add a test that deleting a note removes doodles/stickers through FK behavior.

### 17. Make release build plugin failures fail fast

**Status:** Addressed locally for widget/native-source checks and widget entitlement mutation scope, with release/prebuild regression coverage for Android widget sources, Live Photo native sources, Expo Widgets bundle copying, and iOS widget entitlement settings.

**Area:** native build reliability  
**Evidence:**

- `plugins/withExpoWidgetsBundleFix.js:51` warns if widget bundle sources are missing.
- `plugins/withLivePhotoMotionTranscoder.js:92` warns if native source files cannot be copied.
- `plugins/withCustomWidgetSwift.js:55` allows entitlement modification in all configurations.

**Risk:** Release builds can silently ship missing widget/native behavior or hide provisioning drift.

**Recommended fix:**

- Throw for Release/EAS builds when required files are absent.
- Restrict entitlement mutation to Debug or remove it.
- Add prebuild verification for widget bundle and App Group entitlements.

### 18. Make OTA project configuration explicit

**Status:** Addressed locally in `app.config.js`; EAS builds require `EXPO_PUBLIC_EAS_PROJECT_ID`, and updates are disabled when no update URL is configured.

**Area:** EAS Update safety  
**Evidence:** `app.config.js:21` falls back to a hardcoded EAS project ID if env is absent.

**Risk:** Preview/local builds can accidentally subscribe to the real update project.

**Recommended fix:**

- Require `EXPO_PUBLIC_EAS_PROJECT_ID` for all EAS builds.
- Disable updates for local dev when the env is missing.
- Document per-channel runtime/version policy.

### 19. Improve background location privacy copy

**Status:** Addressed locally in `app.config.js`; the Always permission copy now mentions background reminders at saved places.

**Area:** app review, user trust  
**Evidence:** `app.config.js:218` location always copy under-explains background reminders.

**Risk:** Users and App Review may see the prompt as foreground-only while the app needs background geofence reminders.

**Recommended fix:**

- Mention background place reminders explicitly in the Always permission copy.
- Keep foreground copy focused on saving/finding memories.

### 20. Sanitize native privacy logs

**Status:** Addressed locally in `modules/noto-subject-cutout/android/src/main/java/expo/modules/notosubjectcutout/NotoSubjectCutoutModule.kt`; verbose source-path/error logging is debug-only, release logs use error categories, and the module explicitly generates `BuildConfig`.

**Area:** privacy, production diagnostics  
**Evidence:** `modules/noto-subject-cutout/android/src/main/java/expo/modules/notosubjectcutout/NotoSubjectCutoutModule.kt:85` logs local source paths and errors.

**Risk:** User media filenames or local paths can leak through release device logs.

**Recommended fix:**

- Gate verbose logs with `BuildConfig.DEBUG`.
- Log error codes/categories in release, not absolute paths.

## Maintainability and Performance Themes

### Split giant orchestration surfaces

High-leverage candidates:

- `components/screens/HomeScreen.tsx` is about 3,200 lines and owns capture, draft persistence, sharing, paywall prompts, feed focus, dual capture, import flows, and sheet hosting.
- `services/syncService.ts` is about 3,000 lines and mixes queue repository, conflict logic, media transfer, cursor state, and usage/profile updates.
- `services/database.ts` is about 2,500 lines and mixes schema/migrations, repositories, transactions, search, recap cache, and sync queue helpers.
- `widgets/android/NotoWidgetProvider.kt` is about 3,300 lines and combines parsing, rendering, image decoding, layout binding, and update scheduling.

Suggested extraction order:

1. `HomeScreen`: extract capture save/draft/import controller first, then shared/paywall sheet host, then feed focus controller.
2. `syncService`: split queue repository, remote note repository, media artifact service, and conflict resolver.
3. `database`: split schema/migrations from note repository, sync queue repository, shared cache repository, and recap cache repository.
4. Widgets: split image loading/downsampling from layout binding.

### Centralize clocks and timers

**Status:** Addressed locally for the home feed by adding a shared relative-time clock provider; memory cards now reuse the feed clock instead of each starting their own minute timer.

`useRelativeTimeNow` creates one timer per mounted card. Move to a screen-level clock and pass `now` into cards, or provide a shared relative-time context. This reduces background timer churn in long feeds.

### Split state and actions contexts

**Status:** Addressed locally in `hooks/state/useNotesStore.tsx`; notes state and actions now have separate contexts while `useNotesStore()` remains backward compatible, with regression coverage for action-only consumers.

`hooks/state/useNotesStore.tsx:540` returns a fresh state/actions object. Screens that only need actions still re-render when notes change. Split into state and actions contexts, or use selector-based subscriptions for high-churn screens.

### Treat media references as a first-class model

Media fields are now spread across note content, local URI columns, synced URI columns, dual capture columns, paired video columns, sticker JSON, and remote paths. Create shared helpers:

- `collectLocalNoteMedia(note)`
- `collectRemoteNoteArtifacts(row)`
- `validateRemoteMediaPath(owner, path)`
- `diffRemoteArtifacts(previous, next)`

This reduces the chance that future dual/live/sticker fields are missed in cleanup, sync, widgets, or account deletion.

## Suggested Long-Term Backlog

### Security and backend

- Add SQL/RLS tests for media path ownership constraints and storage policy prefix checks.
- Keep service-role cleanup path validators in sync with SQL helper behavior.
- Move quota enforcement server-side.
- Add RevenueCat webhook mirror for entitlements.
- Add social notification rate limits and mute/block settings.
- Add Supabase function type/check CI with Deno.

### Sync and database

- Add optimistic local revisions.
- Convert sync metadata writes to targeted patch updates.
- Validate unique sync queue coalescing under concurrent enqueue pressure.
- Keep SQLite foreign keys enabled on every opened connection.
- Route all writes through a single database write queue.
- Add conflict telemetry for skipped/imported/merged records.

### Frontend

- Monitor shared-feed same-UID refresh behavior.
- Keep background hydration failures non-fatal and visible in logs.
- Correct feed card memo fields.
- Make card primary surfaces accessible press targets.
- Clear/scope Android search singleton.
- Split `HomeScreen` controllers.
- Split notes store state/actions contexts.
- Centralize relative-time ticking.

### Native, widgets, release

- Keep iOS widget image downsampling covered by large-photo smoke tests.
- Keep Android widget bitmap work bounded and cached.
- Keep release builds failing on missing widget/native sources.
- Keep Android debug-signing escape hatch blocked for EAS/production builds.
- Validate App Group entitlements in release.
- Make EAS Update project ID explicit.
- Sanitize release native logs.

## Verification Recommendations

Add these checks to CI or a release checklist:

- `npm run lint:ci`
- `npm run theme:audit`
- `npm run typecheck`
- `npm test -- --runInBand`
- `npm run expo:doctor`
- `npm run audit:prod`
- `npm run supabase:functions:check`
- SQL/RLS tests for forged media paths.
- Focused sync race tests with mocked delayed upload/download.
- Widget image stress tests with large photos.
- EAS/prebuild config assertions for signing, widget bundle, App Groups, and update project ID.

## Already Improved Since Prior Audit

These older concerns look partially or fully addressed in the current tree:

- Local orphan media cleanup now includes dual capture and synced local media fields in `services/mediaIntegrity.ts`.
- Delete-all remote sync now pages artifact rows before deletion in `services/syncService.ts`.
- Android background location permission is conditionally included in `app.config.js`.
- Shared post deletion cleanup now includes dual media in `services/sharedFeedService.ts`.
- Sync cursor clearing appears to distinguish explicit null from omitted fields in `services/syncService.ts`.
- iOS dual-camera capture setup is now serialized through the session queue in `modules/noto-dual-camera/ios/NotoDualCameraModule.swift`.
- Sticker asset storage paths have owner/path validation in the applied Supabase schema.
- Note/shared-post media paths now have owner validation in `supabase/migrations/20260426120000_harden_media_path_ownership.sql`.
- Android release signing, EAS update project configuration, widget image decoding, and release plugin failure behavior have local hardening patches.
- `docs/supabase-schema.md` captures the current app-facing Supabase schema for future implementation and review work.

Keep these in mind when reviewing older audit docs so the team does not chase stale items.
