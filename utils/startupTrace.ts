import {
  logAppEvent,
  traceAppAsync,
  type AppDiagnosticMetadata,
} from './appDiagnostics';

type StartupTraceMetadata = AppDiagnosticMetadata;

export function logStartupEvent(label: string, metadata?: StartupTraceMetadata) {
  logAppEvent('startup', label, metadata);
}

export async function traceStartupAsync<T>(
  label: string,
  task: () => Promise<T>,
  metadata?: StartupTraceMetadata
): Promise<T> {
  return traceAppAsync('startup', label, task, metadata);
}
