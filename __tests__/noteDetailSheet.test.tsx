import React from 'react';
import { Alert, Share, Text, TextInput, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockGetNoteById = jest.fn<Promise<unknown>, [string]>();
const mockDeleteNote = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockUpdateNote = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockToggleFavorite = jest.fn<Promise<boolean>, [string]>(async () => true);
const mockSaveNoteDoodle = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockClearNoteDoodle = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockRouterPush = jest.fn();
const mockImpactAsync = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockNotificationAsync = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockNotesStore = {
  getNoteById: (noteId: string) => mockGetNoteById(noteId),
  deleteNote: (noteId: string) => mockDeleteNote(noteId),
  updateNote: (noteId: string, updates: unknown) => mockUpdateNote(noteId, updates),
  toggleFavorite: (noteId: string) => mockToggleFavorite(noteId),
  refreshNotes: jest.fn(async () => undefined),
};

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BottomSheet: ({ children, isPresented, onIsPresentedChange }: any) => {
      React.useEffect(() => {
        if (!isPresented) {
          onIsPresentedChange?.(false);
        }
      }, [isPresented, onIsPresentedChange]);

      return <View>{children}</View>;
    },
    Group: ({ children }: any) => <View>{children}</View>,
    Host: ({ children }: any) => <View>{children}</View>,
    RNHostView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  environment: jest.fn(),
  presentationDragIndicator: jest.fn(),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: (type: unknown) => mockImpactAsync(type),
  notificationAsync: (type: unknown) => mockNotificationAsync(type),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { location?: string; value?: string }) => {
      if (typeof fallbackOrOptions === 'string') {
        return fallbackOrOptions;
      }
      if (key === 'noteDetail.sharePhotoMsg') {
        return `Photo Memory at ${fallbackOrOptions?.location ?? 'Unknown Place'}`;
      }
      if (key === 'noteDetail.radiusValue') {
        return `Reminder radius: ${fallbackOrOptions?.value ?? ''}`;
      }
      return key;
    },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  CardGradients: [['#333333', '#555555']],
  useTheme: () => ({
    isDark: false,
    colors: {
      background: '#FAF9F6',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      accent: '#FF9F0A',
      border: '#E5E5EA',
      danger: '#FF3B30',
      success: '#34C759',
      gradient: ['#FFC107', '#FF9F0A'],
      captureButtonBg: '#1C1C1E',
      tabBarBg: 'rgba(250,249,246,0.92)',
      captureCardText: '#1C1C1E',
      captureCardPlaceholder: 'rgba(28,28,30,0.48)',
      captureCardBorder: 'rgba(255,255,255,0.22)',
      captureGlassFill: 'rgba(255,252,246,0.62)',
      captureGlassBorder: 'rgba(255,255,255,0.3)',
      captureGlassText: '#2B2621',
      captureGlassIcon: 'rgba(43,38,33,0.52)',
      captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
      captureGlassColorScheme: 'light',
      captureCameraOverlay: 'rgba(28,28,30,0.48)',
      captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
      captureCameraOverlayText: '#FFFDFC',
      captureFlashOverlay: 'rgba(255,250,242,0.96)',
    },
  }),
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockRouterPush(...args),
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    deleteSharedNote: jest.fn(async () => undefined),
    updateSharedNote: jest.fn(async () => undefined),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => mockNotesStore,
}));

jest.mock('../services/noteDoodles', () => ({
  getNoteDoodle: jest.fn(async () => null),
  parseNoteDoodleStrokes: (strokesJson: string | null | undefined) => {
    if (!strokesJson) {
      return [];
    }

    return JSON.parse(strokesJson);
  },
  saveNoteDoodle: (noteId: string, strokesJson: string) => mockSaveNoteDoodle(noteId, strokesJson),
  clearNoteDoodle: (noteId: string) => mockClearNoteDoodle(noteId),
}));

jest.mock('../utils/interactionFeedback', () => ({
  emitInteractionFeedback: jest.fn(),
}));

jest.mock('../utils/dateUtils', () => ({
  formatDate: () => 'Mar 10, 2026',
}));

jest.mock('../utils/platform', () => ({
  isOlderIOS: false,
}));

jest.mock('../components/ui/TransientStatusChip', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockTransientStatusChip() {
    return <View />;
  };
});

jest.mock('../components/AppBottomSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockAppBottomSheet({ children }: any) {
    return <View>{children}</View>;
  };
});

jest.mock('../components/NoteDoodleCanvas', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteDoodleCanvas(props: any) {
      return (
        <View testID="mock-note-doodle-canvas">
          <Text testID="mock-note-doodle-editable">{String(props.editable)}</Text>
          <Text testID="mock-note-doodle-count">{String(props.strokes?.length ?? 0)}</Text>
          <Pressable
            testID="mock-note-doodle-commit"
            onPress={() =>
              props.onChangeStrokes?.([
                { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
                { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
              ])
            }
          />
        </View>
      );
    },
  };
});

