# Repo Deep Audit - 2026-04-13

## Scope

This was a deep static audit of the checked-in repo, using six parallel sub-agents plus a local verification pass across:

- `app/`
- `components/`
- `hooks/`
- `services/`
- `utils/`
- `constants/`
- `supabase/`
- `widgets/`
- `modules/`
- `__tests__/`
- project config/docs where relevant

Notes:

- This is a code review and architecture audit, not a runtime pentest.
- `ios/` and `android/` are git-ignored in this repo, so the review focused on checked-in sources that survive prebuild.
- `npm run typecheck` passed during this audit.
- `npm run lint:ci` failed with 2 warnings in `components/screens/HomeScreen.tsx` and `components/screens/MapScreen.ios.tsx`.

## Executive Summary

The codebase has strong feature coverage and a lot of defensive logic already, but it is carrying several high-risk issues in four areas:

1. Auth/scope-sensitive async flows are still vulnerable to race conditions.
2. Some backend-facing paths weaken privacy or expose service-role power too broadly.
3. Widget/media pipelines can move too much data and do too much full-resolution work.
4. The repo structure is trending toward monolith files and overlapping ownership boundaries, which raises change risk.

## Highest-Priority Findings

### 1. High - Note mutations are not scope-stable across auth/scope changes

- Evidence:
  - `hooks/state/useNotesStore.tsx:261`
  - `services/database.ts:1257`
  - `services/database.ts:1447`
  - `services/database.ts:1609`
  - `services/database.ts:1726`
- Problem:
  `useNotesStore` captures the current scope and revision before async writes, but the DB mutation layer still reads the mutable global active scope internally. If sign-in, sign-out, or active scope changes mid-flight, the optimistic UI guard can prevent the wrong UI commit while the database write still lands in the wrong scope.
- Impact:
  Cross-account or cross-scope writes are possible under timing-sensitive transitions.
- Fix direction:
  Pass explicit scope through every note mutation API and remove implicit `getCurrentScope()` reads from mutation paths.

### 2. High - Subscription snapshot persistence can clobber cached state on startup

- Evidence:
  - `hooks/useSubscription.tsx:240`
  - `hooks/useSubscription.tsx:533`
- Problem:
  The cached subscription snapshot loads asynchronously, but the persistence effect writes a derived snapshot on render before hydration necessarily completes. On cold start, that can overwrite the last good cached snapshot with `free` / `null` defaults.
- Impact:
  Startup flicker, stale purchase UI, and lost offline fallback subscription state.
- Fix direction:
  Gate persistence behind a hydration-complete flag and avoid writing defaults until the initial cache load finishes.

### 3. High - Shared feed refresh dedupe can replay stale data right after mutations

- Evidence:
  - `services/sharedFeedService.ts:748`
  - `hooks/useSharedFeedStore.tsx:614`
- Problem:
  `refreshSharedFeed()` returns a cached snapshot for a short dedupe window. The store calls `refreshAll()` immediately after accept/add/remove actions, so the follow-up refresh can return the pre-mutation snapshot and overwrite newer optimistic state.
- Impact:
  Users can briefly see reverted friend/shared state after successful actions.
- Fix direction:
  Invalidate the dedupe snapshot after local mutations or add a `forceFresh` path for post-mutation refreshes.

### 4. High - Active invite cache is split across SQLite and AsyncStorage

- Evidence:
  - `services/sharedFeedCache.ts:304`
  - `services/sharedFeedCache.ts:334`
  - `services/sharedFeedCache.ts:397`
  - `services/inviteTokenStorage.ts:1`
- Problem:
  Invite metadata is cached in SQLite while the token is stored separately. Reads are non-atomic, cleanup is non-atomic, and `getCachedActiveInvite()` does not reject expired or revoked invite rows before reconstructing an offline invite.
- Impact:
  Crashes or partial cleanup can leave stale or mismatched invite state behind, especially offline.
- Fix direction:
  Store invite metadata and token in one durability boundary, or add validation and invalidation on every cached read.

### 5. High - `cleanup-sticker-assets` can become effectively public

- Evidence:
  - `supabase/functions/cleanup-sticker-assets/index.ts:99`
  - `supabase/config.toml:41`
- Problem:
  The edge function runs with the service role key, but only enforces bearer-secret auth when `STICKER_GC_SECRET` is configured. `verify_jwt = false` is also set for the function.
