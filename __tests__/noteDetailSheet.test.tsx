import React from 'react';
import { Alert, Share, Text, TextInput, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockGetNoteById = jest.fn();
const mockDeleteNote = jest.fn(async () => undefined);
const mockUpdateNote = jest.fn(async () => undefined);
const mockToggleFavorite = jest.fn(async () => true);
const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
const mockNotesStore = {
  getNoteById: (...args: unknown[]) => mockGetNoteById(...args),
  deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
  toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
};

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BottomSheet: ({ children }: any) => <View>{children}</View>,
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
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
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
    },
  }),
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => mockNotesStore,
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

  it('toggles favorite state and confirms deletes before removing a note', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={onClose} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-favorite')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-favorite'));
    });

    expect(mockToggleFavorite).toHaveBeenCalledWith('note-1');

    fireEvent.press(getByTestId('note-detail-delete'));
    expect(Alert.alert).toHaveBeenCalled();

    const alertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertArgs[2] as Array<{ text?: string; onPress?: () => void }>;
    const destructiveButton = buttons.find((button) => button.text === 'Delete');
    expect(destructiveButton?.onPress).toBeTruthy();

    await act(async () => {
      destructiveButton?.onPress?.();
    });

    expect(mockDeleteNote).toHaveBeenCalledWith('note-1');
    expect(onClose).toHaveBeenCalled();
  });
});
