# Android Release Guide

## Build Inputs

- Set `EXPO_PUBLIC_EAS_PROJECT_ID` for OTA updates and Expo push token registration.
- Set `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` for map-enabled Android builds.
- Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` for Android billing.
- Keep `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` and `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` aligned with RevenueCat.
- Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` and either `EXPO_PUBLIC_SUPPORT_URL` or `EXPO_PUBLIC_SUPPORT_EMAIL`.
- Set either `EXPO_PUBLIC_ACCOUNT_DELETION_URL` or `EXPO_PUBLIC_SUPPORT_EMAIL`.
- Set `EXPO_PUBLIC_ENABLE_PLACE_REMINDERS=false` if you want a Play-bound build without background geofence reminders.

## Signing

Provide the Android upload signing values before Play-bound release builds:

- `ACTE_UPLOAD_STORE_FILE`
- `ACTE_UPLOAD_STORE_PASSWORD`
- `ACTE_UPLOAD_KEY_ALIAS`
- `ACTE_UPLOAD_KEY_PASSWORD`

Release builds now fail fast when signing values are missing.
Local smoke tests can still opt into the debug keystore with `ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true`.

## Play Console Prep

- Package ID: `com.acte.app`
- Confirm camera, photo-library, notifications, foreground location, and background location disclosures.
- Keep the privacy policy, support, and account-deletion metadata aligned with the app settings surfaces.
- Prepare screenshots for light and dark mode on phone form factors.
- Roll out through Internal testing before Closed or Production.

## QA Focus

- Fresh install: onboarding, auth, and first note creation.
- Capture: text note, photo note, retake, and photo-library import for Plus.
- Billing: paywall, purchase, restore, and sign-in/sign-out transitions.
- Sharing: invite acceptance, shared feed rendering, and shared post detail.
- Reminders: permission escalation, geofence notification, and deep-link open.
- Settings: theme, language, account links, and delete-all flow.
- Android native alerts: delete note, clear-all, and permission/error dialogs render without Compose bridge crashes.

## Recommended Checks

```bash
npm run android
npm run lint
npm run typecheck
npm test -- --runInBand
```