- Impact:
  If the secret is omitted in deployment, anyone can hit a service-role-backed cleanup endpoint and trigger storage deletion logic.
- Fix direction:
  Fail closed when the secret is missing, or require JWT plus server-side authorization instead of optional shared-secret auth.

### 6. High - Username lookup bypasses the newer profile privacy model

- Evidence:
  - `supabase/migrations/20260402113000_harden_profile_visibility_and_invite_tokens.sql:1`
  - `supabase/migrations/20260411150000_add_friend_search_by_username.sql:1`
- Problem:
  Profile table reads were restricted to self-or-friends, but `find_user_by_username()` is a `security definer` function that still returns `display_name`, `photo_url`, `is_self`, and `already_friends` for any matching username.
- Impact:
  Authenticated users can enumerate private profile data and relationship state despite the tighter profile RLS policy.
- Fix direction:
  Re-scope the RPC to the intended privacy model, reduce returned fields, and explicitly enforce discoverability rules inside the function.

### 7. High - Immediate geofence reminder suppression is racy for new notes

- Evidence:
  - `hooks/state/useNotesStore.tsx:261`
  - `services/geofenceService.ts:180`
  - `utils/backgroundGeofence.ts:127`
- Problem:
  `createNote()` fires `skipImmediateReminderForNewNote(note.id)` without awaiting it, then immediately syncs geofences. The background enter handler can race ahead before the suppression flag is persisted.
- Impact:
  Users can receive an immediate reminder for the note they just created.
- Fix direction:
  Make suppression persistence happen before geofence sync, or fold both into one ordered transaction.

### 8. High - Widget image fallback can explode payload size and memory usage

- Evidence:
  - `services/widget/media.ts:304`
  - `services/widget/media.ts:330`
  - `services/widgetService.ts:362`
  - `services/widget/platform.ts:77`
  - `widgets/ios/LocketWidget.swift:1881`
  - `widgets/android/NotoWidgetProvider.kt:1152`
- Problem:
  When file staging fails, widget props fall back to full base64 image blobs. Those props are repeated across timeline entries, and both native implementations decode them without downsampling.
- Impact:
  Higher bridge payloads, memory spikes, slow widget updates, and possible OOM behavior on large media.
- Fix direction:
  Remove base64 from the widget contract, prefer staged files/thumbnails only, and downsample on both iOS and Android decode paths.

## Medium-Priority Findings

### 9. Medium-High - Invite acceptance is not atomic

- Evidence:
  - `supabase/migrations/20260402113000_harden_profile_visibility_and_invite_tokens.sql:55`
  - `supabase/migrations/20260402113000_harden_profile_visibility_and_invite_tokens.sql:181`
- Problem:
  Invite rows are read and validated before membership rows are inserted, then marked consumed later. There is no lock or atomic consume step.
- Impact:
  Two concurrent requests can potentially redeem the same single-use invite.
- Fix direction:
  Use `SELECT ... FOR UPDATE`, or consume the invite in a single conditional update before inserting membership rows.

### 10. Medium - Web invite tokens are stored in JS-accessible storage

- Evidence:
  - `utils/secureStorage.ts:1`
  - `services/inviteTokenStorage.ts:1`
- Problem:
  On web, invite bearer tokens fall back to `AsyncStorage`, which is accessible to frontend JavaScript.
- Impact:
  XSS or hostile browser extensions can read reusable invite secrets.
- Fix direction:
  Avoid persisting invite bearer tokens on web, or move to a server-mediated flow that does not rely on long-lived client-side invite secrets.

### 11. Medium - Social push delivery lacks idempotency or rate limiting

- Evidence:
  - `supabase/config.toml:44`
  - `supabase/functions/send-social-notifications/index.ts:332`
- Problem:
  The function checks authentication and ownership, but repeated valid calls for the same event are not deduplicated or throttled.
- Impact:
  Authenticated users can spam recipients with duplicate push notifications.
- Fix direction:
  Add server-side idempotency keys, event tables, or per-user/per-event rate limiting.

### 12. Medium - Shared invite suppression flag can hide valid future invites

- Evidence:
  - `hooks/useSharedFeedStore.tsx:145`
  - `hooks/useSharedFeedStore.tsx:585`
