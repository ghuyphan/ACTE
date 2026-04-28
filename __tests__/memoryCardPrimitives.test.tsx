import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  getNoteMemoryCardRenderSignature,
  getSharedPostMemoryCardRenderSignature,
  NoteMemoryCard,
  SharedPostMemoryCard,
} from '../components/home/MemoryCardPrimitives';

const mockRequestSavePermission = jest.fn();
const mockCapturePolaroidExport = jest.fn();
const mockSavePolaroidToLibrary = jest.fn();
const mockCleanupCapturedImage = jest.fn();
const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
const mockShowAppAlert = jest.fn();
const mockPolaroidAnimation = jest.fn();

const mockT = ((key: string, fallbackOrOptions?: string | { defaultValue?: string; location?: string }) => {
  if (typeof fallbackOrOptions === 'string') {
    return fallbackOrOptions;
  }

  if (fallbackOrOptions?.defaultValue) {
    return fallbackOrOptions.defaultValue.replace('{{location}}', fallbackOrOptions.location ?? '');
  }

  return key;
}) as any;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('expo-image', () => ({
  Image: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View {...props} />;
  },
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../hooks/useHaptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  NotificationFeedbackType: {
    Success: 'success',
  },
  impactAsync: (...args: any[]) => mockImpactAsync(...args),
  notificationAsync: (...args: any[]) => mockNotificationAsync(...args),
}));

jest.mock('../hooks/usePolaroidExportCapture', () => ({
  usePolaroidExportCapture: () => ({
    capturePolaroidExport: (...args: any[]) => mockCapturePolaroidExport(...args),
  }),
}));

jest.mock('../services/polaroidExport', () => ({
  PolaroidExportError: class MockPolaroidExportError extends Error {
    code = 'requires-update' as const;
  },
  requestSavePermission: (...args: any[]) => mockRequestSavePermission(...args),
  savePolaroidToLibrary: (...args: any[]) => mockSavePolaroidToLibrary(...args),
  cleanupCapturedImage: (...args: any[]) => mockCleanupCapturedImage(...args),
}));

jest.mock('../utils/alert', () => ({
  showAppAlert: (...args: any[]) => mockShowAppAlert(...args),
}));

jest.mock('../hooks/useRelativeTimeNow', () => ({
  useRelativeTimeNow: () => new Date('2026-04-10T04:00:00.000Z'),
}));

jest.mock('../hooks/useTheme', () => ({
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
      captureGradient: ['#FFC107', '#FF9F0A'],
    },
  }),
}));

jest.mock('../components/home/SharedPostCardVisual', () => {
  return function MockSharedPostCardVisual() {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="shared-post-card-visual" />;
  };
});

jest.mock('../components/notes/ImageMemoryCard', () => {
  return function MockImageMemoryCard() {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="image-memory-card" />;
  };
});

jest.mock('../components/notes/TextMemoryCard', () => {
  return function MockTextMemoryCard() {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="text-memory-card" />;
  };
});

jest.mock('../components/ui/LivePhotoIcon', () => {
  return function MockLivePhotoIcon() {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>live-photo-icon</Text>;
  };
});

jest.mock('../components/notes/detail/PolaroidExportAnimation', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockPolaroidExportAnimation(props: any) {
    React.useEffect(() => {
      if (props.uri && props.success) {
        mockPolaroidAnimation(props);
        props.onFinished?.();
      }
    }, [props]);

    if (!props.uri) {
      return null;
    }

    return <View testID="mock-polaroid-export-animation" />;
  };
});

jest.mock('../components/ui/InfoPill', () => {
  return function MockInfoPill({ children, style }: any) {
    const React = require('react');
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  };
});

const colors = {
  primary: '#FFC107',
  text: '#1C1C1E',
  secondaryText: '#8E8E93',
  danger: '#FF3B30',
  card: '#FFFFFF',
};

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  mockRequestSavePermission.mockResolvedValue('granted');
  mockCapturePolaroidExport.mockResolvedValue('file:///tmp/noto-polaroid.png');
  mockSavePolaroidToLibrary.mockResolvedValue(undefined);
  mockCleanupCapturedImage.mockImplementation(() => undefined);
  mockImpactAsync.mockResolvedValue(undefined);
  mockNotificationAsync.mockResolvedValue(undefined);
});

