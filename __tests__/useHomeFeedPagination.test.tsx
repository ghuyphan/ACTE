import { renderHook } from '@testing-library/react-native';
import { useHomeFeedPagination } from '../hooks/app/useHomeFeedPagination';
import type { Note } from '../services/database';
import type { SharedPost } from '../services/sharedFeedService';

describe('useHomeFeedPagination', () => {
  it('builds the feed synchronously from loaded notes and friend posts', async () => {
    const notes: Note[] = [
      {
        id: 'note-1',
        type: 'text',
        content: 'Newest local note',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        createdAt: '2026-04-10T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'note-2',
        type: 'text',
        content: 'Older local note',
        locationName: 'District 3',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: null,
      },
    ];
    const sharedPosts: SharedPost[] = [
      {
        id: 'shared-owned',
        authorUid: 'me',
        authorDisplayName: 'You',
        authorPhotoURLSnapshot: null,
        audienceUserIds: [],
        type: 'text',
        text: 'Owned shared note',
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
        pairedVideoPath: null,
        pairedVideoLocalUri: null,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        noteColor: null,
        placeName: 'District 2',
        sourceNoteId: null,
        latitude: null,
        longitude: null,
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'shared-friend-1',
        authorUid: 'friend-1',
        authorDisplayName: 'Lan',
        authorPhotoURLSnapshot: null,
        audienceUserIds: [],
        type: 'text',
        text: 'Newest friend memory',
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
        pairedVideoPath: null,
        pairedVideoLocalUri: null,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        noteColor: null,
        placeName: 'District 5',
        sourceNoteId: null,
        latitude: null,
        longitude: null,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'shared-friend-2',
        authorUid: 'friend-2',
        authorDisplayName: 'Minh',
        authorPhotoURLSnapshot: null,
        audienceUserIds: [],
        type: 'text',
        text: 'Older friend memory',
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
        pairedVideoPath: null,
        pairedVideoLocalUri: null,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        noteColor: null,
        placeName: 'District 7',
        sourceNoteId: null,
        latitude: null,
        longitude: null,
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: null,
      },
    ];

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: 'me',
        notesSignal: notes,
        sharedSignal: sharedPosts,
      })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.items.map((item) => `${item.kind}:${item.id}`)).toEqual([
      'note:note-1',
      'shared-post:shared-friend-1',
      'note:note-2',
      'shared-post:shared-friend-2',
    ]);
  });

  it('returns the target index immediately when the full note set is already loaded', async () => {
    const notes: Note[] = Array.from({ length: 30 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text' as const,
      content: `Note ${index + 1}`,
      locationName: `Place ${index + 1}`,
      latitude: 10 + index,
      longitude: 106 + index,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: new Date(Date.UTC(2026, 3, 30 - index)).toISOString(),
      updatedAt: null,
    }));

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: null,
        notesSignal: notes,
        sharedSignal: [],
      })
    );

    await expect(
      result.current.ensureTargetLoaded({
        kind: 'note',
        id: 'note-30',
      })
    ).resolves.toBe(29);

    await expect(result.current.loadNextPage()).resolves.toEqual(result.current.items);
  });
});
