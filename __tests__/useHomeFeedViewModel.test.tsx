import { renderHook } from '@testing-library/react-native';
import { useHomeFeedViewModel } from '../hooks/app/useHomeFeedViewModel';

function buildNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Test note',
    locationName: 'District 1',
    latitude: 10.7,
    longitude: 106.6,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-04-14T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  } as any;
}

function buildSharedPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shared-1',
    authorUid: 'friend-1',
    authorDisplayName: 'Lan',
    type: 'text',
    text: 'Shared memory',
    placeName: 'District 5',
    createdAt: '2026-04-14T00:00:00.000Z',
    sourceNoteId: null,
    ...overrides,
  } as any;
}

function createParams(overrides: Partial<Parameters<typeof useHomeFeedViewModel>[0]> = {}) {
  return {
    userUid: 'user-1',
    notes: [],
    notesPhase: 'ready' as const,
    sharedEnabled: true,
    sharedPhase: 'ready' as const,
    sharedPosts: [],
    syncBootstrapState: 'complete' as const,
    isFriendsFilterEnabled: false,
    suppressedHomeNoteIds: [],
    savedNoteRevealNoteId: null,
    markHomeFeedReady: jest.fn(),
    resetHomeFeedReady: jest.fn(),
    ...overrides,
  };
}

describe('useHomeFeedViewModel', () => {
  it('returns the first-note empty mode when the loaded feed has no content', () => {
    const params = createParams();
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('first-note-empty');
    expect(result.current.visibleFeedItems).toEqual([]);
  });

  it('returns the syncing-empty mode while the initial signed-in sync is still running', () => {
    const params = createParams({
      syncBootstrapState: 'syncing',
      sharedPhase: 'cache-ready',
    });
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('syncing-empty');
  });

  it('keeps the signed-in bootstrap state while notes are still hydrating', () => {
    const params = createParams({
      notesPhase: 'bootstrapping',
      syncBootstrapState: 'preparing',
    });
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('syncing-empty');
    expect(result.current.isFeedBootstrapPending).toBe(true);
  });

  it('falls back to the empty state when feed items are hidden but no saved-note reveal is active', () => {
    const note = buildNote();
    const params = createParams({
      notes: [note],
      suppressedHomeNoteIds: [note.id],
    });
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('first-note-empty');
    expect(result.current.visibleFeedItems).toEqual([]);
  });

  it('keeps content mode while the saved-note reveal is intentionally hiding the new note', () => {
    const note = buildNote();
    const params = createParams({
      notes: [note],
      suppressedHomeNoteIds: [note.id],
      savedNoteRevealNoteId: note.id,
    });
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('content');
    expect(result.current.visibleFeedItems).toEqual([]);
  });

  it('treats the friends filter as empty when only your own shared posts exist', () => {
    const params = createParams({
      isFriendsFilterEnabled: true,
      sharedPosts: [
        buildSharedPost({
          id: 'shared-owned',
          authorUid: 'user-1',
          sourceNoteId: 'note-1',
        }),
      ],
      savedNoteRevealNoteId: 'note-1',
    });
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('friends-empty');
    expect(result.current.ownedSharedNoteIds).toEqual(['note-1']);
    expect(result.current.savedNoteRevealIsSharedByMe).toBe(true);
  });

  it('returns the blocked bootstrap mode when first cloud load is offline', () => {
    const params = createParams({
      syncBootstrapState: 'offline',
    });
    const { result } = renderHook(() => useHomeFeedViewModel(params));

    expect(result.current.feedMode).toBe('bootstrap-blocked-empty');
    expect(result.current.bootstrapState).toBe('offline');
    expect(result.current.isFeedBootstrapPending).toBe(false);
  });
});