- Problem:
  `suppressActiveInviteRef` is set during revoke flows, and `applySnapshot()` continues nulling future invite snapshots while the flag stays true.
- Impact:
  Fresh invite state can stay hidden until another unrelated path clears the suppression flag.
- Fix direction:
  Reset suppression when the server snapshot changes or scope it only to the specific revoked invite id.

### 13. Medium - Cached geofence refresh can update state after the hook should stop caring

- Evidence:
  - `hooks/useGeofence.ts:136`
- Problem:
  The background refresh branch fires `resolveCurrentPosition()` without cancellation guards after returning a cached location.
- Impact:
  Late state updates can land after unmount or permission changes.
- Fix direction:
  Add cancellation/active guards around the deferred refresh path.

### 14. Medium - Local note deletion does not directly invalidate shared-feed projections

- Evidence:
  - `hooks/state/useNotesStore.tsx:375`
  - `hooks/state/useNotesStore.tsx:402`
  - `hooks/useSharedFeedStore.tsx:797`
- Problem:
  Deleting local notes updates local note state and sync state, but the related shared-feed projections are only cleaned if separate shared-feed deletion helpers run.
- Impact:
  Shared moments can remain visible locally until a later refresh.
- Fix direction:
  Route note delete/deleteAll through shared deletion helpers or trigger an immediate shared projection invalidation.

### 15. Medium - Shared-feed photo hydration rewrites the whole cache too aggressively

- Evidence:
  - `hooks/useSharedFeedStore.tsx:284`
  - `services/sharedFeedCache.ts:417`
- Problem:
  Hydrating photo URIs persists the full snapshot back to SQLite, and the cache layer does full delete-and-reinsert writes.
- Impact:
  Large feeds incur unnecessary SQLite churn and more widget refresh work than necessary.
- Fix direction:
  Persist only authoritative snapshots or patch just the changed media fields.

### 16. Medium - Search query state is split across screen and tab shell on Android

- Evidence:
  - `components/navigation/AndroidFloatingTabBar.tsx:202`
  - `components/screens/search/SearchScreen.tsx:41`
- Problem:
  The Android tab shell owns live search focus/query behavior while the search screen mirrors that state into its own local `query`.
- Impact:
  Extra renders, stale-state edges, and more complexity than necessary for a simple search box.
- Fix direction:
  Choose one source of truth for the search query and make the other layer purely presentational.

### 17. Medium - `MapScreen.ios` has an untracked delayed state update

- Evidence:
  - `components/screens/MapScreen.ios.tsx:672`
- Problem:
  `focusFriendPost()` uses `setTimeout()` to open the friends preview without storing or clearing the timer.
- Impact:
  Preview state can reopen after context changes or after unmount.
- Fix direction:
  Store the timer in a ref and clear it on reschedule and unmount.

### 18. Medium - Capture photo filtering does full-resolution work inline

- Evidence:
  - `services/photoFilters.ts:102`
  - `components/screens/HomeScreen.tsx:1434`
- Problem:
  Filtered capture saves decode the original image to a full-size Skia surface and re-encode it at source resolution.
- Impact:
  Long stalls and possible memory pressure on large photos.
- Fix direction:
  Downsample before decode/render and cap output dimensions.

### 19. Medium - Notes grid cells do too much parsing and derived work per render

- Evidence:
  - `components/screens/notes/NotesScreen.tsx:107`
- Problem:
  `GridTile` computes doodle parsing, sticker parsing, gradients, and motion variants inside the cell itself.
- Impact:
  Avoidable JS work during grid renders and harder-to-reason-about cell performance.
- Fix direction:
  Precompute lightweight tile view models before render and keep tile props primitive.

## Structural / DRY / Simplification Findings

### 20. Medium - Several core files are monoliths and mix too many responsibilities

- Evidence:
  - `services/syncService.ts:1` (~2239 LOC)
  - `services/database.ts:1` (~2031 LOC)
  - `services/sharedFeedService.ts:1` (~1526 LOC)
  - `services/noteStickers.ts:1` (~1705 LOC)
  - `components/screens/HomeScreen.tsx:1` (~2018 LOC)
  - `components/notes/NoteDetailSheet.tsx:1` (~1954 LOC)
  - `components/screens/MapScreen.ios.tsx:1` (~1060 LOC)
