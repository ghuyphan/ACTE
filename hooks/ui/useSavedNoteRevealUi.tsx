import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

interface SavedNoteRevealUiContextValue {
  isSavedNoteRevealActive: boolean;
  setSavedNoteRevealActive: (active: boolean) => void;
}

const SavedNoteRevealUiContext = createContext<SavedNoteRevealUiContextValue>({
  isSavedNoteRevealActive: false,
  setSavedNoteRevealActive: () => {},
});

export function SavedNoteRevealUiProvider({ children }: { children: ReactNode }) {
  const [isSavedNoteRevealActive, setSavedNoteRevealActive] = useState(false);

  const value = useMemo<SavedNoteRevealUiContextValue>(
    () => ({
      isSavedNoteRevealActive,
      setSavedNoteRevealActive,
    }),
    [isSavedNoteRevealActive]
  );

  return (
    <SavedNoteRevealUiContext.Provider value={value}>
      {children}
    </SavedNoteRevealUiContext.Provider>
  );
}

export function useSavedNoteRevealUi() {
  return useContext(SavedNoteRevealUiContext);
}
