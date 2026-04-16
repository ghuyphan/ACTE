type StartupTraceMetadata = Record<string, unknown>;

function isStartupTracingEnabled() {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }

  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function normalizeMetadataValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'undefined') {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (value instanceof Error) {
    return value.message || value.name;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatMetadata(metadata?: StartupTraceMetadata) {
  if (!metadata) {
    return '';
  }

  const entries = Object.entries(metadata).filter(([, value]) => typeof value !== 'undefined');
  if (entries.length === 0) {
    return '';
  }

  return ` ${entries
    .map(([key, value]) => `${key}=${normalizeMetadataValue(value)}`)
    .join(' ')}`;
}

export function logStartupEvent(label: string, metadata?: StartupTraceMetadata) {
  if (!isStartupTracingEnabled()) {
    return;
  }

  console.info(`[startup] ${label}${formatMetadata(metadata)}`);
}

export async function traceStartupAsync<T>(
  label: string,
  task: () => Promise<T>,
  metadata?: StartupTraceMetadata
): Promise<T> {
  if (!isStartupTracingEnabled()) {
    return task();
  }

  const startedAtMs = getNowMs();
  logStartupEvent(`${label}:start`, metadata);

  try {
    const result = await task();
    logStartupEvent(`${label}:done`, {
      ...metadata,
      durationMs: Math.round(getNowMs() - startedAtMs),
    });
    return result;
  } catch (error) {
    logStartupEvent(`${label}:error`, {
      ...metadata,
      durationMs: Math.round(getNowMs() - startedAtMs),
      error,
    });
    throw error;
  }
}
