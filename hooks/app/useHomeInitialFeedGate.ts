import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotesLoadPhase } from '../state/useNotesStore';
import type { SharedFeedLoadPhase } from '../useSharedFeedStore';
import { logStartupEvent } from '../../utils/startupTrace';

export const HOME_INITIAL_SHARED_FEED_WAIT_MS = 700;

interface UseHomeInitialFeedGateParams {
  userUid: string | null | undefined;
  notesPhase: NotesLoadPhase;
  sharedEnabled: boolean;
  sharedPhase: SharedFeedLoadPhase;
  waitMs?: number;
}

function isNotesReadyForInitialHome(phase: NotesLoadPhase) {
  return phase !== 'bootstrapping';
}

function isSharedReadyForInitialHome(enabled: boolean, phase: SharedFeedLoadPhase) {
  return !enabled || phase !== 'bootstrapping';
}

export function useHomeInitialFeedGate({
  userUid,
  notesPhase,
  sharedEnabled,
  sharedPhase,
  waitMs = HOME_INITIAL_SHARED_FEED_WAIT_MS,
}: UseHomeInitialFeedGateParams) {
  const sessionKey = userUid?.trim() || 'signed-out';
  const [releasedSessionKey, setReleasedSessionKey] = useState<string | null>(null);
  const [timedOutSessionKey, setTimedOutSessionKey] = useState<string | null>(null);
  const waitStartedAtRef = useRef<number | null>(null);

  const notesReady = isNotesReadyForInitialHome(notesPhase);
  const sharedReady = isSharedReadyForInitialHome(sharedEnabled, sharedPhase);
  const released = releasedSessionKey === sessionKey;

  useEffect(() => {
    setReleasedSessionKey(null);
    setTimedOutSessionKey(null);
    waitStartedAtRef.current = null;
  }, [sessionKey]);

  useEffect(() => {
    if (released || !notesReady || !sharedReady) {
      return;
    }

    const startedAtMs = waitStartedAtRef.current;
    setReleasedSessionKey(sessionKey);
    waitStartedAtRef.current = null;
    logStartupEvent('home.initial-feed-gate:released', {
      durationMs: startedAtMs == null ? undefined : Date.now() - startedAtMs,
      reason: 'ready',
      sessionKey,
      sharedPhase,
    });
  }, [notesReady, released, sessionKey, sharedPhase, sharedReady]);

  useEffect(() => {
    if (released || !notesReady || sharedReady) {
      return;
    }

    if (waitStartedAtRef.current == null) {
      waitStartedAtRef.current = Date.now();
      logStartupEvent('home.initial-feed-gate:waiting-shared', {
        sessionKey,
        sharedPhase,
      });
    }

    const timeout = setTimeout(() => {
      setTimedOutSessionKey(sessionKey);
      setReleasedSessionKey(sessionKey);
      const startedAtMs = waitStartedAtRef.current;
      waitStartedAtRef.current = null;
      logStartupEvent('home.initial-feed-gate:released', {
        durationMs: startedAtMs == null ? undefined : Date.now() - startedAtMs,
        reason: 'timeout',
        sessionKey,
        sharedPhase,
      });
    }, waitMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [notesReady, released, sessionKey, sharedPhase, sharedReady, waitMs]);

  const timedOut = timedOutSessionKey === sessionKey && !sharedReady;
  const ready = released || (notesReady && sharedReady);

  return useMemo(
    () => ({
      ready,
      pending: !ready,
      timedOut,
    }),
    [ready, timedOut]
  );
}
