# Noto Repository Security, Performance, and UI/UX Audit

**Audit date:** 2026-06-05  
**Repository snapshot:** `codex/fix-startup-splash-alert-flow` at `2aff6861`  
**Scope:** Expo/React Native application code, local persistence, Supabase migrations and Edge Functions, widgets, native modules/config plugins, tests, dependencies, accessibility, rendering, and major user flows.

## Executive Summary

The repository has a stronger baseline than most apps of similar size. Authentication sessions use native secure storage, remote media paths are ownership-scoped, current Supabase changes contain meaningful RLS hardening, SQL queries are generally parameterized, release signing is guarded, the production dependency audit is clean, and all automated checks pass.

The highest-risk local privacy gaps were remediated during this audit. SQLite now uses SQLCipher with a SecureStore-held key and a guarded plaintext-to-encrypted migration. Sensitive MMKV records now use AES-256 encryption, Android backup is disabled, and iOS complete file protection is enabled. Private media still relies on platform file protection rather than independent per-file application encryption, and the SQLCipher migration still needs physical-device upgrade testing before release.

The largest confirmed performance issues were also reduced. Startup now retains a bounded 24-note page, Home and Notes load incrementally, and full archives are fetched only by features that need them. High-cost shared-feed consumers use selectors, search dispatch is debounced, capture drafts write less often, and native media uploads avoid full JavaScript buffers when available. Large feature modules and remaining compatibility consumers still warrant profiler-led extraction.

No critical remotely exploitable vulnerability was confirmed from the checked-in code. The report contains **2 high-priority**, **6 medium-priority**, and **6 lower-priority** findings.

## Automated Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint:ci` | Pass |
| `npm audit --omit=dev --json` | Pass: 0 known production vulnerabilities |
| `npm run theme:audit` | Pass, with 581 tracked raw color literals across 61 files |
| `npm run supabase:functions:check` | Pass |
| `npx expo-doctor` | Pass: 19/19 checks |
| `npm test -- --runInBand` | Pass after remediation: 141 suites, 1,127 tests |

The final Jest run was free of the previously observed Note Detail `act(...)` warnings and Expo notification environment warning. Unexpected console warnings and errors remain guarded globally.

Two release validations remain external to this repository-only pass:

- Android emulator upgrade verification now passes with preserved local notes and a non-plaintext database header. Physical iOS and Android upgrade testing is still required, including interruption and missing-key recovery cases.
- Reconstruct and verify the complete Supabase baseline from the authoritative linked project once project credentials are available.

## Remediation Status

Implementation work started on 2026-06-05. The table below distinguishes completed repository fixes from work that needs a production data/deployment migration.

