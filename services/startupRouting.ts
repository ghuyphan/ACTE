import { getPersistentItem, getPersistentItemSync, setPersistentItem } from '../utils/appStorage';

export const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

export type StartupRouteVariant = 'entry' | 'index';
export type StartupEntryRoute = '/' | '/auth/onboarding';
export type StartupIndexRoute = '/(tabs)' | '/auth/onboarding';
export type StartupRoute = StartupEntryRoute | StartupIndexRoute;
export const POST_ONBOARDING_ROUTE: StartupIndexRoute = '/(tabs)';

function hasCompletedOnboarding(hasLaunched: string | null) {
  return hasLaunched === 'true';
}

export function getDefaultStartupRoute(variant: StartupRouteVariant): StartupRoute {
  return variant === 'entry' ? '/' : '/(tabs)';
}

export function resolveStartupRoute(
  hasLaunched: string | null,
  variant: StartupRouteVariant
): StartupRoute {
  if (!hasCompletedOnboarding(hasLaunched)) {
    return '/auth/onboarding';
  }

  return getDefaultStartupRoute(variant);
}

export function getCachedStartupRoute(variant: StartupRouteVariant): StartupRoute | null {
  const hasLaunched = getPersistentItemSync(HAS_LAUNCHED_KEY);
  if (hasLaunched === undefined) {
    return null;
  }

  return resolveStartupRoute(hasLaunched, variant);
}

export async function loadStartupRoute(variant: StartupRouteVariant): Promise<StartupRoute> {
  try {
    const hasLaunched = await getPersistentItem(HAS_LAUNCHED_KEY);
    return resolveStartupRoute(hasLaunched, variant);
  } catch {
    return getDefaultStartupRoute(variant);
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await setPersistentItem(HAS_LAUNCHED_KEY, 'true');
}

export async function completeOnboardingAndEnterApp(
  navigate: (route: StartupIndexRoute) => void
): Promise<void> {
  await markOnboardingComplete();
  navigate(POST_ONBOARDING_ROUTE);
}
