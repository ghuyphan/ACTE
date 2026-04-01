import { getPersistentItem, getPersistentItemSync } from '../utils/appStorage';

export const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

export type StartupRouteVariant = 'entry' | 'index';
export type StartupEntryRoute = '/' | '/auth/onboarding';
export type StartupIndexRoute = '/(tabs)' | '/auth/onboarding';
export type StartupRoute = StartupEntryRoute | StartupIndexRoute;

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
