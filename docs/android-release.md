# Android Release Guide

## Build Inputs

- Set `EXPO_PUBLIC_EAS_PROJECT_ID` for OTA updates and Expo push token registration.
- Set `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` for map-enabled Android builds.
- Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` for Android billing.
- Keep `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` and `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` aligned with RevenueCat.
- Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` and either `EXPO_PUBLIC_SUPPORT_URL` or `EXPO_PUBLIC_SUPPORT_EMAIL`.
- Set either `EXPO_PUBLIC_ACCOUNT_DELETION_URL` or `EXPO_PUBLIC_SUPPORT_EMAIL`.
- Set `EXPO_PUBLIC_ENABLE_PLACE_REMINDERS=false` if you want a Play-bound build without background geofence reminders.
- Provide Firebase config through a repo-root `google-services.json` or the `GOOGLE_SERVICES_JSON` file-path env used by [`app.config.js`](../app.config.js).

## Signing

Provide the Android upload signing values before Play-bound release builds:

- `ACTE_UPLOAD_STORE_FILE`
- `ACTE_UPLOAD_STORE_PASSWORD`
- `ACTE_UPLOAD_KEY_ALIAS`
- `ACTE_UPLOAD_KEY_PASSWORD`

Release builds fail fast when signing values are missing because [`plugins/withAndroidReleaseHardening.js`](../plugins/withAndroidReleaseHardening.js) patches the generated Gradle project during prebuild.

Local smoke tests can still opt into the debug keystore with `ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true`.

## Play Console Prep

- Package ID: `com.acte.app`
- Confirm camera, photo-library, notifications, foreground location, and background location disclosures.
- If place reminders stay enabled for Android production, complete Play Console `Sensitive app permissions > Location permissions`.
- Record a short Android demo video that shows:
  - the saved-note reminder disclosure
  - the runtime location permission prompt
  - the reminder feature being enabled and used as a core flow
- Make the store listing clearly describe the background reminder value as a core feature, not a secondary extra.
- Keep the privacy policy, support, and account-deletion metadata aligned with the app settings surfaces.
- Make sure the privacy policy explicitly covers background location usage for nearby note reminders.
- Provide reusable reviewer login instructions if auth is needed to reach reminder or sharing flows.
- Prepare screenshots for light and dark mode on phone form factors.
- Roll out through Internal testing before Closed or Production.

## QA Focus

- Fresh install: onboarding, auth, and first note creation.
- Capture: text note, photo note, retake, live photo handling, and photo-library import for Plus.
- Billing: paywall, purchase, restore, and sign-in/sign-out transitions.
- Sharing: invite acceptance, shared feed rendering, shared post detail, and social push delivery.
- Reminders: permission escalation, geofence notification, and deep-link open.
- Settings: theme, language, account links, and delete-all flow.
- Widget: Android widget snapshot still matches the checked-in source in [`widgets/android/NotoWidgetProvider.kt`](../widgets/android/NotoWidgetProvider.kt).
- Android native alerts: delete note, clear-all, and permission/error dialogs render without bridge crashes.

## Recommended Checks

```bash
npm run android
npm run lint
npm run typecheck
npm test -- --runInBand
```

## JS-Only Follow-Up

If the release is JavaScript-only and does not require a new native binary, publish the matching OTA update channel after validation:

```bash
npm run update:preview
npm run update:production
```
