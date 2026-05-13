import {
  emitAppDiagnostic,
  logAppEvent,
  resetAppDiagnosticsForTests,
  setAppDiagnosticsEnabledForTests,
  setAppDiagnosticsSink,
  traceAppAsync,
  type AppDiagnosticEvent,
} from '../utils/appDiagnostics';

describe('appDiagnostics', () => {
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    resetAppDiagnosticsForTests();
    console.info = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    resetAppDiagnosticsForTests();
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
  });

  it('stays quiet when diagnostics are disabled', () => {
    const events: AppDiagnosticEvent[] = [];
    setAppDiagnosticsEnabledForTests(false);
    setAppDiagnosticsSink((event) => events.push(event));

    const emitted = logAppEvent('startup', 'quiet.event', { ready: true });

    expect(emitted).toBeNull();
    expect(events).toEqual([]);
    expect(console.info).not.toHaveBeenCalled();
  });

  it('emits structured events to the sink and console when enabled', () => {
    const events: AppDiagnosticEvent[] = [];
    setAppDiagnosticsEnabledForTests(true);
    setAppDiagnosticsSink((event) => events.push(event));

    const emitted = emitAppDiagnostic({
      area: 'notes',
      level: 'info',
      metadata: { count: 3, signedIn: true },
      name: 'notes.loaded',
      phase: 'event',
    });

    expect(emitted).toMatchObject({
      area: 'notes',
      level: 'info',
      metadata: { count: 3, signedIn: true },
      name: 'notes.loaded',
      phase: 'event',
    });
    expect(events).toHaveLength(1);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[notes] notes.loaded count=3 signedIn=true')
    );
  });

  it('traces async success and failure durations', async () => {
    const events: AppDiagnosticEvent[] = [];
    setAppDiagnosticsEnabledForTests(true);
    setAppDiagnosticsSink((event) => events.push(event));

    await expect(
      traceAppAsync('sync', 'sync.test', async () => 'ok', { mode: 'full' })
    ).resolves.toBe('ok');
    await expect(
      traceAppAsync('widget', 'widget.test', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(events.map((event) => `${event.area}:${event.name}:${event.phase}`)).toEqual([
      'sync:sync.test:start',
      'sync:sync.test:success',
      'widget:widget.test:start',
      'widget:widget.test:failure',
    ]);
    expect(events[1]?.durationMs).toEqual(expect.any(Number));
    expect(events[3]?.metadata).toMatchObject({ errorMessage: 'boom' });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[widget] widget.test:failure'));
  });
});
