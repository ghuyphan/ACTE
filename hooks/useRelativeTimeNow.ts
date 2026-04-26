import { ReactNode, createContext, createElement, useContext, useEffect, useState } from 'react';

const MINUTE_MS = 60 * 1000;

const RelativeTimeNowContext = createContext<Date | null>(null);

export function RelativeTimeNowProvider({
  children,
  now,
}: {
  children: ReactNode;
  now: Date;
}) {
  return createElement(RelativeTimeNowContext.Provider, { value: now }, children);
}

export function useRelativeTimeNow() {
  const sharedNow = useContext(RelativeTimeNowContext);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (sharedNow) {
      return undefined;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      setNow(new Date());
      intervalId = setInterval(() => {
        setNow(new Date());
      }, MINUTE_MS);
    }, MINUTE_MS - (Date.now() % MINUTE_MS));

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sharedNow]);

  return sharedNow ?? now;
}
