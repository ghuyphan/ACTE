import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NoteMemoryCard, SharedPostMemoryCard } from '../components/home/MemoryCardPrimitives';

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

jest.mock('../hooks/useRelativeTimeNow', () => ({
  useRelativeTimeNow: () => new Date('2026-04-10T04:00:00.000Z'),
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

describe('SharedPostMemoryCard', () => {
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

  it('renders the text card branch and exposes the metadata press action', () => {
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

    const { getByLabelText, getByTestId, getByText } = render(
      <NoteMemoryCard
        note={note}
        colors={colors}
        t={mockT}
        onPress={onPress}
      />
    );

    expect(getByTestId('text-memory-card')).toBeTruthy();
    expect(getByText('District 5')).toBeTruthy();

    fireEvent.press(getByLabelText('Open note details for District 5'));

    expect(onPress).toHaveBeenCalledTimes(1);
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

    fireEvent.press(getByLabelText('Open shared post details for District 3'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
