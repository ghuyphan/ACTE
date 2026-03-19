import React from 'react';
import { act, render } from '@testing-library/react-native';
import { FlatList, Platform, View } from 'react-native';
import NotesFeed from '../components/home/NotesFeed';

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#FFC107',
      text: '#1C1C1E',
    },
  }),
}));

jest.mock('../components/TextMemoryCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockTextMemoryCard() {
    return <View />;
  };
});

jest.mock('../components/ImageMemoryCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockImageMemoryCard() {
    return <View />;
  };
});

describe('NotesFeed capture visibility', () => {
  it('reports visibility continuously during scroll and settles on drag end and momentum end', () => {
    const onCaptureVisibilityChange = jest.fn();

    const { UNSAFE_getByType } = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[]}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        colors={{
          primary: '#FFC107',
          text: '#1C1C1E',
          secondaryText: '#8E8E93',
          danger: '#FF3B30',
          card: '#FFFFFF',
        }}
        t={((key: string, fallback?: string) => fallback ?? key) as any}
        onCaptureVisibilityChange={onCaptureVisibilityChange}
      />
    );

    expect(onCaptureVisibilityChange).toHaveBeenCalledWith(true);

    const list = UNSAFE_getByType(FlatList);

    act(() => {
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 0 },
        },
      });
    });

    expect(onCaptureVisibilityChange).toHaveBeenCalledTimes(1);

    act(() => {
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 90 },
        },
      });
    });

    expect(onCaptureVisibilityChange).toHaveBeenLastCalledWith(false);

    act(() => {
      list.props.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { y: 0 },
          velocity: { y: 0 },
        },
      });
    });

    expect(onCaptureVisibilityChange).toHaveBeenLastCalledWith(true);

    act(() => {
      list.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: { y: 120 },
        },
      });
    });

    expect(onCaptureVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('uses distinct keys for mixed note and shared-post rows', () => {
    const { UNSAFE_getByType } = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[
          {
            id: 'same-id',
            type: 'text',
            content: 'hello',
            locationName: 'Cafe',
            latitude: 0,
            longitude: 0,
            radius: 150,
            isFavorite: false,
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: null,
          },
        ] as any}
        sharedPosts={[
          {
            id: 'same-id',
            authorUid: 'friend-1',
            authorDisplayName: 'Friend',
            authorPhotoURLSnapshot: null,
            audienceUserIds: ['friend-1'],
            type: 'text',
            text: 'shared',
            photoLocalUri: null,
            photoRemoteBase64: null,
            placeName: 'Park',
            sourceNoteId: null,
            createdAt: '2026-03-18T00:00:00.000Z',
            updatedAt: null,
          },
        ] as any}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        colors={{
          primary: '#FFC107',
          text: '#1C1C1E',
          secondaryText: '#8E8E93',
          danger: '#FF3B30',
          card: '#FFFFFF',
        }}
        t={((key: string, fallback?: string) => fallback ?? key) as any}
      />
    );

    const list = UNSAFE_getByType(FlatList);
    const keys = list.props.data.map((item: any) => list.props.keyExtractor(item));

    expect(keys).toEqual(['note:same-id', 'shared-post:same-id']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps clipping disabled for this feed on ios', () => {
    const { UNSAFE_getByType } = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="text"
        notes={[]}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        colors={{
          primary: '#FFC107',
          text: '#1C1C1E',
          secondaryText: '#8E8E93',
          danger: '#FF3B30',
          card: '#FFFFFF',
        }}
        t={((key: string, fallback?: string) => fallback ?? key) as any}
      />
    );

    const list = UNSAFE_getByType(FlatList);

    expect(list.props.removeClippedSubviews).toBe(false);
  });

  it('re-snaps halfway android momentum stops to the nearest interval', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';
    const scrollToOffset = jest.fn();
    const flatListRef = { current: null as any };

    try {
      const { UNSAFE_getByType } = render(
        <NotesFeed
          flatListRef={flatListRef}
          captureHeader={<View testID="capture-header" />}
          captureMode="text"
          notes={[
            {
              id: 'note-1',
              type: 'text',
              content: 'hello',
              locationName: 'Cafe',
              latitude: 0,
              longitude: 0,
              radius: 150,
              isFavorite: false,
              createdAt: '2026-03-19T00:00:00.000Z',
              updatedAt: null,
            },
          ] as any}
          sharedPosts={[]}
          refreshing={false}
          onRefresh={jest.fn()}
          topInset={0}
          snapHeight={700}
          onOpenNote={jest.fn()}
          colors={{
            primary: '#FFC107',
            text: '#1C1C1E',
            secondaryText: '#8E8E93',
            danger: '#FF3B30',
            card: '#FFFFFF',
          }}
          t={((key: string, fallback?: string) => fallback ?? key) as any}
        />
      );

      const list = UNSAFE_getByType(FlatList);
      flatListRef.current = { scrollToOffset };

      act(() => {
        list.props.onMomentumScrollEnd({
          nativeEvent: {
            contentOffset: { y: 350 },
          },
        });
      });

      expect(list.props.disableIntervalMomentum).toBe(true);
      expect(scrollToOffset).toHaveBeenCalledWith({ offset: 700, animated: true });
    } finally {
      Platform.OS = originalPlatform;
    }
  });
});
