# Charmly Release Checklist

## Core Flows
- [ ] Onboarding appears on first launch and routes to app after completion.
- [ ] Auth screen supports local mode and configured Google sign-in path.
- [ ] Home capture: text note save with valid location.
- [ ] Home capture: photo note save, retake flow, and camera permission denied handling.
- [ ] Home search returns expected matches and clears correctly.
- [ ] Note detail: favorite, edit, share, and delete behavior.
- [ ] Delete all notes from settings removes data and media.

## Map / Reminder / Widget
- [ ] Map first load centers on user or notes fallback.
- [ ] Map marker callout opens note detail on iOS and Android.
- [ ] Reminder permission flow is action-triggered and supports Open Settings escalation.
- [ ] Notification deep-link opens the related note.
- [ ] Widget updates deterministically from latest/nearby note.

## Cross Platform
- [ ] iOS: theme + language changes apply immediately.
- [ ] Android: theme + language changes apply immediately.
- [ ] iOS and Android: empty/loading/error states remain readable in light and dark mode.

## Quality Gates
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm test -- --runInBand` passes.
