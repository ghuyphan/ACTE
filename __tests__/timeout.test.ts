import { withTimeout, withTimeoutResult } from '../utils/timeout';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('timeout utilities', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns resolved values before the timeout window closes', async () => {
    jest.useFakeTimers();
    const deferred = createDeferred<string>();
    const resultPromise = withTimeoutResult(deferred.promise, 1000);

    await Promise.resolve();

    deferred.resolve('ready');

    await expect(resultPromise).resolves.toEqual({
      status: 'resolved',
      value: 'ready',
    });
  });

  it('returns a timed-out result without waiting for the original promise', async () => {
    jest.useFakeTimers();
    const deferred = createDeferred<string>();
    const resultPromise = withTimeoutResult(deferred.promise, 1000);

    jest.advanceTimersByTime(1000);

    await expect(resultPromise).resolves.toEqual({ status: 'timed-out' });
  });

  it('rejects with the provided error when using the throwing wrapper', async () => {
    jest.useFakeTimers();
    const timeoutError = new Error('too slow');
    const deferred = createDeferred<string>();
    const resultPromise = withTimeout(deferred.promise, 1000, timeoutError);

    jest.advanceTimersByTime(1000);

    await expect(resultPromise).rejects.toBe(timeoutError);
  });
});
