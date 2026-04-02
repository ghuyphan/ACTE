# Noto Release Checklist

## Account And Startup

- [ ] Fresh install opens onboarding on first launch.
- [ ] Returning launch skips onboarding and lands in the main tabs.
- [ ] Auth landing can reach sign-in, register, and password reset states.
- [ ] Google sign-in only appears when the build is configured for it.
- [ ] Profile screen can sign out and delete the account safely.

## Notes And Capture

- [ ] Text note save works with a valid location and place name.
- [ ] Photo note capture works, including retake and permission-denied states.
- [ ] Notes grid opens both local notes and shared posts correctly.
- [ ] Favorite, archive, delete, and edit flows still behave correctly.
- [ ] Text notes preserve note color, doodles, stickers, and mood presentation.
- [ ] Delete-all from settings removes note records and local media.

## Search, Map, Reminders, Widget

- [ ] Search returns expected local note matches and clears correctly.
- [ ] Map first load centers on the user or a note fallback.
- [ ] Map marker interaction opens the correct note detail on iOS and Android.
- [ ] Reminder flow shows the background-location explanation before escalation.
- [ ] Notification deep-link opens the related note detail.
- [ ] Widget updates after create, edit, delete, and app relaunch flows.
- [ ] Widget deep links open the correct local note or shared post.

## Sharing

- [ ] Shared feed degrades gracefully when auth is unavailable.
- [ ] Signed-in users can create an invite, accept an invite, and remove a friend.
- [ ] Shared posts appear in Home and `/shared` with correct author metadata.
- [ ] Sharing a note preserves photo, doodles, stickers, and note color where expected.
- [ ] Offline mode shows cached shared content and blocks write actions with clear messaging.

## Plus / Billing

- [ ] RevenueCat is configured for the target build or purchase UI is intentionally unavailable.
- [ ] Free plan enforces the 10 photo-note limit.
- [ ] Plus unlocks unlimited photo notes and photo-library import.
- [ ] Purchase succeeds on a real native test build.
- [ ] Restore purchases reactivates the expected entitlement.
- [ ] Sign-in and sign-out keep the expected subscription state.

## Store Metadata

- [ ] Privacy policy link is configured and opens.
- [ ] Support URL or support email is configured and opens.
- [ ] Account deletion help link or support email is configured.
- [ ] App Store Connect privacy details are current.
- [ ] Google Play data safety and background-location disclosures are current.

## Platform QA

- [ ] iOS: widget render still matches the latest checked-in Swift implementation.
- [ ] iOS: compact and large devices keep auth, settings, and Plus screens readable.
- [ ] Android: capture, map, shared feed, and settings remain readable in both themes.
- [ ] Android: native alert dialogs open and dismiss cleanly in note delete, clear-all, and permission/error flows.
- [ ] Android: background location and notification permission recovery flows still work.

## OTA / EAS Update

- [ ] Publish app-store builds from the intended EAS channel (`preview` or `production`).
- [ ] For native changes, bump the Expo `version` in `app.config.ts` before shipping a new build.
- [ ] For JavaScript-only changes, publish an OTA update to the matching channel.

## Quality Gates

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test -- --runInBand`