| Finding | Status | Implemented remediation |
| --- | --- | --- |
| H1 local data encryption | Substantially remediated | Enabled Expo SQLCipher and added a SecureStore-keyed migration that exports and verifies an encrypted database before deleting the readable plaintext source. Interrupted exports are detected and safely adopted on the next launch. Stale development clients can temporarily keep using a readable plaintext database, while production and encrypted databases still fail closed without SQLCipher. Added AES-256 encrypted MMKV with a secure fallback; migrated auth snapshots, push identity/token data, installation IDs, and capture drafts; disabled Android backup; enabled complete iOS data protection. Private media uses platform file protection and backup exclusion but is not independently application-encrypted. |
| H2 unbounded note hydration | Remediated | The global notes store now starts with and retains a 24-note page, exposes guarded incremental loading, and no longer hydrates the entire archive at startup. Home and Notes load additional pages near the end. Map and recap load complete datasets only while their screens/features are active. Reminder and widget refreshes no longer receive incomplete paged arrays. |
| M1 push controls fail open | Remediated | Idempotency and throttle RPC failures now fail closed with a retryable `503`; regression tests prove the Expo Push API is not called. |
| M2 incomplete Supabase history | Blocked on linked-project access | A trustworthy baseline must be generated from the linked production project and validated with `supabase db reset --local`. The recovery procedure is now documented in `docs/supabase-setup.md`. On 2026-06-05, CLI access was unavailable because no `SUPABASE_ACCESS_TOKEN` was configured and `supabase/config.toml` still contains a placeholder project ID. |
| M3 broad shared-feed context | Remediated for high-cost consumers | Added selector-based external-store subscriptions and moved Map/Notes shared-post consumers to narrow selectors. Added a render-count regression for presence-only updates. Compatibility consumers can migrate incrementally. |
| M4 frequent plaintext draft writes | Remediated | Capture drafts use encrypted storage, an 800 ms debounce, and an immediate background checkpoint. |
| M5 JS media amplification | Partially remediated | Photo and live-photo uploads now prefer Expo's native background binary file upload directly to authenticated Supabase Storage, avoiding full ArrayBuffer allocation on native. The existing bounded ArrayBuffer path remains as a web/unavailable fallback. Sticker hashing and avatar data-URI conversion still require in-memory bytes. |
| M6 oversized screens | In progress | Draft persistence and shared-feed selection responsibilities are now narrower, but the large feature modules still need incremental extraction backed by profiler measurements. |
| L1/L2 accessibility semantics and localization | Remediated for audited controls | Added explicit roles, states, hit slop, and localized labels to the reported onboarding, detail, search, map, doodle, and note-color controls. |
| L3 touch targets | Confirmed/partially remediated | The shared `AppIconButton` already enforces a 44-point frame; audited standalone back actions now include hit slop. A repository-wide layout assertion remains useful. |
| L4 reduced motion | Partially remediated | Corrected infinite Notes and detail skeleton pulses to become static under reduced motion. Broader animation review remains ongoing. |
| L5 Jest warning noise | Remediated for observed warnings | Removed redundant Note Detail and Capture Card state scheduling, isolated push dependencies in tests that do not exercise notifications, and removed the Expo notification warning allowlist. Unexpected console warnings/errors continue to fail tests through the global guard. |
| L6 theme literal debt | Open | No broad color rewrite was attempted because many literals are fixed artwork/native assets; the existing baseline gate remains active. |
| Default map location | Remediated | Replaced the Ho Chi Minh City fallback with a neutral world viewport when neither notes nor device location are available. |
| Overlapping search work | Remediated | Added a short cancellable debounce before SQLite search dispatch. |

## Findings

### H1. Sensitive local data is not encrypted at rest

**Category:** Security / privacy  
**Impact:** High  
**Likelihood:** Medium

The primary SQLite database stores private note text, captions, exact latitude/longitude, prompt answers, shared post/chat text, invite tokens, media paths, and sync payloads in a normal Expo SQLite database:

- `services/database.ts:653-700`
- `services/database.ts:729-758`
- `services/database.ts:783-895`

There is no SQLCipher setup or equivalent application-level database encryption. Photos, live-photo videos, and stickers are also stored under the app document directory:

- `services/photoStorage.ts:10-12`
- `services/livePhotoStorage.ts:10-15`
- `services/noteStickers.ts:149-153`

MMKV is created without encryption:

- `utils/appStorage.ts:22-25`

That MMKV instance stores an auth profile snapshot, Expo push token and user ID, capture draft text/media paths, sync metadata, and user preferences:

- `hooks/useAuth.tsx:503-538`
- `services/socialPushService.ts:161-203`
- `components/screens/HomeScreen.tsx:798-851`

Supabase session tokens are correctly stored in SecureStore on native platforms, and active invite tokens also use the secure-storage wrapper. The broader user content does not.

**Risk scenarios**

- A rooted/jailbroken or otherwise compromised device can extract private notes and precise location history.
- Device backup or forensic tooling can recover content that users reasonably consider private.
- Unfinished text/photo drafts remain readable outside the intended capture UI.
- Push tokens and profile metadata can be correlated with a user account.

**Recommendation**

1. Define a data-classification policy: credentials, identifiers, private content, precise location, public/cache data.
2. Use an encrypted SQLite solution or encrypt sensitive columns before persistence. Store the encryption key in SecureStore/Keychain/Keystore.
3. Use MMKV encryption for sensitive small-value storage, with the key held in SecureStore.
4. Move the auth profile snapshot, push registration, installation ID, and capture draft to encrypted storage.
5. Apply platform file-protection attributes to private media and exclude ephemeral/sensitive artifacts from backup where appropriate.
6. Add a migration and key-loss strategy before enabling encryption in production.

