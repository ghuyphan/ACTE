# Android Release Notes

## Billing
- Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` for Android builds.
- Keep `EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID` aligned with the RevenueCat entitlement.
- Verify the default/current offering includes the package you want to sell on Android.

## Signing
- Provide all four Android upload signing values before CI or Play-bound release builds:
  - `ACTE_UPLOAD_STORE_FILE`
  - `ACTE_UPLOAD_STORE_PASSWORD`
  - `ACTE_UPLOAD_KEY_ALIAS`
  - `ACTE_UPLOAD_KEY_PASSWORD`
- Local-only release smoke tests can opt into the debug keystore with `ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true`.

## Play Console Checklist
- App ID: `com.acte.app`
- Upload screenshots for phone form factors in light and dark mode.
- Declare notifications, camera, precise location, background location, and photo-library usage accurately.
- Include background location justification tied to note reminders/geofences.
- Start with Internal testing, then Closed testing, then Production after billing and reminder validation on real devices.

## Device QA Focus
- Fresh install: onboarding, note creation, edit, delete, photo import, share.
- Billing: purchase, cancel, restore, and signed-in/signed-out transitions.
- Reminders: permission escalation, settings recovery, geofence enter notification, and note deep-link open.
- Settings: language change, theme change, empty/loading/error readability in both color schemes.
