import React from 'react';
import { render } from '@testing-library/react-native';
import { SharedPostMemoryCard } from '../components/home/MemoryCardPrimitives';

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

jest.mock('../components/ui/InfoPill', () => {
  return function MockInfoPill({ children, style }: any) {
    const React = require('react');
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  };
});

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
        t={(key: string, fallback?: string) => fallback ?? key}
      />
    );

    expect(getByText('2h')).toBeTruthy();
    expect(queryByText(/Apr\s+10/i)).toBeNull();
  });
});