### H2. The app fully hydrates an unbounded note history into global React state

**Category:** Performance / scalability / rerendering  
**Impact:** High  
**Likelihood:** High as user history grows

Startup first fetches 24 notes, then always calls `getAllNotesForScope`:

- `hooks/state/useNotesStore.tsx:106-176`
- `services/database.ts:2011-2021`

The full records include decoration JSON and media metadata due to the joined `NOTES_FROM_CLAUSE`. The resulting array is held in `NotesStateContext`, and every mutation creates a new collection:

- `hooks/state/useNotesStore.tsx:716-760`

Consumers then perform full-array derivations:

- Home feed merge/sort in `components/screens/HomeScreen.tsx`
- Grid model construction in `components/screens/notes/NotesScreen.tsx:388-415`
- Map filtering, grouping, sorting, and Supercluster rebuild in `hooks/map/useMapScreenState.ts:41-79`
- Search fallback filtering in `hooks/state/useNotesStore.tsx`

This design is reasonable for tens of notes but will increase startup memory, JS work, garbage collection, map rebuild time, and mutation cost with hundreds or thousands of notes. FlashList virtualizes views, but it does not reduce the size or derivation cost of the backing arrays.

**Recommendation**

1. Keep the initial 24-note stage as the default in-memory feed window.
2. Add cursor-based pagination to the notes store and home/grid screens.
3. Query recap and map summaries from SQLite rather than requiring every full note record in React state.
4. Split decoration payloads from feed metadata and load them only for visible/detail items.
5. Use ID-indexed normalized state for mutations instead of repeatedly copying full rich objects.
6. Add performance tests with 1,000 text notes, 500 photo notes, and decoration-heavy records.

### M1. Social push security controls fail open

**Category:** Security / abuse prevention  
**Impact:** Medium  
**Likelihood:** Low to Medium

The notification Edge Function authenticates callers and validates that the actor owns or participates in the resource. That is good. However, two important abuse controls deliberately fail open:

- If event claiming fails, delivery continues without idempotency: `supabase/functions/send-social-notifications/index.ts:507-527`
- If recipient reservation fails, delivery continues without throttling: `supabase/functions/send-social-notifications/index.ts:446-459`

A partial database/RPC deployment issue can therefore produce duplicate or unthrottled pushes while the rest of the function remains operational. Repeated authenticated calls could annoy recipients and create notification-provider cost.

**Recommendation**

- Fail closed with `503` when idempotency or throttle reservation cannot be established.
- If availability is preferred, place the event in a durable queue and retry server-side.
- Add an alert for RPC failures and delivery volume anomalies.
- Add tests proving that claim/reservation errors do not call the Expo Push API.

### M2. Supabase schema history is not self-contained

**Category:** Security assurance / deployment reliability  
**Impact:** Medium  
**Likelihood:** Medium

The checked-in migrations begin by altering an already-existing schema. Core tables such as `notes`, `profiles`, `friendships`, `friend_invites`, `shared_posts`, storage buckets, and their baseline RLS policies are not created in this migration history. Only newer tables and hardening changes are represented.

Examples:

- `supabase/migrations/20260426120000_harden_media_path_ownership.sql`
- `supabase/migrations/20260426150000_add_note_local_revision.sql`
- `supabase/migrations/20260503123000_friend_groups_and_shared_responses.sql`

This prevents a clean local reset from proving the complete authorization model. It also makes disaster recovery and environment parity dependent on undocumented remote state.

**Recommendation**

1. Check in a baseline migration that can create the full schema, buckets, functions, grants, triggers, and RLS policies from an empty project.
2. Add CI that runs `supabase db reset` and then executes authorization tests as multiple users.
3. Generate `docs/supabase-schema.md` from the migrated schema instead of treating documentation as the source of truth.
4. Add negative tests for cross-user note access, media reads, direct-chat creation, response/reaction mutation, invite acceptance, and profile lookup.

### M3. Shared feed uses one broad context for unrelated high-churn state

**Category:** Performance / rerendering  
**Impact:** Medium  
**Likelihood:** High

`SharedFeedStoreContext` exposes feed readiness, friends, presence, groups, posts, invites, and more than 25 actions in one value:

