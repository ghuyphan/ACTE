import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import NoteDetailSheet from '../components/NoteDetailSheet';

interface NoteDetailSheetContextValue {
  openNoteDetail: (noteId: string) => void;
  closeNoteDetail: () => void;
}

const NoteDetailSheetContext = createContext<NoteDetailSheetContextValue | undefined>(undefined);

export function NoteDetailSheetProvider({ children }: { children: ReactNode }) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const value = useMemo<NoteDetailSheetContextValue>(
    () => ({
      openNoteDetail: (noteId: string) => {
        setSelectedNoteId(noteId);
        setVisible(true);
      },
      closeNoteDetail: () => {
        setVisible(false);
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
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          onClosed={() => {
            setVisible(false);
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