- Problem:
  The biggest files mix orchestration, transformation, side effects, and view logic.
- Impact:
  Reviews get harder, regressions hide more easily, and team ownership becomes fuzzy.
- Fix direction:
  Split by domain behavior, not by arbitrary helper extraction. Keep a thin facade file where API stability matters.

### 21. Medium - Startup and provider composition are too centralized

- Evidence:
  - `components/app/AppProviders.tsx:1`
  - `app/_layout.tsx:1`
- Problem:
  Bootstrapping, route config, splash gating, notification routing, theme wiring, and provider ordering are concentrated at the root.
- Impact:
  Global change blast radius is larger than it needs to be.
- Fix direction:
  Keep the root layout focused on shell/bootstrap and move route-specific concerns closer to route groups/features.

### 22. Medium - Platform screen duplication is increasing maintenance cost

- Evidence:
  - `components/screens/settings/SettingsScreen.ios.tsx:1`
  - `components/screens/settings/SettingsScreen.android.tsx:1`
  - `components/screens/profile/ProfileScreen.ios.tsx:1`
  - `components/screens/profile/ProfileScreen.android.tsx:1`
- Problem:
  Similar section/row composition is repeated across platform files with only presentation differences.
- Impact:
  Easy drift between platforms and more files touched for simple product changes.
- Fix direction:
  Extract shared feature models/renderers and keep platform wrappers thin.

### 23. Medium - Hook/export surface is noisier than necessary

- Evidence:
  - `hooks/useNotes.ts:1`
  - `hooks/useFeedFocus.ts:1`
  - `hooks/useActiveNote.tsx:1`
  - `hooks/useActiveFeedTarget.ts:1`
- Problem:
  Several top-level hooks are thin re-export shims over implementation folders.
- Impact:
  Ownership boundaries are less obvious and import discipline gets fuzzy.
- Fix direction:
  Standardize one public hook surface and keep internal implementation paths private.

### 24. Medium - Duplicate normalization logic risks behavior drift

- Evidence:
  - `services/textNormalization.ts:1`
  - `services/normalizedStrings.ts:1`
  - `services/noteAppearance.ts:1`
- Problem:
  Similar normalization concerns are implemented in multiple places.
- Impact:
  Search, ranking, and display behavior can drift subtly over time.
- Fix direction:
  Collapse onto one canonical normalization module with focused tests.

### 25. Low-Medium - `useHomeFeedPagination` reads like dead abstraction

- Evidence:
  - `hooks/app/useHomeFeedPagination.ts:1`
- Problem:
  It accepts pagination-oriented inputs but always returns `hasMore = false`, `isLoading = false`, `isLoadingMore = false`, and `loadNextPage()` just returns all current items.
- Impact:
  The code suggests a paging system that does not exist, increasing conceptual overhead.
- Fix direction:
  Either implement real paging or inline/remove the abstraction.

### 26. Low - Strict lint is currently red

- Evidence:
  - `components/screens/HomeScreen.tsx:146`
  - `components/screens/MapScreen.ios.tsx:12`
- Problem:
  `npm run lint:ci` fails because of unused symbols.
- Impact:
  CI hygiene is currently not fully clean.
- Fix direction:
  Remove the unused variables/imports or wire them back in intentionally.

## Test Coverage Gaps

The repo has good test coverage overall, but several brittle helpers still lack direct, narrow tests:

- `services/accountCleanup.ts:42`
- `services/noteMutationHelpers.ts:13`
- `services/feedTargetLookup.ts:9`
- `services/noteDoodles.ts:14`
- `services/mediaTypeUtils.ts:3`

Recommended additions:

- mutation ordering and scope invariants
- invite cache validation and cleanup behavior
- widget payload size / image fallback behavior
- rate-limit or duplicate-send behavior around social pushes
- filter rendering bounds and downsample expectations

## Suggested Remediation Order

1. Fix the security issues in Supabase functions and RPCs.
2. Remove implicit scope reads from note mutations.
3. Fix startup/shared-feed race conditions.
4. Reduce widget/media payload size and full-resolution processing.
5. Split the worst monolith files and remove dead abstractions.

## Verification Snapshot

- `npm run typecheck`: passed
- `npm run lint:ci`: failed due to 2 warnings
- Deep review method: six parallel audit tracks plus local verification of the highest-risk findings