- `hooks/useSharedFeedStore.tsx:93-174`
- `hooks/useSharedFeedStore.tsx:1441-1462`
- `hooks/useSharedFeedStore.tsx:2293-2324`

The memoized value changes whenever presence, loading state, connectivity-dependent actions, friends, groups, posts, invite state, or many callbacks change. Every consumer of `useSharedFeedStore()` rerenders even if it reads only one action or one slice. This reaches large screens such as Home, Map, Notes, chat, settings, and detail sheets.

**Recommendation**

- Split state and actions first, matching the existing notes-store pattern.
- Split presence, social graph, shared posts, and chat APIs into separate contexts or use selector-based external state.
- Keep action identities stable through refs where they do not need state closure.
- Add render-count tests for Home, Map, and Notes when only friend presence or invite state changes.

### M4. Draft persistence performs frequent full JSON writes and stores private content in plain MMKV

**Category:** Performance / privacy  
**Impact:** Medium  
**Likelihood:** High during capture

The complete capture draft, including text, media URIs, audience choice, and sticker placements, is serialized after a 240 ms debounce:

- `components/screens/HomeScreen.tsx:798-866`
- `components/screens/home/captureDraftPersistence.ts:9-17`

MMKV writes are synchronous in the native implementation even though the wrapper returns a promise. Large sticker placement payloads or rapid typing can therefore add JS-thread work during an interaction-heavy screen. The same behavior also contributes to H1.

**Recommendation**

- Increase the debounce and persist only when the app backgrounds, capture mode changes, or a meaningful checkpoint occurs.
- Store a compact draft record; keep large decoration payloads in SQLite or a dedicated file.
- Encrypt draft content.
- Measure typing and camera-control responsiveness while a decoration-heavy draft is active.

### M5. Media conversion can amplify memory on the JS thread

**Category:** Performance / memory stability  
**Impact:** Medium  
**Likelihood:** Medium

Several paths load full files into JavaScript memory:

- Base64 photo reads: `services/photoStorage.ts:61-80`
- Full ArrayBuffer uploads: `services/remoteMedia.ts:240-263`
- Avatar conversion to a data URI: `services/profileAvatar.ts:99-108`
- Sticker byte copying and hashing: `services/noteStickers.ts:306-328`
- View-shot image inlining: `components/notes/NoteStickerCanvas.tsx:102-133`

Base64 adds roughly 33% size overhead and often creates multiple strings/buffers. Current size caps limit some paths, which reduces risk, but concurrent photo, sticker, widget, or sync work can still create memory spikes on older devices.

**Recommendation**

- Prefer file/Blob streaming or native upload APIs where supported.
- Avoid data-URI conversion for avatars; upload a file body.
- Cache computed sticker hashes by file metadata.
- Bound concurrent media preparation globally, not only within individual features.
- Add low-memory-device tests around dual capture, live photos, and sticker-heavy exports.

### M6. Very large screen modules increase regression and render-risk concentration

**Category:** Maintainability / performance risk  
**Impact:** Medium  
**Likelihood:** High

Several UI modules combine data orchestration, subscriptions, animation, keyboard handling, persistence, and rendering:

- `components/screens/shared/SharedPostChatScreen.tsx`: about 4,018 lines
- `components/screens/HomeScreen.tsx`: about 3,296 lines
- `components/notes/NoteDetailSheet.tsx`: about 2,140 lines
- `components/home/SharedManageSheet.tsx`: about 1,858 lines
- `components/home/CaptureCard.tsx`: about 1,792 lines

This is not a vulnerability by itself, but it makes hook dependency mistakes, duplicated derived work, accidental parent rerenders, and lifecycle races harder to detect. `HomeScreen` alone contains more than 100 hooks/memo/effect/list-related call sites.

**Recommendation**

- Extract feature controllers with narrow inputs/outputs: draft persistence, capture save transaction, feed navigation, chat composer, response mutation, and keyboard coordination.
- Keep list rows memoized and pass primitive/stable props.
- Add React Profiler baselines before and after extraction; do not refactor solely for line count.

### L1. Some interactive controls rely on inferred accessibility

**Category:** UI/UX / accessibility  
**Impact:** Low to Medium  
**Likelihood:** High for assistive-technology users

