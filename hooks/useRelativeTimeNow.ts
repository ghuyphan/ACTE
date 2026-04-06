import { useEffect, useState } from 'react';

const MINUTE_MS = 60 * 1000;

export function useRelativeTimeNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
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
  }, []);

  return now;
}
