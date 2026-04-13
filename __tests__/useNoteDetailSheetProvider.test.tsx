import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { NoteDetailSheetProvider, useNoteDetailSheet } from '../hooks/useNoteDetailSheet';

const mockRenderedSheets = new Map<string, any>();

jest.mock('../components/notes/NoteDetailSheet', () => {
  return function MockNoteDetailSheet(props: any) {
    mockRenderedSheets.set(props.noteId, props);
    return null;
  };
});

function Controls() {
  const { closeNoteDetail, openNoteDetail } = useNoteDetailSheet();

  return (
    <>
      <Pressable onPress={() => openNoteDetail('note-a')}>
        <Text>open-a</Text>
      </Pressable>
      <Pressable onPress={() => openNoteDetail('note-b')}>
        <Text>open-b</Text>
      </Pressable>
      <Pressable onPress={() => closeNoteDetail()}>
        <Text>close</Text>
      </Pressable>
    </>
  );
}

describe('NoteDetailSheetProvider', () => {
  beforeEach(() => {
    mockRenderedSheets.clear();
  });

  it('ignores stale close completions from an older note selection', async () => {
    const { getByText } = render(
      <NoteDetailSheetProvider>
        <Controls />
      </NoteDetailSheetProvider>
    );

    fireEvent.press(getByText('open-a'));

    await waitFor(() => {
      expect(mockRenderedSheets.get('note-a')?.visible).toBe(true);
    });

    fireEvent.press(getByText('close'));

    await waitFor(() => {
      expect(mockRenderedSheets.get('note-a')?.visible).toBe(false);
    });

    const staleOnClosed = mockRenderedSheets.get('note-a')?.onClosed;

    fireEvent.press(getByText('open-b'));

    await waitFor(() => {
      expect(mockRenderedSheets.get('note-b')?.visible).toBe(true);
    });

    act(() => {
      staleOnClosed?.();
    });

    expect(mockRenderedSheets.get('note-b')?.visible).toBe(true);
  });
});