The app has substantial accessibility work, but several user-facing controls lack explicit roles, labels, or states:

- Note-not-found back action: `components/notes/detail/NoteDetailSheetContent.tsx:360-370`
- Shared-post-not-found back action: `components/shared/SharedPostDetailSheet.tsx:110-121`
- Onboarding skip/not-now action: `app/auth/onboarding.tsx:296-312`
- Search filter chips expose selected state but no explicit label: `components/screens/search/SearchScreen.tsx:440-471`

React Native may infer labels from child text, but explicit semantics are more reliable and easier to test.

**Recommendation**

- Require `accessibilityRole`, localized `accessibilityLabel`, and relevant `accessibilityState` for every interactive primitive.
- Add an ESLint rule or shared wrapper component to enforce this.
- Add screen-reader tests for onboarding, capture, note details, map filters, and chat.

### L2. Several accessibility labels bypass localization

**Category:** UI/UX / localization  
**Impact:** Low  
**Likelihood:** High for Vietnamese users

Examples include hardcoded map-marker labels and doodle color labels:

- `components/map/MapCanvas.tsx:882-1005`
- `components/home/capture/DoodleColorPalette.tsx:47`
- Fallback tab search label: `components/navigation/AndroidFloatingTabBar.tsx:961`
- Color picker fallback text: `components/ui/NoteColorPicker.tsx:64`

Visible UI may be translated while VoiceOver/TalkBack still announces English.

**Recommendation**

- Route all accessibility strings through `react-i18next`.
- Add an i18n test that scans literal `accessibilityLabel` values.

### L3. Small visual controls should be checked for 44/48-point touch targets

**Category:** UI/UX / accessibility  
**Impact:** Low  
**Likelihood:** Medium

Many visual buttons are 28-38 points wide/high. Some have `hitSlop`, but this is not consistently obvious. Examples occur in note-detail toolbars, map callouts, chat composer controls, shared-management rows, and recap controls.

**Recommendation**

- Standardize a minimum 44 pt iOS / 48 dp Android interactive frame in `AppIconButton` and related primitives.
- Permit smaller artwork inside a larger pressable.
- Add snapshot/layout assertions for critical icon buttons.

### L4. Reduced-motion support is broad but not systematic

**Category:** UI/UX / accessibility  
**Impact:** Low  
**Likelihood:** Medium

Many important components use `useReducedMotion`, which is a strength. The codebase still contains more than 200 animation declarations, while reduced-motion handling is present in a much smaller subset of components. Decorative recap, map, chat, skeleton, and transition animations should be reviewed individually.

**Recommendation**

- Centralize motion durations/springs behind reduced-motion-aware helpers.
- In reduced-motion mode, stop infinite pulses/repeats and replace spatial transitions with opacity or immediate state changes.
- Add a test configuration that forces reduced motion globally.

### L5. Quality gates are green but Jest warning noise is high

**Category:** Test reliability  
**Impact:** Low  
**Likelihood:** High

The full suite passes, but repeated unwrapped React update warnings are emitted from capture and note-detail tests. Expo notification environment warnings also appear. Persistent noise trains contributors to ignore stderr and can hide a new state-update-after-unmount or lifecycle warning.

**Recommendation**

- Fix asynchronous tests with `act`, fake timers, and explicit cleanup.
- Mock `expo-notifications` before importing modules that register notification behavior.
- Make unexpected `console.error` and `console.warn` fail tests, with a small explicit allowlist.
- Run `npm test -- --runInBand` in CI with warning output treated as actionable debt.

### L6. Theme consistency still carries substantial tracked debt

**Category:** UI consistency / maintainability  
**Impact:** Low  
**Likelihood:** Medium

The theme audit passes against its baseline, but reports 581 raw color literals across 61 files. Some are legitimate gradients, native assets, shadows, or fixed artwork; others can drift between themes and platforms.

**Recommendation**

- Continue reducing the baseline rather than allowing it to become permanent.
- Separate artwork constants from semantic UI colors.
- Add semantic tokens for common overlays, pressed states, skeleton fills, and map/chat chrome.

## Additional UX Observations

### Default map location is geographically specific

When there are no notes and location is unavailable, the map defaults to coordinates in Ho Chi Minh City:

