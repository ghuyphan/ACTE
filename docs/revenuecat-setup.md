# RevenueCat Setup

The client-side subscription flow is already wired. Most remaining work is RevenueCat dashboard setup, store product wiring, and environment configuration.

## Current App Behavior

- `hooks/useSubscription.tsx` configures RevenueCat and exposes purchase, restore, paywall, and customer-center actions.
- `constants/subscription.ts` reads the env vars and applies the free-vs-plus limits.
- If RevenueCat is not configured, the app stays in free mode and purchase actions resolve as unavailable.
- Free users are limited to `10` photo notes.
- Plus users get unlimited photo notes and photo-library import.

## Default Values In Code

Unless overridden by env vars, the app expects:

- Entitlement ID: `noto_pro`
- Offering ID: `default`

Backward-compatible `PLUS` env aliases still work, but the primary names are the non-`PLUS` variants.

## Environment Variables

```env
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxx
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=noto_pro
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

`EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` is for development-only simulated purchases. Do not ship production builds with the test-store key.

Also supported for backward compatibility:

```env
EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID=noto_pro
EXPO_PUBLIC_REVENUECAT_PLUS_OFFERING_ID=default
```

## RevenueCat Dashboard Checklist

1. Create the RevenueCat project for this app.
2. Connect the iOS and Android apps.
3. Import the store products you plan to sell.
4. Create an entitlement named `noto_pro`, unless you override it with env vars.
5. Create an offering named `default`, unless you override it with env vars.
6. Attach the packages you want surfaced in the paywall.

## Store-Side Checklist

1. Create the matching products in App Store Connect and Google Play Console.
2. Keep the store product IDs aligned with the RevenueCat products.
3. Make products available in the sandbox or test track you use.
4. Test on a real native build; Expo Go is not enough for billing flows.

## Purchase Behavior

- The app prefers packages in this order: annual, monthly, three month, six month, two month, weekly, lifetime.
- Signed-in users are linked to RevenueCat with `Purchases.logIn(...)`.
- Signed-out users fall back to an anonymous RevenueCat customer.
- The active entitlement decides whether the current tier is `free` or `plus`.

## Suggested Validation

1. Launch the app with keys present and confirm RevenueCat initializes cleanly.
2. Confirm the offering loads on both iOS and Android.
3. Complete at least one purchase.
4. Restore purchases on a fresh install or second device.
5. Sign in and out and verify the entitlement state remains correct.
6. Remove keys and verify the app falls back to free mode without crashing.

## Relevant Files

- `constants/subscription.ts`
- `hooks/useSubscription.tsx`
- `app/plus.tsx`
- `docs/android-release.md`
- `docs/release-checklist.md`
