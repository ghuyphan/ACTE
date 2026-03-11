import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Region } from 'react-native-maps';
import type { Note } from '../services/database';
import { useMapScreenState } from '../hooks/map/useMapScreenState';

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: overrides.id ?? `note-${Date.now()}`,
    type: overrides.type ?? 'text',
    content: overrides.content ?? 'content',
    locationName: overrides.locationName ?? 'Spot',
    latitude: overrides.latitude ?? 10.76,
    longitude: overrides.longitude ?? 106.66,
    radius: overrides.radius ?? 150,
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? '2026-03-11T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? null,
  };
}

describe('useMapScreenState', () => {
  it('clears selected marker group when filters remove it', async () => {
    const notes = [
      makeNote({ id: 'text-1', type: 'text', latitude: 10.76, longitude: 106.66 }),
      makeNote({ id: 'photo-1', type: 'photo', latitude: 10.8, longitude: 106.7 }),
    ];

    const { result } = renderHook(() =>
      useMapScreenState({
        notes,
        location: null,
      })
    );

    const textGroup = Array.from(result.current.pointGroupMap.values()).find((group) =>
      group.notes.some((note) => note.id === 'text-1')
    );

    expect(textGroup).toBeTruthy();

    act(() => {
      result.current.handleLeafMarkerPress(textGroup!.id);
    });

    expect(result.current.selectedNote?.id).toBe('text-1');

    act(() => {
      result.current.setFilterType('photo');
    });

    await waitFor(() => {
      expect(result.current.selectedNote).toBeNull();
      expect(result.current.selectedGroup).toBeNull();
    });
  });

  it('updates nearby rail candidates when viewport changes', async () => {
    const notes = [
      makeNote({ id: 'near', latitude: 10.7601, longitude: 106.6601 }),
      makeNote({ id: 'far', latitude: 11.0, longitude: 107.0 }),
    ];

    const { result } = renderHook(() =>
      useMapScreenState({
        notes,
        location: null,
      })
    );

    const nearRegion: Region = {
      latitude: 10.7601,
      longitude: 106.6601,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    act(() => {
      result.current.setVisibleRegion(nearRegion);
    });

    await waitFor(() => {
      expect(result.current.nearbyItems[0]?.note.id).toBe('near');
      expect(result.current.nearbyItems.some((item) => item.note.id === 'far')).toBe(false);
    });

    const farRegion: Region = {
      latitude: 11.0,
      longitude: 107.0,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    act(() => {
      result.current.setVisibleRegion(farRegion);
    });

    await waitFor(() => {
      expect(result.current.nearbyItems[0]?.note.id).toBe('far');
      expect(result.current.nearbyItems.some((item) => item.note.id === 'near')).toBe(false);
    });
  });
});