import NoteDetailSheet from '../components/NoteDetailSheet';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNoteById.mockResolvedValue({
    id: 'note-1',
    type: 'text',
    content: 'Original note',
    photoLocalUri: null,
    photoRemoteBase64: null,
    locationName: 'Old place',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    hasDoodle: false,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: null,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('NoteDetailSheet', () => {
  it('toggles favorite from the detail card', async () => {
    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-favorite')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-favorite'));
    });

    expect(mockToggleFavorite).toHaveBeenCalledWith('note-1');
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('saves edited content, location, and radius', async () => {
    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await act(async () => {
      fireEvent.changeText(getByTestId('note-detail-content-input'), 'Updated note');
      fireEvent.changeText(getByTestId('note-detail-location-input'), 'New place');
      fireEvent.press(getByTestId('note-detail-radius-250'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', {
      content: 'Updated note',
      locationName: 'New place',
      radius: 250,
    });
  });

  it('shows saved doodles and lets you edit them', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'note-1',
      type: 'text',
      content: 'Original note',
      photoLocalUri: null,
      photoRemoteBase64: null,
      locationName: 'Old place',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('mock-note-doodle-count')).toHaveTextContent('1');
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-doodle-toggle'));
    expect(getByTestId('mock-note-doodle-editable')).toHaveTextContent('true');

    fireEvent.press(getByTestId('mock-note-doodle-commit'));

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockSaveNoteDoodle).toHaveBeenCalledWith(
      'note-1',
      JSON.stringify([
        { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
      ])
    );
  });

  it('shares photo notes with the file url', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'photo-1',
      type: 'photo',
      content: 'file:///photos/photo-1.jpg',
      photoLocalUri: 'file:///photos/photo-1.jpg',
      photoRemoteBase64: null,
      locationName: 'Coffee shop',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="photo-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-share')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-share'));
    });

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'file:///photos/photo-1.jpg',
      })
    );
  });

  it('shows and saves doodles on photo notes', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'photo-1',
      type: 'photo',
      content: 'file:///photos/photo-1.jpg',
      photoLocalUri: 'file:///photos/photo-1.jpg',
      photoRemoteBase64: null,
      locationName: 'Coffee shop',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="photo-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('mock-note-doodle-count')).toHaveTextContent('1');
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-doodle-toggle'));
    expect(getByTestId('mock-note-doodle-editable')).toHaveTextContent('true');

    fireEvent.press(getByTestId('mock-note-doodle-commit'));

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockSaveNoteDoodle).toHaveBeenCalledWith(
      'photo-1',
      JSON.stringify([
        { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
      ])
    );
  });

  it('confirms deletes before removing a note', async () => {
    const onClose = jest.fn();
    const onClosed = jest.fn();
    const { getByTestId, rerender } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={onClose} onClosed={onClosed} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-delete')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-delete'));
    expect(Alert.alert).toHaveBeenCalled();

    const alertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertArgs[2] as Array<{ text?: string; onPress?: () => void }>;
    const destructiveButton = buttons.find((button) => button.text === 'Delete');
    expect(destructiveButton?.onPress).toBeTruthy();

    await act(async () => {
      destructiveButton?.onPress?.();
    });

    expect(onClose).toHaveBeenCalled();

    rerender(
      <NoteDetailSheet noteId="note-1" visible={false} onClose={onClose} onClosed={onClosed} />
    );

    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalledWith('note-1');
    });

    expect(onClosed).toHaveBeenCalled();
  });

  it('does not render the legacy share-to-room action', async () => {
    const { queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
    });

    expect(queryByTestId('note-detail-share-room')).toBeNull();
  });

  it('ignores stale note loads when the selected note changes quickly', async () => {
    let resolveFirstNote: ((value: unknown) => void) | null = null;
    let resolveSecondNote: ((value: unknown) => void) | null = null;

    mockGetNoteById.mockImplementation((noteId: string) => new Promise((resolve) => {
      if (noteId === 'note-1') {
        resolveFirstNote = resolve;
        return;
      }

      resolveSecondNote = resolve;
    }));

    const { queryByDisplayValue, rerender } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    rerender(
      <NoteDetailSheet noteId="note-2" visible onClose={() => undefined} />
    );

    await act(async () => {
      resolveSecondNote?.({
        id: 'note-2',
        type: 'text',
        content: 'Second note',
        photoLocalUri: null,
        photoRemoteBase64: null,
        locationName: 'New place',
        latitude: 10.78,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      });
    });

    await waitFor(() => {
      expect(queryByDisplayValue('Second note')).toBeTruthy();
    });

    await act(async () => {
      resolveFirstNote?.({
        id: 'note-1',
        type: 'text',
        content: 'First note',
        photoLocalUri: null,
        photoRemoteBase64: null,
        locationName: 'Old place',
        latitude: 10.77,
        longitude: 106.69,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
      });
    });

    expect(queryByDisplayValue('Second note')).toBeTruthy();
    expect(queryByDisplayValue('First note')).toBeNull();
  });
});
