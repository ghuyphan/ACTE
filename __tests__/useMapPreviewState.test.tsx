import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { NearbyNoteItem } from '../hooks/map/mapDomain';
import { useMapPreviewState } from '../hooks/map/useMapPreviewState';
import type { Note } from '../services/database';

function makePreviewItem(id: string, content: string): NearbyNoteItem {
  const note: Note = {
    id,
    type: 'text',
    content,
    locationName: 'District 1',
    latitude: 10.76,
    longitude: 106.66,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: null,
  };

  return {
    note,
    distanceMeters: id === 'near' ? 12 : 50,
    latitude: note.latitude,
    longitude: note.longitude,
  };
}

describe('useMapPreviewState', () => {
  it('refreshes preview item details without reordering stable nearby notes', async () => {
    const firstItems = [
      makePreviewItem('near', 'Original text'),
      makePreviewItem('farther', 'Second text'),
    ];
    const { result, rerender } = renderHook(
      ({ nearbyItems }: { nearbyItems: NearbyNoteItem[] }) =>
        useMapPreviewState({ nearbyItems, friendPosts: [] }),
      {
        initialProps: { nearbyItems: firstItems },
      }
    );

    expect(result.current.nearbyPreviewItems.map((item) => item.note.id)).toEqual(['near', 'farther']);

    rerender({
      nearbyItems: [
        makePreviewItem('farther', 'Second text'),
        makePreviewItem('near', 'Updated text'),
      ],
    });

    await waitFor(() => {
      expect(result.current.nearbyPreviewItems.map((item) => item.note.id)).toEqual(['near', 'farther']);
      expect(result.current.nearbyPreviewItems[0]?.note.content).toBe('Updated text');
    });
  });

  it('drops pinned preview items that no longer exist in the valid note set', async () => {
    const firstItems = [
      makePreviewItem('near', 'Original text'),
      makePreviewItem('farther', 'Second text'),
    ];
    const { result, rerender } = renderHook(
      ({
        nearbyItems,
        validNoteIds,
      }: {
        nearbyItems: NearbyNoteItem[];
        validNoteIds: ReadonlySet<string>;
      }) => useMapPreviewState({ nearbyItems, friendPosts: [], validNoteIds }),
      {
        initialProps: {
          nearbyItems: firstItems,
          validNoteIds: new Set(['near', 'farther']),
        },
      }
    );

    act(() => {
      result.current.focusNearbyPreview(firstItems, 'near');
    });

    rerender({
      nearbyItems: [],
      validNoteIds: new Set(['farther']),
    });

    await waitFor(() => {
      expect(result.current.nearbyPreviewItems.map((item) => item.note.id)).toEqual(['farther']);
      expect(result.current.activeNearbyNoteId).toBe('farther');
    });
  });
});
