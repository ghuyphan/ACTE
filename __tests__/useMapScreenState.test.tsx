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
    });
  });

  it('clears selection instead of jumping to another note when the selected note is deleted', async () => {
    const initialNotes = [
      makeNote({ id: 'same-1', latitude: 10.76, longitude: 106.66, createdAt: '2026-03-12T00:00:00.000Z' }),
      makeNote({ id: 'same-2', latitude: 10.76, longitude: 106.66, createdAt: '2026-03-11T00:00:00.000Z' }),
    ];

    const { result, rerender } = renderHook<
      ReturnType<typeof useMapScreenState>,
      { notes: Note[] }
    >(
      ({ notes }) =>
        useMapScreenState({
          notes,
          location: null,
        }),
      {
        initialProps: {
          notes: initialNotes,
        },
      }
    );

    act(() => {
      result.current.selectNoteById('same-2');
    });

    expect(result.current.selectedNote?.id).toBe('same-2');

    rerender({
      notes: [
        makeNote({ id: 'same-1', latitude: 10.76, longitude: 106.66, createdAt: '2026-03-12T00:00:00.000Z' }),
      ],
    });

    await waitFor(() => {
      expect(result.current.selectedNote).toBeNull();
      expect(result.current.selectedGroup).toBeNull();
      expect(result.current.selectedGroupId).toBeNull();
    });
  });

  it('uses the map center instead of device location when the viewport changes', async () => {
    const notes = [
      makeNote({ id: 'near-location', latitude: 10.7601, longitude: 106.6601 }),
      makeNote({ id: 'near-map-center', latitude: 11.0, longitude: 107.0 }),
    ];

    const { result } = renderHook(() =>
      useMapScreenState({
        notes,
        location: {
          coords: {
            latitude: 10.7605,
            longitude: 106.6605,
            accuracy: 1,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as any,
      })
    );

    act(() => {
      result.current.setVisibleRegion({
        latitude: 11.0,
        longitude: 107.0,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    });

    await waitFor(() => {
      expect(result.current.nearbyItems[0]?.note.id).toBe('near-map-center');
    });
  });

  it('ignores only the first quick map press after a marker tap', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

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

    const nearGroup = Array.from(result.current.pointGroupMap.values()).find((group) =>
      group.notes.some((note) => note.id === 'near')
    );

    expect(nearGroup).toBeTruthy();

    act(() => {
      result.current.handleLeafMarkerPress(nearGroup!.id);
    });

    expect(result.current.selectedGroupId).toBe(nearGroup!.id);

    now = 1100;
    act(() => {
      result.current.handleMapPress();
    });

    expect(result.current.selectedGroupId).toBe(nearGroup!.id);

    now = 1400;
    act(() => {
      result.current.handleMapPress();
    });

    expect(result.current.selectedGroupId).toBeNull();

    nowSpy.mockRestore();
  });
});
