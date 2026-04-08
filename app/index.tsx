import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  getCachedStartupRoute,
  loadStartupRoute,
  type StartupIndexRoute,
} from '../services/startupRouting';

export default function Index() {
  const [target, setTarget] = useState<StartupIndexRoute | null>(() => getCachedStartupRoute('index'));

  useEffect(() => {
    if (target) {
      return;
    }

    let cancelled = false;

    void loadStartupRoute('index').then((nextTarget) => {
      if (!cancelled) {
        setTarget(nextTarget);
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
