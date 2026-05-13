export type AppDiagnosticArea =
  | 'auth'
  | 'capture'
  | 'home'
  | 'map'
  | 'media'
  | 'notes'
  | 'shared-feed'
  | 'startup'
  | 'subscription'
  | 'sync'
  | 'system'
  | 'widget';

export type AppDiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppDiagnosticMetadataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
  | readonly AppDiagnosticMetadataValue[]
  | { readonly [key: string]: AppDiagnosticMetadataValue };

export type AppDiagnosticMetadata = Record<string, AppDiagnosticMetadataValue>;

export interface AppDiagnosticEvent {
  area: AppDiagnosticArea;
  durationMs?: number;
  level: AppDiagnosticLevel;
  metadata?: AppDiagnosticMetadata;
  name: string;
  phase?: 'start' | 'success' | 'failure' | 'event';
  timestampMs: number;
}

export type AppDiagnosticsSink = (event: AppDiagnosticEvent) => void;

let diagnosticsSink: AppDiagnosticsSink | null = null;
let diagnosticsEnabledOverride: boolean | null = null;

function isTestEnvironment() {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

function isDevEnvironment() {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

function hasDiagnosticsEnvOverride() {
  return (
    typeof process !== 'undefined' &&
    process.env?.EXPO_PUBLIC_NOTO_DIAGNOSTICS === '1'
  );
}

export function isAppDiagnosticsEnabled() {
  if (diagnosticsEnabledOverride !== null) {
    return diagnosticsEnabledOverride;
  }

  if (isTestEnvironment()) {
    return false;
  }

  return isDevEnvironment() || hasDiagnosticsEnvOverride();
}

export function getAppDiagnosticsNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function normalizeMetadataValue(value: AppDiagnosticMetadataValue): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'undefined') {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Error) {
    return value.message || value.name;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 240 ? `${serialized.slice(0, 237)}...` : serialized;
  } catch {
    return String(value);
  }
}

function formatMetadata(metadata?: AppDiagnosticMetadata) {
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

function getConsoleMessage(event: AppDiagnosticEvent) {
  const phase = event.phase && event.phase !== 'event' ? `:${event.phase}` : '';
  const duration = typeof event.durationMs === 'number' ? ` durationMs=${event.durationMs}` : '';
  return `[${event.area}] ${event.name}${phase}${duration}${formatMetadata(event.metadata)}`;
}

function writeToConsole(event: AppDiagnosticEvent) {
  const message = getConsoleMessage(event);

  if (event.level === 'error') {
    console.error(message);
    return;
  }

  if (event.level === 'warn') {
    console.warn(message);
    return;
  }

  if (event.level === 'debug') {
    console.debug(message);
    return;
  }

  console.info(message);
}

export function setAppDiagnosticsSink(sink: AppDiagnosticsSink | null) {
  diagnosticsSink = sink;
}

export function setAppDiagnosticsEnabledForTests(enabled: boolean | null) {
  diagnosticsEnabledOverride = enabled;
}

export function resetAppDiagnosticsForTests() {
  diagnosticsSink = null;
  diagnosticsEnabledOverride = null;
}

export function emitAppDiagnostic(
  event: Omit<AppDiagnosticEvent, 'timestampMs'>
): AppDiagnosticEvent | null {
  if (!isAppDiagnosticsEnabled()) {
    return null;
  }

  const nextEvent: AppDiagnosticEvent = {
    ...event,
    timestampMs: getAppDiagnosticsNowMs(),
  };

  diagnosticsSink?.(nextEvent);
  writeToConsole(nextEvent);
  return nextEvent;
}

export function logAppEvent(
  area: AppDiagnosticArea,
  name: string,
  metadata?: AppDiagnosticMetadata,
  options?: { level?: AppDiagnosticLevel }
) {
  return emitAppDiagnostic({
    area,
    level: options?.level ?? 'info',
    metadata,
    name,
    phase: 'event',
  });
}

export function startAppSpan(
  area: AppDiagnosticArea,
  name: string,
  metadata?: AppDiagnosticMetadata,
  options?: { level?: AppDiagnosticLevel }
) {
  const startedAtMs = getAppDiagnosticsNowMs();
  const level = options?.level ?? 'info';
  emitAppDiagnostic({
    area,
    level,
    metadata,
    name,
    phase: 'start',
  });

  return {
    fail(error?: unknown, nextMetadata?: AppDiagnosticMetadata) {
      emitAppDiagnostic({
        area,
        durationMs: Math.round(getAppDiagnosticsNowMs() - startedAtMs),
        level: 'warn',
        metadata: {
          ...metadata,
          ...nextMetadata,
          error: error instanceof Error ? error : undefined,
          errorMessage:
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : undefined,
        },
        name,
        phase: 'failure',
      });
    },
    finish(nextMetadata?: AppDiagnosticMetadata) {
      emitAppDiagnostic({
        area,
        durationMs: Math.round(getAppDiagnosticsNowMs() - startedAtMs),
        level,
        metadata: {
          ...metadata,
          ...nextMetadata,
        },
        name,
        phase: 'success',
      });
    },
  };
}

export async function traceAppAsync<T>(
  area: AppDiagnosticArea,
  name: string,
  task: () => Promise<T>,
  metadata?: AppDiagnosticMetadata,
  options?: { level?: AppDiagnosticLevel }
): Promise<T> {
  if (!isAppDiagnosticsEnabled()) {
    return task();
  }

  const span = startAppSpan(area, name, metadata, options);

  try {
    const result = await task();
    span.finish();
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
}

export function traceAppSync<T>(
  area: AppDiagnosticArea,
  name: string,
  task: () => T,
  metadata?: AppDiagnosticMetadata,
  options?: { level?: AppDiagnosticLevel }
): T {
  if (!isAppDiagnosticsEnabled()) {
    return task();
  }

  const span = startAppSpan(area, name, metadata, options);

  try {
    const result = task();
    span.finish();
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
}
