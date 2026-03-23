import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockDownloadPhotoFromStorage = jest.fn();

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
  downloadPhotoFromStorage: (...args: unknown[]) => mockDownloadPhotoFromStorage(...args),
}));

jest.mock('../components/ImageMemoryCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockImageMemoryCard() {
    return <View testID="shared-post-image-card" />;
  };
});

jest.mock('../components/TextMemoryCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockTextMemoryCard({ text }: { text: string }) {
    return <Text>{text}</Text>;
  };
});

import SharedPostCardVisual from '../components/home/SharedPostCardVisual';

describe('SharedPostCardVisual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps photo posts on a photo placeholder until the image hydrates', async () => {
    let resolvePhoto: ((value: string | null) => void) | null = null;
    mockDownloadPhotoFromStorage.mockImplementation(() => new Promise((resolve) => {
      resolvePhoto = resolve;
    }));

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

    await act(async () => {
      resolvePhoto?.('file:///shared-photo-1.jpg');
    });

    await waitFor(() => {
      expect(queryByTestId('shared-post-photo-placeholder')).toBeNull();
      expect(getByTestId('shared-post-image-card')).toBeTruthy();
    });
  });
});
