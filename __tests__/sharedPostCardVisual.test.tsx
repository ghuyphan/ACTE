import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#FFFFFF',
      border: '#E5E5EA',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
    },
  }),
}));

jest.mock('../services/remoteMedia', () => ({
  SHARED_POST_MEDIA_BUCKET: 'shared-posts',
}));

jest.mock('../components/notes/ImageMemoryCard', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return function MockImageMemoryCard({ isActive }: { isActive?: boolean }) {
    return (
      <View testID="shared-post-image-card">
        <Text testID="shared-post-image-card-active">{String(Boolean(isActive))}</Text>
      </View>
    );
  };
});

jest.mock('../components/notes/TextMemoryCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockTextMemoryCard({ text, isActive }: { text: string; isActive?: boolean }) {
    return <Text>{`${text}:${String(Boolean(isActive))}`}</Text>;
  };
});

import SharedPostCardVisual from '../components/home/SharedPostCardVisual';

describe('SharedPostCardVisual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a placeholder while a photo post has no hydrated local media uri', () => {
    const { queryByText, getByTestId, queryByTestId } = render(
      <SharedPostCardVisual
        post={{
          id: 'shared-photo-1',
          authorUid: 'friend-1',
          authorDisplayName: 'Lan',
          authorPhotoURLSnapshot: null,
          audienceUserIds: [],
          type: 'photo',
          text: 'This should not flash',
          photoPath: 'friend-1/shared-photo-1.jpg',
          photoLocalUri: null,
          doodleStrokesJson: null,
          placeName: 'District 1',
          sourceNoteId: null,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: null,
        }}
        fallbackText="Photo memory"
      />
    );

    expect(getByTestId('shared-post-photo-placeholder')).toBeTruthy();
    expect(queryByText('This should not flash')).toBeNull();
    expect(queryByText('Photo memory')).toBeNull();
    expect(queryByTestId('shared-post-image-card')).toBeNull();
  });

  it('renders the shared image card when the post already has a local media uri', () => {
    const { getByTestId } = render(
      <SharedPostCardVisual
        post={{
          id: 'shared-photo-1',
          authorUid: 'friend-1',
          authorDisplayName: 'Lan',
          authorPhotoURLSnapshot: null,
          audienceUserIds: [],
          type: 'photo',
          text: '',
          photoPath: 'friend-1/shared-photo-1.jpg',
          photoLocalUri: 'file:///shared-photo-1.jpg',
          doodleStrokesJson: null,
          placeName: 'District 1',
          sourceNoteId: null,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: null,
        }}
        fallbackText="Photo memory"
        isActive
      />
    );

    expect(getByTestId('shared-post-image-card')).toBeTruthy();
    expect(getByTestId('shared-post-image-card-active')).toHaveTextContent('true');
  });

  it('renders the image once the parent rerenders with a hydrated local media uri', () => {
    const post = {
      id: 'shared-photo-1',
      authorUid: 'friend-1',
      authorDisplayName: 'Lan',
      authorPhotoURLSnapshot: null,
      audienceUserIds: [],
      type: 'photo' as const,
      text: 'Shared memory',
      photoPath: 'friend-1/shared-photo-1.jpg',
      photoLocalUri: null,
      doodleStrokesJson: null,
      placeName: 'District 1',
      sourceNoteId: null,
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: null,
    };

    const { getByTestId, queryByTestId, rerender } = render(
      <SharedPostCardVisual post={post} fallbackText="Photo memory" />
    );

    expect(getByTestId('shared-post-photo-placeholder')).toBeTruthy();

    rerender(
      <SharedPostCardVisual
        post={{
          ...post,
          photoLocalUri: 'file:///shared-photo-1.jpg',
        }}
        fallbackText="Photo memory"
      />
    );

    expect(getByTestId('shared-post-image-card')).toBeTruthy();
    expect(queryByTestId('shared-post-photo-placeholder')).toBeNull();
  });

  it('does not inject the photo fallback label into sticker-only text posts', () => {
    const { queryByText } = render(
      <SharedPostCardVisual
        post={{
          id: 'shared-sticker-1',
          authorUid: 'friend-1',
          authorDisplayName: 'Lan',
          authorPhotoURLSnapshot: null,
          audienceUserIds: [],
          type: 'text',
          text: '',
          photoPath: null,
          photoLocalUri: null,
          doodleStrokesJson: null,
          hasStickers: true,
          stickerPlacementsJson: JSON.stringify([
            {
              id: 'sticker-1',
              assetId: 'asset-1',
              center: { x: 0.5, y: 0.5 },
              scale: 1,
              rotation: 0,
              zIndex: 1,
            },
          ]),
          placeName: 'District 1',
          sourceNoteId: null,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: null,
        }}
        fallbackText="Photo memory"
      />
    );

    expect(queryByText('Photo memory')).toBeNull();
  });

  it('uses a generic fallback for empty non-photo shared notes', () => {
    const { getByText, queryByText } = render(
      <SharedPostCardVisual
        post={{
          id: 'shared-empty-1',
          authorUid: 'friend-1',
          authorDisplayName: 'Lan',
          authorPhotoURLSnapshot: null,
          audienceUserIds: [],
          type: 'text',
          text: '',
          photoPath: null,
          photoLocalUri: null,
          doodleStrokesJson: null,
          hasStickers: false,
          stickerPlacementsJson: null,
          placeName: 'District 1',
          sourceNoteId: null,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: null,
        }}
        fallbackText="Shared note"
      />
    );

    expect(getByText('Shared note:false')).toBeTruthy();
    expect(queryByText('Photo memory')).toBeNull();
  });
});
