import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { getPersistentItem, getPersistentItemSync } from '../utils/appStorage';

const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

function resolveInitialRoute(hasLaunched: string | null) {
  return hasLaunched === 'true' ? '/(tabs)' : '/auth/onboarding';
}

export default function Index() {
  const [target, setTarget] = useState<'/(tabs)' | '/auth/onboarding' | null>(() => {
    const hasLaunched = getPersistentItemSync(HAS_LAUNCHED_KEY);
    if (hasLaunched === undefined) {
      return null;
    }

    return resolveInitialRoute(hasLaunched);
  });

  useEffect(() => {
    if (target) {
      return;
    }

    let cancelled = false;

    void getPersistentItem(HAS_LAUNCHED_KEY)
      .then((hasLaunched) => {
        if (!cancelled) {
          setTarget(resolveInitialRoute(hasLaunched));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTarget('/(tabs)');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) {
    return null;
  }

  return <Redirect href={target} />;
}
