type IdleCallbackDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallbackOptions = {
  timeout?: number;
};

type IdleCallbackHandle = {
  cancel: () => void;
};

type IdleGlobal = typeof globalThis & {
  requestIdleCallback?: (
    callback: (deadline: IdleCallbackDeadline) => void,
    options?: IdleCallbackOptions
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

const globalIdleApi = globalThis as IdleGlobal;

export function scheduleOnIdle(
  callback: (deadline: IdleCallbackDeadline) => void,
  options?: IdleCallbackOptions
): IdleCallbackHandle {
  if (typeof globalIdleApi.requestIdleCallback === 'function') {
    const idleId = globalIdleApi.requestIdleCallback(callback, options);

    return {
      cancel: () => {
        globalIdleApi.cancelIdleCallback?.(idleId);
      },
    };
  }

  const fallbackDelayMs =
    typeof options?.timeout === 'number' && Number.isFinite(options.timeout)
      ? Math.max(0, options.timeout)
      : 0;
  const timeoutId = setTimeout(() => {
    callback({
      didTimeout: fallbackDelayMs > 0,
      timeRemaining: () => 0,
    });
  }, fallbackDelayMs);

  return {
    cancel: () => {
      clearTimeout(timeoutId);
    },
  };
}
