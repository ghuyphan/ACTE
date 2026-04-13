import { getPersistentItem, getPersistentItemSync, setPersistentItem } from '../utils/appStorage';

export const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

export type StartupRouteVariant = 'entry' | 'index';
export type StartupEntryRoute = '/' | '/auth/onboarding';
export type StartupIndexRoute = '/(tabs)' | '/auth/onboarding';
export type StartupRoute = StartupEntryRoute | StartupIndexRoute;
export const POST_ONBOARDING_ROUTE: StartupIndexRoute = '/(tabs)';

let cachedHasLaunchedValue: string | null | undefined;
let hasLaunchedLoadPromise: Promise<string | null> | null = null;

function hasCompletedOnboarding(hasLaunched: string | null) {
  return hasLaunched === 'true';
}

export function getDefaultStartupRoute(variant: 'entry'): StartupEntryRoute;
export function getDefaultStartupRoute(variant: 'index'): StartupIndexRoute;
export function getDefaultStartupRoute(variant: StartupRouteVariant): StartupRoute {
  return variant === 'entry' ? '/' : '/(tabs)';
}

export function resolveStartupRoute(
  hasLaunched: string | null,
  variant: 'entry'
): StartupEntryRoute;
export function resolveStartupRoute(
  hasLaunched: string | null,
  variant: 'index'
): StartupIndexRoute;
export function resolveStartupRoute(
  hasLaunched: string | null,
  variant: StartupRouteVariant
): StartupRoute {
  if (!hasCompletedOnboarding(hasLaunched)) {
    return '/auth/onboarding';
  }

  return variant === 'entry' ? '/' : '/(tabs)';
}

export function getCachedStartupRoute(variant: 'entry'): StartupEntryRoute | null;
export function getCachedStartupRoute(variant: 'index'): StartupIndexRoute | null;
export function getCachedStartupRoute(variant: StartupRouteVariant): StartupRoute | null {
  if (cachedHasLaunchedValue !== undefined) {
    return variant === 'entry'
      ? resolveStartupRoute(cachedHasLaunchedValue, 'entry')
      : resolveStartupRoute(cachedHasLaunchedValue, 'index');
  }

  const hasLaunched = getPersistentItemSync(HAS_LAUNCHED_KEY);
  if (hasLaunched === undefined) {
    return null;
  }

  cachedHasLaunchedValue = hasLaunched;

  return variant === 'entry'
    ? resolveStartupRoute(hasLaunched, 'entry')
    : resolveStartupRoute(hasLaunched, 'index');
}

async function loadHasLaunchedFlag() {
  if (cachedHasLaunchedValue !== undefined) {
    return cachedHasLaunchedValue;
  }

  if (!hasLaunchedLoadPromise) {
    hasLaunchedLoadPromise = getPersistentItem(HAS_LAUNCHED_KEY)
      .then((hasLaunched) => {
        cachedHasLaunchedValue = hasLaunched;
        return hasLaunched;
      })
      .catch(() => {
        cachedHasLaunchedValue = null;
        return null;
      })
      .finally(() => {
        hasLaunchedLoadPromise = null;
      });
  }

  return hasLaunchedLoadPromise;
}

export async function loadStartupRoute(variant: 'entry'): Promise<StartupEntryRoute>;
export async function loadStartupRoute(variant: 'index'): Promise<StartupIndexRoute>;
export async function loadStartupRoute(variant: StartupRouteVariant): Promise<StartupRoute> {
  try {
    const hasLaunched = await loadHasLaunchedFlag();
    return variant === 'entry'
      ? resolveStartupRoute(hasLaunched, 'entry')
      : resolveStartupRoute(hasLaunched, 'index');
  } catch {
    return variant === 'entry' ? '/auth/onboarding' : '/auth/onboarding';
  }
}

export async function markOnboardingComplete(): Promise<void> {
  cachedHasLaunchedValue = 'true';
  await setPersistentItem(HAS_LAUNCHED_KEY, 'true');
}

export async function completeOnboardingAndEnterApp(
  navigate: (route: StartupIndexRoute) => void
): Promise<void> {
  await markOnboardingComplete();
  navigate(POST_ONBOARDING_ROUTE);
}

export function __resetStartupRouteCacheForTests() {
  cachedHasLaunchedValue = undefined;
  hasLaunchedLoadPromise = null;
}
