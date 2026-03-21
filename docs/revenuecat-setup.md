# RevenueCat Setup

This project already includes RevenueCat client code. The remaining work later is mainly dashboard setup, store-product wiring, and adding the correct environment variables for the target build.

## Current App Behavior

- RevenueCat SDKs are already installed:
  - `react-native-purchases`
  - `react-native-purchases-ui`
- Subscription state is handled in `hooks/useSubscription.tsx`.
- RevenueCat env parsing lives in `constants/subscription.ts`.
- If RevenueCat is not configured, the app stays in free mode and purchase actions return `unavailable`.

## Default Values In Code

Unless overridden by env vars, the app currently expects:

- Entitlement ID: `noto_pro`
- Offering ID: `default`

Older `plus` env names are still supported for backward compatibility.

## Environment Variables

Add these later in your local env, EAS secrets, or CI environment:

```env
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxx
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=noto_pro
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

Backward-compatible aliases also work:

```env
EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID=noto_pro
EXPO_PUBLIC_REVENUECAT_PLUS_OFFERING_ID=default
```

Notes:

- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` is only used in `__DEV__` when present.
- iOS and Android keys are platform-specific public SDK keys from RevenueCat, not App Store Connect or Play Console secrets.

## RevenueCat Dashboard Checklist

Create these in RevenueCat later:

1. Create the project for this app.
2. Connect the iOS app and Android app.
3. Add the store products you want to sell.
4. Create an entitlement named `noto_pro` unless you plan to override it with env vars.
5. Create or keep an offering named `default` unless you plan to override it with env vars.
6. Attach the package(s) for monthly, annual, and/or lifetime products to that offering.

## Store-Side Checklist

Before purchases can work end to end:

1. Create matching in-app products in App Store Connect and Google Play Console.
2. Ensure the product identifiers in the stores match the identifiers imported into RevenueCat.
3. Make sure the products are available to the test track / sandbox environment you use.
4. Use a real native build for testing. Expo Go is not enough for RevenueCat purchase flows.

## How The App Uses RevenueCat

- `Purchases.configure()` runs in `hooks/useSubscription.tsx`.
- Signed-in users are linked with `Purchases.logIn(user.uid)`.
- Signed-out users fall back to an anonymous RevenueCat customer via `Purchases.logOut()`.
- The active entitlement decides whether the user is on `free` or `plus`.
- The app prefers packages in this order:
  - annual
  - monthly
  - three month
  - six month
  - two month
  - weekly
  - lifetime

## Feature Gates Tied To Plus

Right now the subscription gate affects:

- Expanded photo-note capacity
- Importing from the photo library
- Purchase / restore / customer center flows in the Plus UI

## Suggested Launch Validation

When setup is ready, verify:

1. App starts with RevenueCat keys present and no initialization warnings.
2. Current offering loads on iOS and Android.
3. Purchase succeeds for at least one package.
4. Restore purchases reactivates `noto_pro`.
5. Signing in and out keeps the expected entitlement state.
6. With keys removed, the app falls back to free mode without crashing.

## Relevant Files

- `constants/subscription.ts`
- `hooks/useSubscription.tsx`
- `app/plus.tsx`
- `app/(tabs)/index.tsx`
- `docs/android-release.md`
- `docs/release-checklist.md`
