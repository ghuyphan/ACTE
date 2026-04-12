import React from 'react';
import { act, render } from '@testing-library/react-native';
import { FlatList, Platform, Text, View } from 'react-native';
import NotesFeed from '../components/home/NotesFeed';

const mockTextMemoryCard = jest.fn(
  ({
    text,
    noteColor,
    doodleStrokesJson,
    stickerPlacementsJson,
    isActive,
  }: {
    text: string;
    noteColor?: string | null;
    doodleStrokesJson?: string | null;
    stickerPlacementsJson?: string | null;
    isActive?: boolean;
  }) => (
    <View>
      <Text testID="mock-text-memory-card-text">{text}</Text>
      <Text testID="mock-text-memory-card-color">{noteColor ?? 'null'}</Text>
      <Text testID="mock-text-memory-card-doodle">{doodleStrokesJson ?? 'null'}</Text>
      <Text testID="mock-text-memory-card-stickers">{stickerPlacementsJson ?? 'null'}</Text>
      <Text testID="mock-text-memory-card-active">{String(Boolean(isActive))}</Text>
    </View>
  )
);

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#FFC107',
      text: '#1C1C1E',
    },
  }),
}));

jest.mock('../components/notes/TextMemoryCard', () => {
  const React = require('react');
  return function MockTextMemoryCard(props: any) {
    return mockTextMemoryCard(props);
  };
});

jest.mock('../components/notes/ImageMemoryCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockImageMemoryCard() {
    return <View />;
  };
});

beforeEach(() => {
  mockTextMemoryCard.mockClear();
});

