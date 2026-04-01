import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { getCachedStartupRoute, loadStartupRoute } from '../services/startupRouting';

export default function Index() {
  const [target, setTarget] = useState<'/(tabs)' | '/auth/onboarding' | null>(() =>
    getCachedStartupRoute('index') as '/(tabs)' | '/auth/onboarding' | null
  );

  useEffect(() => {
    if (target) {
      return;
    }

    let cancelled = false;

    void loadStartupRoute('index').then((nextTarget) => {
      if (!cancelled) {
        setTarget(nextTarget as '/(tabs)' | '/auth/onboarding');
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
