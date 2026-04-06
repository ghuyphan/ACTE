import { useCallback, useEffect, useRef } from 'react';

type DeferredCleanupIdleKind = 'idle' | 'timeout' | null;

interface UseDeferredUriCleanupOptions {
  cleanup: (uri: string) => Promise<void>;
  delayMs: number;
  idleDelayMs?: number;
}

export function useDeferredUriCleanup({
  cleanup,
  delayMs,
  idleDelayMs = 600,
}: UseDeferredUriCleanupOptions) {
  const pendingUrisRef = useRef<Set<string>>(new Set());
  const idleKindRef = useRef<DeferredCleanupIdleKind>(null);
  const idleHandleRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (
      idleKindRef.current === 'idle' &&
      idleHandleRef.current !== null &&
      typeof globalThis.cancelIdleCallback === 'function'
    ) {
      globalThis.cancelIdleCallback(idleHandleRef.current as number);
    } else if (
      idleKindRef.current === 'timeout' &&
      idleHandleRef.current !== null
    ) {
      clearTimeout(idleHandleRef.current as ReturnType<typeof setTimeout>);
    }

    idleKindRef.current = null;
    idleHandleRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    const pendingUris = Array.from(pendingUrisRef.current);
    pendingUrisRef.current.clear();
    await Promise.all(pendingUris.map((uri) => cleanup(uri)));
  }, [cleanup]);

  const schedule = useCallback(
    (uri: string | null | undefined) => {
      const normalizedUri = typeof uri === 'string' ? uri.trim() : '';
      if (!normalizedUri) {
        return;
      }

      pendingUrisRef.current.add(normalizedUri);
      clear();

      const startDelay = () => {
        idleKindRef.current = null;
        idleHandleRef.current = null;
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          void flush();
        }, delayMs);
      };

      if (typeof globalThis.requestIdleCallback === 'function') {
        idleKindRef.current = 'idle';
        idleHandleRef.current = globalThis.requestIdleCallback(() => {
          startDelay();
        });
        return;
      }

      idleKindRef.current = 'timeout';
      idleHandleRef.current = setTimeout(startDelay, idleDelayMs);
    },
    [clear, delayMs, flush, idleDelayMs]
  );

  useEffect(
    () => () => {
      clear();
      void flush();
    },
    [clear, flush]
  );

  return {
    clear,
    flush,
    schedule,
  };
}

export default useDeferredUriCleanup;
