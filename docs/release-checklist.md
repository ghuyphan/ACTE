# Noto Release Checklist

## Core Flows
- [ ] Onboarding appears on first launch and routes to app after completion.
- [ ] Auth screen supports local mode and configured Google sign-in path.
- [ ] Account screen includes the expected production-safe actions and copy.
- [ ] Home capture: text note save with valid location.
- [ ] Home capture: photo note save, retake flow, and camera permission denied handling.
- [ ] Home capture: Photos library import works for Plus users.
- [ ] Home capture: free plan blocks photo notes after the quota and shows the upgrade flow.
- [ ] Home search returns expected matches and clears correctly.
- [ ] Note detail: favorite, edit, share, and delete behavior.
- [ ] Delete all notes from settings removes data and media.
- [ ] Friends: create invite, accept invite, and remove friend flows work end to end.
- [ ] Shared feed: sign-in state, empty state, post rendering, and share-from-note flow behave correctly.
- [ ] Rooms: create room, join by invite, post to room, and open room flows behave correctly.

## Plus / Billing
- [ ] RevenueCat is configured for the target build or Plus is intentionally hidden/unavailable.
- [ ] Free tier shows the correct photo-note limit.
- [ ] Plus purchase succeeds on the target native test environment.
- [ ] Restore purchases reactivates Plus on a fresh install or signed-in device.
- [ ] Plus unlocks Photos import and expanded photo-note capacity.
- [ ] Plus copy in Settings and upgrade surfaces is short, localized, and production-ready.

## Map / Reminder / Widget / Sharing
- [ ] Map first load centers on user or notes fallback.
- [ ] Map marker callout opens note detail on iOS and Android.
- [ ] Reminder permission flow is action-triggered and supports Open Settings escalation.
- [ ] Notification deep-link opens the related note.
- [ ] Widget updates deterministically from latest/nearby note.
- [ ] Friend invites and room invites deep-link into the expected join surfaces.

## iOS Release Focus
- [ ] iOS: theme + language changes apply immediately.
- [ ] iOS: Plus state, Settings copy, and purchase UI fit in compact and large devices.
- [ ] iOS: empty/loading/error states remain readable in light and dark mode.
- [ ] iOS widget still renders correctly after photo-note, text-note, and delete flows.

## Android Follow-Up
- [ ] Android: theme + language changes apply immediately.
- [ ] Android: room, friend, and shared feed surfaces remain readable and tappable.
- [ ] Android: empty/loading/error states remain readable in light and dark mode.

## Quality Gates
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm test -- --runInBand` passes.
