import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';

interface ActiveNoteEntry {
  key: string;
  noteId: string;
}

interface ActiveNoteContextValue {
  setActiveNote: (key: string, noteId: string) => void;
  clearActiveNote: (key: string) => void;
  peekActiveNoteId: () => string | null;
}

const ActiveNoteContext = createContext<ActiveNoteContextValue | undefined>(undefined);

export function ActiveNoteProvider({ children }: { children: ReactNode }) {
  const activeEntriesRef = useRef<ActiveNoteEntry[]>([]);

  const setActiveNote = useCallback((key: string, noteId: string) => {
    activeEntriesRef.current = [
      ...activeEntriesRef.current.filter((entry) => entry.key !== key),
      { key, noteId },
    ];
  }, []);

  const clearActiveNote = useCallback((key: string) => {
    activeEntriesRef.current = activeEntriesRef.current.filter((entry) => entry.key !== key);
  }, []);

  const peekActiveNoteId = useCallback(() => {
    return activeEntriesRef.current[activeEntriesRef.current.length - 1]?.noteId ?? null;
  }, []);

  const value = useMemo<ActiveNoteContextValue>(
    () => ({
      setActiveNote,
      clearActiveNote,
      peekActiveNoteId,
    }),
    [clearActiveNote, peekActiveNoteId, setActiveNote]
  );

  return <ActiveNoteContext.Provider value={value}>{children}</ActiveNoteContext.Provider>;
}

export function useActiveNote() {
  const context = useContext(ActiveNoteContext);
  if (!context) {
    throw new Error('useActiveNote must be used within an ActiveNoteProvider');
  }

  return context;
}
