# Android Release Guide

## Build Inputs

- Set `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` for map-enabled Android builds.
- Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` for Android billing.
- Keep `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` and `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` aligned with RevenueCat.

## Signing

Provide the Android upload signing values before Play-bound release builds:

- `ACTE_UPLOAD_STORE_FILE`
- `ACTE_UPLOAD_STORE_PASSWORD`
- `ACTE_UPLOAD_KEY_ALIAS`
- `ACTE_UPLOAD_KEY_PASSWORD`

Local smoke tests can optionally use the debug keystore with `ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true`.

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

## Recommended Checks

```bash
npm run android
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```
