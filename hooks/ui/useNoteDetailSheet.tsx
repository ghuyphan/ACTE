import { createContext, ReactNode, useContext, useMemo, useRef, useState } from 'react';
import NoteDetailSheet from '../../components/notes/NoteDetailSheet';

interface NoteDetailSheetContextValue {
  openNoteDetail: (noteId: string) => void;
  closeNoteDetail: () => void;
}

interface NoteDetailSelection {
  noteId: string;
  requestId: number;
}

const NoteDetailSheetContext = createContext<NoteDetailSheetContextValue | undefined>(undefined);

export function NoteDetailSheetProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<NoteDetailSelection | null>(null);
  const [visible, setVisible] = useState(false);
  const activeRequestIdRef = useRef<number | null>(null);

  const value = useMemo<NoteDetailSheetContextValue>(
    () => ({
      openNoteDetail: (noteId: string) => {
        setSelection((current) => {
          const nextSelection = {
          noteId,
          requestId: (current?.requestId ?? 0) + 1,
          };
          activeRequestIdRef.current = nextSelection.requestId;
          return nextSelection;
        });
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
      {selection ? (
        <NoteDetailSheet
          key={selection.noteId}
          noteId={selection.noteId}
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          onClosed={() => {
            if (activeRequestIdRef.current !== selection.requestId) {
              return;
            }

            activeRequestIdRef.current = null;
            setVisible(false);
            setSelection(null);
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
