import { useEffect, useMemo, useState } from 'react';
import type { NotesLoadPhase } from '../state/useNotesStore';
import { logStartupEvent } from '../../utils/startupTrace';

interface UseHomeInitialFeedGateParams {
  userUid: string | null | undefined;
  notesCount?: number;
  notesPhase: NotesLoadPhase;
}

function isNotesReadyForInitialHome(phase: NotesLoadPhase, notesCount = 0) {
  if (phase === 'bootstrapping') {
    return false;
  }

  return phase !== 'hydrating' || notesCount > 0;
}

export function useHomeInitialFeedGate({
  userUid,
  notesCount = 0,
  notesPhase,
}: UseHomeInitialFeedGateParams) {
  const sessionKey = userUid?.trim() || 'signed-out';
  const [releasedSessionKey, setReleasedSessionKey] = useState<string | null>(null);

  const notesReady = isNotesReadyForInitialHome(notesPhase, notesCount);
  const released = releasedSessionKey === sessionKey;

  useEffect(() => {
    setReleasedSessionKey(null);
  }, [sessionKey]);

  useEffect(() => {
    if (released || !notesReady) {
      return;
    }

    setReleasedSessionKey(sessionKey);
    logStartupEvent('home.initial-feed-gate:released', {
      reason: 'ready',
      sessionKey,
    });
  }, [notesReady, released, sessionKey]);

  const ready = released || notesReady;

  return useMemo(
    () => ({
      ready,
      pending: !ready,
    }),
    [ready]
  );
}
