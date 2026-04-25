import { act, renderHook } from '@testing-library/react-native';
import { useStableHomeSharedFeedSnapshot } from '../hooks/app/useStableHomeSharedFeedSnapshot';

function buildSharedPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shared-1',
    authorUid: 'friend-1',
    authorDisplayName: 'Lan',
    authorPhotoURLSnapshot: null,
    audienceUserIds: ['user-1', 'friend-1'],
    type: 'text',
    text: 'Shared memory',
    photoPath: null,
    photoLocalUri: null,
    captureVariant: null,
    dualPrimaryPhotoPath: null,
    dualSecondaryPhotoPath: null,
    dualPrimaryPhotoLocalUri: null,
    dualSecondaryPhotoLocalUri: null,
    isLivePhoto: false,
    pairedVideoPath: null,
    pairedVideoLocalUri: null,
    doodleStrokesJson: null,
    hasStickers: false,
    stickerPlacementsJson: null,
    noteColor: null,
    placeName: 'District 1',
    sourceNoteId: null,
    latitude: 10.77,
    longitude: 106.69,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  } as any;
}

function createParams(overrides: Partial<Parameters<typeof useStableHomeSharedFeedSnapshot>[0]> = {}) {
  return {
    userUid: 'user-1',
    notesPhase: 'hydrating' as const,
    sharedEnabled: true,
    sharedPhase: 'cache-ready' as const,
    sharedPosts: [buildSharedPost()],
    startupInteractive: false,
    presentationScope: 'all',
    ...overrides,
  };
}

describe('useStableHomeSharedFeedSnapshot', () => {
  it('freezes the initial shared snapshot once the home snapshot is ready', () => {
    const initialPost = buildSharedPost({ id: 'shared-1', text: 'Cached post' });
    const livePost = buildSharedPost({ id: 'shared-2', text: 'Live post' });
    const { result, rerender } = renderHook(
      (params: ReturnType<typeof createParams>) => useStableHomeSharedFeedSnapshot(params),
      {
        initialProps: createParams({
          sharedPosts: [initialPost],
        }),
      }
    );

    expect(result.current.presentedSharedPosts).toEqual([initialPost]);

    rerender(createParams({
      sharedPosts: [livePost, initialPost],
      startupInteractive: true,
    }));

    expect(result.current.presentedSharedPosts).toEqual([initialPost]);
    expect(result.current.pendingSharedPosts).toEqual([livePost, initialPost]);
    expect(result.current.hasPendingSharedUpdates).toBe(true);
  });

  it('promotes pending shared updates only when requested', () => {
    const initialPost = buildSharedPost({ id: 'shared-1', text: 'Cached post' });
    const livePost = buildSharedPost({ id: 'shared-2', text: 'Live post' });
    const { result, rerender } = renderHook(
      (params: ReturnType<typeof createParams>) => useStableHomeSharedFeedSnapshot(params),
      {
        initialProps: createParams({
          sharedPosts: [initialPost],
        }),
      }
    );

    rerender(createParams({
      sharedPosts: [livePost, initialPost],
      startupInteractive: true,
    }));

    act(() => {
      result.current.requestPromoteSharedPosts();
    });

    expect(result.current.presentedSharedPosts).toEqual([livePost, initialPost]);
    expect(result.current.pendingSharedPosts).toBeNull();
    expect(result.current.hasPendingSharedUpdates).toBe(false);
  });

  it('resets the presented snapshot when the presentation scope changes', () => {
    const initialPost = buildSharedPost({ id: 'shared-1', text: 'Cached post' });
    const livePost = buildSharedPost({ id: 'shared-2', text: 'Live post' });
    const { result, rerender } = renderHook(
      (params: ReturnType<typeof createParams>) => useStableHomeSharedFeedSnapshot(params),
      {
        initialProps: createParams({
          sharedPosts: [initialPost],
          startupInteractive: true,
        }),
      }
    );

    rerender(createParams({
      sharedPosts: [livePost, initialPost],
      startupInteractive: true,
    }));

    expect(result.current.presentedSharedPosts).toEqual([initialPost]);

    rerender(createParams({
      sharedPosts: [livePost, initialPost],
      startupInteractive: true,
      presentationScope: 'friends',
    }));

    expect(result.current.presentedSharedPosts).toEqual([livePost, initialPost]);
    expect(result.current.pendingSharedPosts).toBeNull();
  });
});
