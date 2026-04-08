import { scheduleOnIdle } from '../utils/scheduleOnIdle';

type IdleGlobal = {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const idleGlobal = globalThis as unknown as IdleGlobal;
const originalRequestIdleCallback = idleGlobal.requestIdleCallback;
const originalCancelIdleCallback = idleGlobal.cancelIdleCallback;

describe('scheduleOnIdle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    if (originalRequestIdleCallback) {
      idleGlobal.requestIdleCallback = originalRequestIdleCallback;
    } else {
      Reflect.deleteProperty(globalThis, 'requestIdleCallback');
    }

    if (originalCancelIdleCallback) {
      idleGlobal.cancelIdleCallback = originalCancelIdleCallback;
    } else {
      Reflect.deleteProperty(globalThis, 'cancelIdleCallback');
    }
  });

  it('uses requestIdleCallback when available and forwards cancelation', () => {
    const callback = jest.fn();
    const requestIdleCallback = jest.fn(() => 42);
    const cancelIdleCallback = jest.fn();

    idleGlobal.requestIdleCallback = requestIdleCallback;
    idleGlobal.cancelIdleCallback = cancelIdleCallback;

    const handle = scheduleOnIdle(callback, { timeout: 2000 });
    handle.cancel();

    expect(requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 2000 });
    expect(cancelIdleCallback).toHaveBeenCalledWith(42);
    expect(callback).not.toHaveBeenCalled();
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    const callback = jest.fn();
    Reflect.deleteProperty(globalThis, 'requestIdleCallback');
    Reflect.deleteProperty(globalThis, 'cancelIdleCallback');

    scheduleOnIdle(callback);

    expect(callback).not.toHaveBeenCalled();

    jest.runAllTimers();

    expect(callback).toHaveBeenCalledWith({
      didTimeout: false,
      timeRemaining: expect.any(Function),
    });
    expect(callback.mock.calls[0]?.[0].timeRemaining()).toBe(0);
  });
});