describe('NotesFeed capture visibility', () => {
  it('marks only the settled centered card as active', () => {
    const view = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[
          {
            id: 'note-1',
            type: 'text',
            content: 'first',
            locationName: 'Cafe',
            latitude: 0,
            longitude: 0,
            radius: 150,
            isFavorite: false,
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: null,
          },
          {
            id: 'note-2',
            type: 'text',
            content: 'second',
            locationName: 'Park',
            latitude: 0,
            longitude: 0,
            radius: 150,
            isFavorite: false,
            createdAt: '2026-03-18T00:00:00.000Z',
            updatedAt: null,
          },
        ] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    const list = view.UNSAFE_getByType(FlatList);

    act(() => {
      list.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            y: 700,
          },
        },
      });
    });

    let activeLabels = view.getAllByTestId('mock-text-memory-card-active');
    expect(activeLabels[0]).toHaveTextContent('true');
    expect(activeLabels[1]).toHaveTextContent('false');

    act(() => {
      list.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            y: 1400,
          },
        },
      });
    });

    activeLabels = view.getAllByTestId('mock-text-memory-card-active');
    expect(activeLabels[0]).toHaveTextContent('false');
    expect(activeLabels[1]).toHaveTextContent('true');
  });

  it('stops card physics activity when the parent screen is not focused', () => {
    const view = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        screenActive
        notes={[
          {
            id: 'note-1',
            type: 'text',
            content: 'first',
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
        onOpenSharedPost={jest.fn()}
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

    const list = view.UNSAFE_getByType(FlatList);

    act(() => {
      list.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            y: 700,
          },
        },
      });
    });

    expect(view.getByTestId('mock-text-memory-card-active')).toHaveTextContent('true');

    view.rerender(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        screenActive={false}
        notes={[
          {
            id: 'note-1',
            type: 'text',
            content: 'first',
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
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-active')).toHaveTextContent('false');
  });

  it('re-renders a note card when only doodle strokes change', () => {
    const baseNote = {
      id: 'note-1',
      type: 'text',
      content: 'hello',
      locationName: 'Cafe',
      latitude: 0,
      longitude: 0,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: null,
    };

    const view = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[baseNote] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-doodle')).toHaveTextContent(
      JSON.stringify([{ color: '#FFF', points: [0.1, 0.1, 0.2, 0.2] }])
    );

    view.rerender(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[
          {
            ...baseNote,
            doodleStrokesJson: JSON.stringify([{ color: '#FFF', points: [0.3, 0.3, 0.4, 0.4] }]),
          },
        ] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-doodle')).toHaveTextContent(
      JSON.stringify([{ color: '#FFF', points: [0.3, 0.3, 0.4, 0.4] }])
    );
  });

  it('re-renders a note card when only sticker placements change', () => {
    const baseNote = {
      id: 'note-1',
      type: 'text',
      content: 'hello',
      locationName: 'Cafe',
      latitude: 0,
      longitude: 0,
      radius: 150,
      isFavorite: false,
      hasStickers: true,
      stickerPlacementsJson: JSON.stringify([
        { id: 'sticker-1', assetId: 'asset-1', center: { x: 0.3, y: 0.3 }, scale: 1, rotation: 0, zIndex: 1 },
      ]),
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: null,
    };

    const view = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[baseNote] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-stickers')).toHaveTextContent(
      JSON.stringify([
        { id: 'sticker-1', assetId: 'asset-1', center: { x: 0.3, y: 0.3 }, scale: 1, rotation: 0, zIndex: 1 },
      ])
    );

    view.rerender(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[
          {
            ...baseNote,
            stickerPlacementsJson: JSON.stringify([
              { id: 'sticker-1', assetId: 'asset-1', center: { x: 0.5, y: 0.5 }, scale: 1.2, rotation: 12, zIndex: 1 },
            ]),
          },
        ] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-stickers')).toHaveTextContent(
      JSON.stringify([
        { id: 'sticker-1', assetId: 'asset-1', center: { x: 0.5, y: 0.5 }, scale: 1.2, rotation: 12, zIndex: 1 },
      ])
    );
  });

  it('re-renders a note card when only note color changes', () => {
    const baseNote = {
      id: 'note-1',
      type: 'text',
      content: 'hello',
      noteColor: 'marigold-glow',
      locationName: 'Cafe',
      latitude: 0,
      longitude: 0,
      radius: 150,
      isFavorite: false,
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: null,
    };

    const view = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[baseNote] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-color')).toHaveTextContent('marigold-glow');

    view.rerender(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[
          {
            ...baseNote,
            noteColor: 'jade-pop',
          },
        ] as any}
        sharedPosts={[]}
        refreshing={false}
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(view.getByTestId('mock-text-memory-card-color')).toHaveTextContent('jade-pop');
  });

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
        onOpenSharedPost={jest.fn()}
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
        onOpenSharedPost={jest.fn()}
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

  it('uses content-aware item types for recycler reuse', () => {
    const { UNSAFE_getByType } = render(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="camera"
        notes={[
          {
            id: 'note-photo',
            type: 'photo',
            caption: 'Photo',
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
            id: 'shared-text',
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
        onOpenSharedPost={jest.fn()}
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
    const types = list.props.data.map((item: any, index: number) => list.props.getItemType(item, index));

    expect(types).toEqual(['note:photo', 'shared-post:text']);
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
        onOpenSharedPost={jest.fn()}
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

  it('disables automatic visible-position maintenance for the snap feed', () => {
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
        onOpenSharedPost={jest.fn()}
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

    expect(list.props.maintainVisibleContentPosition).toEqual({ disabled: true });
  });

  it('pins the header and item layout to the snap height', () => {
    const { UNSAFE_getByType } = render(
      <NotesFeed
        flatListRef={{ current: null }}
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
        onOpenSharedPost={jest.fn()}
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
    const layout: { size?: number } = {};

    list.props.overrideItemLayout(layout, list.props.data[0], 0, 1);

    expect(list.props.ListHeaderComponentStyle).toEqual({ height: 700 });
    expect(layout.size).toBe(700);
  });

  it('suspends snapping while a top refresh pull is active', () => {
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
        onOpenSharedPost={jest.fn()}
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

    const getList = () => UNSAFE_getByType(FlatList);

    expect(getList().props.pagingEnabled).toBe(true);

    act(() => {
      getList().props.onScroll({
        nativeEvent: {
          contentOffset: { y: -24 },
        },
      });
    });

    expect(getList().props.pagingEnabled).toBe(false);
    expect(getList().props.decelerationRate).toBe('normal');

    act(() => {
      getList().props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: { y: 0 },
        },
      });
    });

    expect(getList().props.pagingEnabled).toBe(true);
    expect(getList().props.decelerationRate).toBe('fast');
  });

  it('resumes snapping after a refresh pull settles back into feed content', () => {
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
        onOpenSharedPost={jest.fn()}
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

    const getList = () => UNSAFE_getByType(FlatList);

    act(() => {
      getList().props.onScroll({
        nativeEvent: {
          contentOffset: { y: -24 },
        },
      });
    });

    expect(getList().props.pagingEnabled).toBe(false);

    act(() => {
      getList().props.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { y: 350 },
          velocity: { y: 0.01 },
        },
      });
    });

    expect(getList().props.pagingEnabled).toBe(true);
    expect(getList().props.decelerationRate).toBe('fast');
  });

  it('keeps snapping enabled while refresh is active after the pull has settled', () => {
    const { UNSAFE_getByType, rerender } = render(
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
        onOpenSharedPost={jest.fn()}
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

    rerender(
      <NotesFeed
        flatListRef={{ current: null }}
        captureHeader={<View testID="capture-header" />}
        captureMode="text"
        notes={[]}
        sharedPosts={[]}
        refreshing
        onRefresh={jest.fn()}
        topInset={0}
        snapHeight={700}
        onOpenNote={jest.fn()}
        onOpenSharedPost={jest.fn()}
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

    expect(list.props.pagingEnabled).toBe(true);
    expect(list.props.decelerationRate).toBe('fast');
  });

  it('uses native paging without extra trailing feed padding', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const { UNSAFE_getByType } = render(
        <NotesFeed
          flatListRef={{ current: null }}
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
          onOpenSharedPost={jest.fn()}
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

      expect(list.props.pagingEnabled).toBe(true);
      expect(list.props.contentContainerStyle).toBeUndefined();
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('keeps the capture page sticky on a gentle top drag', () => {
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
          onOpenSharedPost={jest.fn()}
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
        list.props.onScrollBeginDrag();
      });

      act(() => {
        list.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { y: 350 },
            velocity: { y: 0.01 },
          },
        });
      });

      expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('allows leaving the capture page after a stronger drag', () => {
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
          onOpenSharedPost={jest.fn()}
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
        list.props.onScrollBeginDrag();
      });

      act(() => {
        list.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { y: 520 },
            velocity: { y: 0.01 },
          },
        });
      });

      expect(scrollToOffset).not.toHaveBeenCalled();
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('does not force the first note back to capture on a gentle downward drag', () => {
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
          onOpenSharedPost={jest.fn()}
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
            contentOffset: { y: 700 },
          },
        });
      });

      scrollToOffset.mockClear();

      act(() => {
        list.props.onScrollBeginDrag();
      });

      act(() => {
        list.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { y: 350 },
            velocity: { y: 0.01 },
          },
        });
      });

      expect(scrollToOffset).not.toHaveBeenCalled();
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('re-snaps android after a note is removed while the list is between snap points', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';
    const scrollToOffset = jest.fn();
    const flatListRef = { current: null as any };

    try {
      const initialNotes = [
        {
          id: 'note-1',
          type: 'text',
          content: 'first',
          locationName: 'Cafe',
          latitude: 0,
          longitude: 0,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-19T00:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'note-2',
          type: 'text',
          content: 'second',
          locationName: 'Park',
          latitude: 0,
          longitude: 0,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-18T00:00:00.000Z',
          updatedAt: null,
        },
      ];

      const { UNSAFE_getByType, rerender } = render(
        <NotesFeed
          flatListRef={flatListRef}
          captureHeader={<View testID="capture-header" />}
          captureMode="text"
          notes={initialNotes as any}
          sharedPosts={[]}
          refreshing={false}
          onRefresh={jest.fn()}
          topInset={0}
          snapHeight={700}
          onOpenNote={jest.fn()}
          onOpenSharedPost={jest.fn()}
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
        list.props.onScroll({
          nativeEvent: {
            contentOffset: { y: 1050 },
          },
        });
      });

      scrollToOffset.mockClear();

      act(() => {
        rerender(
          <NotesFeed
            flatListRef={flatListRef}
            captureHeader={<View testID="capture-header" />}
            captureMode="text"
            notes={[initialNotes[0]] as any}
            sharedPosts={[]}
            refreshing={false}
            onRefresh={jest.fn()}
            topInset={0}
            snapHeight={700}
            onOpenNote={jest.fn()}
            onOpenSharedPost={jest.fn()}
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
      });

      expect(scrollToOffset).toHaveBeenCalledWith({ offset: 700, animated: false });
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('does not add a manual last-page correction during drag end', () => {
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
          onOpenSharedPost={jest.fn()}
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
        list.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: { y: 760 },
            velocity: { y: 0.01 },
          },
        });
      });

      expect(scrollToOffset).not.toHaveBeenCalled();
    } finally {
      Platform.OS = originalPlatform;
    }
  });

});
