export type TimeoutResult<T> =
  | { status: 'resolved'; value: T }
  | { status: 'timed-out' };

export function withTimeoutResult<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<TimeoutResult<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return Promise.race<TimeoutResult<T>>([
    promise.then((value) => ({ status: 'resolved' as const, value })),
    new Promise<TimeoutResult<T>>((resolve) => {
      timeout = setTimeout(() => {
        resolve({ status: 'timed-out' as const });
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error
): Promise<T> {
  const result = await withTimeoutResult(promise, timeoutMs);
  if (result.status === 'timed-out') {
    throw timeoutError;
  }

  return result.value;
}