describe('SharedPostMemoryCard', () => {
  it('includes visual and metadata fields in the shared-post render signature', () => {
    const basePost = {
      id: 'shared-1',
      type: 'photo',
      text: 'Shared memory',
      photoLocalUri: 'file:///local.jpg',
      photoPath: 'user-1/shared-1.jpg',
      isLivePhoto: true,
      pairedVideoLocalUri: 'file:///local.mov',
      pairedVideoPath: 'user-1/shared-1.mov',
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      noteColor: null,
      placeName: 'District 1',
      createdAt: '2026-04-10T02:00:00.000Z',
      authorDisplayName: 'Lan',
      authorPhotoURLSnapshot: null,
    } as any;

    expect(getSharedPostMemoryCardRenderSignature(basePost)).not.toBe(
      getSharedPostMemoryCardRenderSignature({
        ...basePost,
        pairedVideoPath: 'user-1/shared-1-updated.mov',
      })
    );
  });

  it('formats timestamps the same way as note cards', () => {
    const post = {
      id: 'shared-1',
      authorUid: 'friend-1',
      authorDisplayName: 'Lan',
      authorPhotoURLSnapshot: null,
      audienceUserIds: ['me'],
      type: 'text',
      text: 'Shared memory',
      photoPath: null,
      photoLocalUri: null,
      isLivePhoto: false,
      pairedVideoPath: null,
      pairedVideoLocalUri: null,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      noteColor: null,
      placeName: 'District 3',
      sourceNoteId: 'note-1',
      latitude: null,
      longitude: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByText, queryByText } = render(
      <SharedPostMemoryCard
        post={post}
        colors={{
          primary: '#FFC107',
          text: '#1C1C1E',
          secondaryText: '#8E8E93',
          danger: '#FF3B30',
          card: '#FFFFFF',
        }}
        t={mockT}
        showSharedBadge
      />
    );

    expect(getByText('Shared')).toBeTruthy();
    expect(getByText('2h')).toBeTruthy();
    expect(queryByText(/Apr\s+10/i)).toBeNull();
  });
});