- `hooks/map/mapDomain.ts:7-12`
- `hooks/map/mapDomain.ts:113-135`

For users elsewhere, this can look like incorrect location behavior. Prefer a neutral world/region view, last known map viewport, or an explicit location-permission empty state.

### Search can issue overlapping SQLite work

`useDeferredValue` improves perceived input responsiveness, but each deferred query starts a new database search and cancellation only suppresses the result; it does not cancel SQLite work:

- `components/screens/search/SearchScreen.tsx:167-196`

For fast typing and large datasets, add a short debounce or serial latest-query worker.

### Full-screen derivations should be measured, not guessed

The repository already uses FlashList, memoized rows, deferred map warmup, reduced motion, bounded media hydration, FTS search, and staged startup. Those are good choices. The next optimization step should use React Profiler, Android System Trace, iOS Instruments, and representative large datasets rather than adding memoization indiscriminately.

## Confirmed Strengths

- Native Supabase sessions use SecureStore rather than AsyncStorage.
- Active invite tokens use secure storage.
- Remote note/shared media uses short-lived signed URLs.
- Client-side storage uploads reject obviously unsafe paths, while server RLS provides the real boundary.
- Recent migrations constrain media ownership and direct-chat integrity.
- Edge Functions authenticate users before account deletion or social sends.
- Account deletion requires a recent sign-in and validates owned storage paths.
- Production Android builds cannot silently use the debug signing key.
- Background location permission is build-gated.
- Production configuration validates legal links, EAS project ID, Maps, and billing configuration.
- SQL search and CRUD inputs are parameterized.
- The app uses FTS rather than scanning SQLite text for primary search.
- Lists use FlashList in major feeds/grids/chats.
- Heavy map work is deferred on Android and large datasets.
- Dependency overrides address known transitive package issues.
- `.env`, native credentials, signing keys, Firebase files, and generated native folders are ignored.
- No checked-in production secret or private key was found in the current tree or targeted history scan.

## Remediation Priority

### P0: Before a privacy-sensitive or large public launch

1. Design and implement local-data encryption, including database, MMKV secrets, drafts, and private media protection.
2. Change social notification idempotency/throttle failures to fail closed.
3. Check in a reproducible Supabase baseline and run authorization tests from a clean database.

### P1: Before the note library commonly exceeds a few hundred items

1. Replace full note hydration with paginated/normalized state.
2. Query map and recap summaries from SQLite.
3. Split the shared-feed provider into narrow state/action domains.
4. Reduce JS-thread media conversion and cap cross-feature concurrency.
5. Profile Home, Map, Notes, and Chat with production builds and large seeded datasets.

### P2: Ongoing product quality

1. Close accessibility label, localization, and touch-target gaps.
2. Make reduced-motion behavior systematic.
3. Remove Jest lifecycle warning noise.
4. Continue reducing raw theme color debt.
5. Extract high-risk responsibilities from the largest screen modules.

## Suggested Security Regression Matrix

Add automated Supabase integration tests with two unrelated users and two friends:

| Scenario | Expected result |
| --- | --- |
| User B reads User A private note | Denied |
| User B reads unshared User A media | Denied |
| Former friend reads newly generated signed media URL | Denied after URL expiry; cannot create a new URL |
| Audience member mutates another user's response | Denied |
| User creates a direct chat with a non-friend | Denied |
| User uploads to another user's path prefix | Denied |
| User invokes push for another user's post/response | Denied |
| Repeated push invocation for one resource | One throttled/idempotent delivery |
| Idempotency or throttle RPC unavailable | No push sent; retryable server error |
| Account deletion with stale login | Denied |
| Account deletion with recent login | Auth user, rows, tokens, and owned media removed |

## Audit Limitations

- This was a static repository audit plus local automated checks, not a penetration test.
- The deployed Supabase project's actual schema, grants, secrets, storage policies, and dashboard configuration were not inspected.
- Generated `ios/` and `android/` folders are git-ignored, so durable checked-in config/plugins/native sources were reviewed instead.
- No physical-device profiling, network interception, accessibility screen-reader session, or low-memory stress test was performed.
- Existing uncommitted chat-related changes were preserved and included in the test snapshot.
