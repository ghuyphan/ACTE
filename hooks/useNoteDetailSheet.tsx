import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import NoteDetailSheet from '../components/NoteDetailSheet';

interface NoteDetailSheetContextValue {
  openNoteDetail: (noteId: string) => void;
  closeNoteDetail: () => void;
}

const NoteDetailSheetContext = createContext<NoteDetailSheetContextValue | undefined>(undefined);

export function NoteDetailSheetProvider({ children }: { children: ReactNode }) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const value = useMemo<NoteDetailSheetContextValue>(
    () => ({
      openNoteDetail: (noteId: string) => {
        setSelectedNoteId(noteId);
      },
      closeNoteDetail: () => {
        setSelectedNoteId(null);
      },
    }),
    []
  );

  return (
    <NoteDetailSheetContext.Provider value={value}>
      {children}
      {selectedNoteId ? (
        <NoteDetailSheet
          noteId={selectedNoteId}
          visible
          onClose={() => {
            setSelectedNoteId(null);
          }}
        />
      ) : null}
    </NoteDetailSheetContext.Provider>
  );
}

export function useNoteDetailSheet() {
  const context = useContext(NoteDetailSheetContext);
  if (!context) {
    throw new Error('useNoteDetailSheet must be used within a NoteDetailSheetProvider');
  }
  return context;
}
