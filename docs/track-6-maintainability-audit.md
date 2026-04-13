# Track 6 Maintainability Audit

Scope: repo-wide maintainability, DRY, folder complexity, public API sprawl, and missing tests around risky logic.

## Priority Findings

### P1 - Core services and screens are too monolithic
The biggest maintenance risk in this repo is that several central modules have become catch-all implementations instead of bounded units. `services/database.ts:1` is a 2,031-line blend of schema, migrations, scope handling, CRUD, recap cache, and search. `services/syncService.ts:1` is even larger at 2,239 lines and mixes repository logic, remote sync, queue state, and deletion policy. `services/sharedFeedService.ts:1` and `services/noteStickers.ts:1` show the same pattern. On the UI side, `components/home/CaptureCard.tsx:1` is 1,401 lines and `components/screens/MapScreen.ios.tsx:1` is 1,060 lines.

This structure makes changes harder to reason about because unrelated behaviors live in the same file and share the same state. It also raises merge risk: small behavior changes often require touching large, highly coupled modules.

Suggested fix: split these into narrower submodules with a thin façade. Keep the public API stable, but move pure helpers, persistence, queue policy, and remote I/O into separate files.

### P1 - String normalization logic is duplicated and drifting
There are multiple normalization layers with overlapping but not identical behavior: `services/textNormalization.ts:1`, `services/normalizedStrings.ts:1`, and local helpers inside `services/noteAppearance.ts:1`. Those helpers feed search, place ranking, remote artifact path handling, and sticker/temp-file cleanup via `services/noteSearch.ts`, `services/placeRanking.ts`, `services/remoteArtifactUtils.ts`, and `services/stickerTempFiles.ts`.

That is a classic DRY and consistency risk. If one normalizer changes handling for accents, apostrophes, whitespace, or empty values, the rest of the system can silently diverge.

Suggested fix: collapse to one canonical normalization module with named helpers for each semantic use case, then add unit tests for the exact input/output contract.

### P2 - Hook/public API boundaries are noisy and inconsistent
The hook layer is split across `hooks/app`, `hooks/map`, `hooks/state`, `hooks/ui`, and top-level compatibility wrappers like `hooks/useNotes.ts:1`, `hooks/useSharedFeed.ts:1`, `hooks/useFeedFocus.ts:1`, `hooks/useActiveNote.tsx:1`, and `hooks/useActiveFeedTarget.ts:1`. Those wrappers are only re-exports, while the actual implementations live elsewhere.

This is not broken, but it makes ownership hard to understand. New code has to guess whether to import from the wrapper or the implementation file, and the repo currently uses both public names and implementation-path names in a few places. That increases cognitive load and makes future folder moves riskier.

Suggested fix: pick one public surface for hooks and keep implementation files internal. If the wrapper is only for compatibility, document it or remove it once call sites are migrated.

### P2 - Platform screen variants are multiplying folder complexity
The settings, profile, and map screens are each split into platform-specific shells with nearly identical responsibilities: `components/screens/settings/SettingsScreen.tsx:1`, `components/screens/settings/SettingsScreen.ios.tsx:1`, `components/screens/settings/SettingsScreen.android.tsx:1`; `components/screens/profile/ProfileScreen.tsx:1`, `components/screens/profile/ProfileScreen.ios.tsx:1`, `components/screens/profile/ProfileScreen.android.tsx:1`; and `components/screens/MapScreen.tsx:1`, `components/screens/MapScreen.ios.tsx:1`.

This is understandable for platform-specific UI, but the current shape creates a lot of file hopping for small changes and encourages copy-paste variants. The Android and iOS versions of settings/profile both reimplement the same screen-level structure with different components.

Suggested fix: keep the platform files thin and push shared screen layout into a single base component per feature, with platform adapters only where native UI truly differs.

### P2 - App startup and provider wiring are too concentrated
`app/_layout.tsx:29-257` combines startup routing, splash gating, system UI setup, notification routing, widget refresh, social push registration, and the entire route stack. `components/app/AppProviders.tsx:25-80` then layers a long provider chain on top. Together, they define a lot of behavior in a small number of places.

This makes the boot path powerful, but also fragile. Small changes to auth, startup, or provider order can have app-wide effects, and the file boundaries do not help isolate those risks.

Suggested fix: separate bootstrapping concerns from route declaration, and group providers by lifecycle or feature domain so the composition is easier to scan.

### P2 - Risky mutation and cleanup helpers are under-tested
I did not find direct unit tests for several helpers that sit on destructive or brittle paths: `services/accountCleanup.ts:42-118`, `services/noteMutationHelpers.ts:13-96`, `services/feedTargetLookup.ts:9-29`, `services/noteDoodles.ts:14-80`, and `services/mediaTypeUtils.ts:3-49`. Some of these are exercised indirectly through broader tests, but the exact edge cases are not covered at the module level.

That leaves gaps around note-patch merge invariants, account purge ordering, deep-link target resolution, JSON parse failure handling, and MIME inference. Those are precisely the places where subtle regressions become user-visible or destructive.

Suggested fix: add focused unit tests for each helper module, especially around fallback behavior and failure modes.

## Notes

I did not find a high-confidence new security flaw in the sampled code beyond the existing need to keep auth, sync, and cleanup paths tightly tested. The main risk in this pass is maintainability debt turning into future bugs rather than an immediate exploit.
