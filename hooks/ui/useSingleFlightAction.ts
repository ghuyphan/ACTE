import { useCallback, useRef } from 'react';

type MaybePromise<T> = T | Promise<T>;

export function useSingleFlightAction<Args extends unknown[], Result>(
  action: (...args: Args) => MaybePromise<Result>
) {
  const actionRef = useRef(action);
  const inFlightRef = useRef<Promise<Result> | null>(null);
  actionRef.current = action;

  return useCallback((...args: Args): Promise<Result> => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const promise = Promise.resolve(actionRef.current(...args)).finally(() => {
      if (inFlightRef.current === promise) {
        inFlightRef.current = null;
      }
    });
    inFlightRef.current = promise;
    return promise;
  }, []);
}