describe('NoteMemoryCard', () => {
  it('includes visual and metadata fields in the note render signature', () => {
    const baseNote = {
      id: 'note-1',
      type: 'photo',
      content: 'file:///photo.jpg',
      caption: null,
      photoLocalUri: 'file:///photo.jpg',
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: true,
      pairedVideoLocalUri: 'file:///photo.mov',
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      captureVariant: 'single',
      dualComposedPhotoLocalUri: null,
      locationName: 'District 1',
      createdAt: '2026-04-10T02:00:00.000Z',
      isFavorite: false,
      moodEmoji: null,
      noteColor: null,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
    } as any;

    expect(getNoteMemoryCardRenderSignature(baseNote)).not.toBe(
      getNoteMemoryCardRenderSignature({
        ...baseNote,
        photoSyncedLocalUri: 'file:///synced-photo.jpg',
      })
    );
  });

  it('shows the shared badge for a text note shared by me', () => {
    const note = {
      id: 'note-1',
      type: 'text',
      content: 'Shared memory',
      caption: null,
      photoLocalUri: null,
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 3',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByTestId, queryByTestId } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        isSharedByMe
      />
    );

    expect(getByTestId('note-memory-shared-badge')).toBeTruthy();
    expect(queryByTestId('note-memory-live-badge')).toBeNull();
  });

  it('shows both shared and live badges for a shared live photo', () => {
    const note = {
      id: 'note-2',
      type: 'photo',
      content: '',
      caption: null,
      photoLocalUri: 'file:///photo.jpg',
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: true,
      pairedVideoLocalUri: 'file:///photo.mov',
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 1',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByTestId } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        isSharedByMe
      />
    );

    expect(getByTestId('note-memory-shared-badge')).toBeTruthy();
    expect(getByTestId('note-memory-live-badge')).toBeTruthy();
  });

  it('keeps the shared badge out of the top-left dual-capture inset area', () => {
    const note = {
      id: 'note-dual-shared',
      type: 'photo',
      content: '',
      caption: null,
      photoLocalUri: 'file:///photo.jpg',
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      captureVariant: 'dual',
      dualComposedPhotoLocalUri: 'file:///dual-composed.jpg',
      dualPrimaryPhotoLocalUri: 'file:///back.jpg',
      dualSecondaryPhotoLocalUri: 'file:///front.jpg',
      dualLayoutPreset: 'top-left',
      locationName: 'District 1',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByTestId, queryByTestId } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        isSharedByMe
      />
    );

    expect(getByTestId('note-memory-shared-badge')).toBeTruthy();
    expect(queryByTestId('note-memory-shared-badge-anchor')).toBeNull();
  });

  it('expands only the tapped badge into a labeled chip', () => {
    const note = {
      id: 'note-legend-1',
      type: 'photo',
      content: '',
      caption: null,
      photoLocalUri: 'file:///photo.jpg',
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: true,
      pairedVideoLocalUri: 'file:///photo.mov',
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 1',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: true,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByTestId } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        isSharedByMe
      />
    );

    expect(getByTestId('note-memory-live-badge').props.accessibilityState).toEqual({ expanded: false });
    expect(getByTestId('note-memory-shared-badge').props.accessibilityState).toEqual({ expanded: false });
    expect(getByTestId('note-memory-favorite-badge').props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(getByTestId('note-memory-live-badge'));

    expect(getByTestId('note-memory-live-badge').props.accessibilityState).toEqual({ expanded: true });
    expect(getByTestId('note-memory-shared-badge').props.accessibilityState).toEqual({ expanded: false });
    expect(getByTestId('note-memory-favorite-badge').props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(getByTestId('note-memory-shared-badge'));

    expect(getByTestId('note-memory-live-badge').props.accessibilityState).toEqual({ expanded: false });
    expect(getByTestId('note-memory-shared-badge').props.accessibilityState).toEqual({ expanded: true });
    expect(getByTestId('note-memory-favorite-badge').props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(getByTestId('note-memory-shared-badge'));

    expect(getByTestId('note-memory-live-badge').props.accessibilityState).toEqual({ expanded: false });
    expect(getByTestId('note-memory-shared-badge').props.accessibilityState).toEqual({ expanded: false });
    expect(getByTestId('note-memory-favorite-badge').props.accessibilityState).toEqual({ expanded: false });
  });

  it('renders the text card branch with location-pill, polaroid, and detail actions', () => {
    const onPress = jest.fn();
    const note = {
      id: 'note-text-1',
      type: 'text',
      content: 'Shared memory',
      caption: null,
      photoLocalUri: null,
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 5',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: '[]',
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getAllByLabelText, getAllByRole, getByTestId, getByText } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        onPress={onPress}
      />
    );

    expect(getByTestId('text-memory-card')).toBeTruthy();
    expect(getByText('District 5')).toBeTruthy();
    expect(getAllByRole('button')).toHaveLength(3);

    fireEvent.press(getByTestId('note-memory-visual-action'));
    fireEvent.press(getAllByLabelText('Open note details for District 5')[1]);

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('exports a polaroid from the note-card footer action', async () => {
    const note = {
      id: 'note-polaroid-1',
      type: 'text',
      content: 'Shared memory',
      caption: null,
      photoLocalUri: null,
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 5',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: '[]',
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByLabelText } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        onPress={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Save as Polaroid'));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockCapturePolaroidExport).toHaveBeenCalledTimes(1), {
      timeout: 1000,
    });

    expect(mockRequestSavePermission).toHaveBeenCalledTimes(1);
    expect(mockCapturePolaroidExport).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackGradient: expect.any(Array),
        fallbackLocationLabel: 'Unknown place',
        note,
        settleDelayMs: 140,
      })
    );
    expect(mockSavePolaroidToLibrary).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
    expect(mockCleanupCapturedImage).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
    expect(mockNotificationAsync).toHaveBeenCalledWith('success');
    expect(mockPolaroidAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        presentation: 'modal',
        success: true,
        successLabel: 'Saved to your photos',
        uri: 'file:///tmp/noto-polaroid.png',
        variant: 'home-feed',
      })
    );
    expect(mockShowAppAlert).not.toHaveBeenCalled();
  });

  it('saves the provider-captured polaroid without mounting a local export view', async () => {
    const note = {
      id: 'note-polaroid-timeout-1',
      type: 'text',
      content: 'Shared memory',
      caption: null,
      photoLocalUri: null,
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 5',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: '[]',
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByLabelText } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        onPress={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Save as Polaroid'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockCapturePolaroidExport).toHaveBeenCalledTimes(1);
    });
    expect(mockSavePolaroidToLibrary).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
    expect(mockCleanupCapturedImage).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
    expect(mockShowAppAlert).not.toHaveBeenCalled();
  });

  it('renders the photo card branch when a note has photo media', () => {
    const note = {
      id: 'note-photo-2',
      type: 'photo',
      content: '',
      caption: 'Sunset',
      photoLocalUri: 'file:///photo-2.jpg',
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'District 7',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByTestId } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
      />
    );

    expect(getByTestId('image-memory-card')).toBeTruthy();
  });
});

describe('SharedPostMemoryCard interactions', () => {
  it('renders metadata and forwards presses through the details CTA shell', () => {
    const onPress = jest.fn();
    const post = {
      id: 'shared-2',
      authorUid: 'friend-1',
      authorDisplayName: 'Lan',
      authorPhotoURLSnapshot: null,
      audienceUserIds: ['me'],
      type: 'text',
      text: 'Shared memory',
      photoPath: null,
      photoLocalUri: null,
      isLivePhoto: false,
      pairedVideoPath: null,
      pairedVideoLocalUri: null,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      noteColor: null,
      placeName: 'District 3',
      sourceNoteId: 'note-1',
      latitude: null,
      longitude: null,
      createdAt: '2026-04-10T02:00:00.000Z',
      updatedAt: null,
    } as any;

    const { getByLabelText, getByText, getByTestId } = render(
      <SharedPostMemoryCard
        post={post}
        colors={colors}
        t={mockT}
        onPress={onPress}
      />
    );

    expect(getByTestId('shared-post-card-visual')).toBeTruthy();
    expect(getByText('District 3')).toBeTruthy();

    fireEvent.press(getByTestId('shared-post-memory-visual-action'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
