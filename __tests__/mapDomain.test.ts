import type { Region } from 'react-native-maps';
import type { Note } from '../services/database';
import {
  applyMapFilters,
  buildClusterIndex,
  buildMapPointGroups,
  getMapClusterNodes,
  getNearbyNoteItems,
  getPointGroupMap,
} from '../hooks/map/mapDomain';

function makeNote(overrides: Partial<Note>): Note {
  const now = new Date('2026-03-11T00:00:00.000Z').toISOString();
  return {
    id: overrides.id ?? `note-${Math.random()}`,
    type: overrides.type ?? 'text',
    content: overrides.content ?? 'note content',
    locationName: overrides.locationName ?? 'Somewhere',
    latitude: overrides.latitude ?? 10.77,
    longitude: overrides.longitude ?? 106.67,
    radius: overrides.radius ?? 150,
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? null,
  };
}

describe('mapDomain', () => {
  it('applies type + favorite filters deterministically', () => {
    const notes = [
      makeNote({ id: '1', type: 'text', isFavorite: true }),
      makeNote({ id: '2', type: 'photo', isFavorite: false }),
      makeNote({ id: '3', type: 'photo', isFavorite: true }),
    ];

    expect(applyMapFilters(notes, { type: 'all', favoritesOnly: false }).map((n) => n.id)).toEqual(['1', '2', '3']);
    expect(applyMapFilters(notes, { type: 'text', favoritesOnly: false }).map((n) => n.id)).toEqual(['1']);
    expect(applyMapFilters(notes, { type: 'photo', favoritesOnly: false }).map((n) => n.id)).toEqual(['2', '3']);
    expect(applyMapFilters(notes, { type: 'photo', favoritesOnly: true }).map((n) => n.id)).toEqual(['3']);
  });

  it('changes clustering output by zoom level', () => {
    const notes = [
      makeNote({ id: '1', latitude: 10.68, longitude: 106.58 }),
      makeNote({ id: '2', latitude: 10.74, longitude: 106.64 }),
      makeNote({ id: '3', latitude: 10.80, longitude: 106.70 }),
      makeNote({ id: '4', latitude: 10.86, longitude: 106.76 }),
    ];

    const groups = buildMapPointGroups(notes);
    const groupMap = getPointGroupMap(groups);
    const index = buildClusterIndex(groups);

    expect(index).toBeTruthy();

    const lowZoomRegion: Region = {
      latitude: 10.77,
      longitude: 106.67,
      latitudeDelta: 20,
      longitudeDelta: 20,
    };
    const highZoomRegion: Region = {
      latitude: 10.77,
      longitude: 106.67,
      latitudeDelta: 0.25,
      longitudeDelta: 0.25,
    };

    const lowZoomNodes = getMapClusterNodes(index, lowZoomRegion, groupMap);
    const highZoomNodes = getMapClusterNodes(index, highZoomRegion, groupMap);

    expect(lowZoomNodes.some((node) => node.isCluster)).toBe(true);
    expect(highZoomNodes.length).toBeGreaterThan(lowZoomNodes.length);
    expect(highZoomNodes.some((node) => !node.isCluster)).toBe(true);
  });

  it('sorts nearby notes by distance from anchor', () => {
    const notes = [
      makeNote({ id: 'near', latitude: 10.76, longitude: 106.66 }),
      makeNote({ id: 'mid', latitude: 10.80, longitude: 106.70 }),
      makeNote({ id: 'far', latitude: 11.0, longitude: 106.9 }),
    ];

    const nearby = getNearbyNoteItems(notes, { latitude: 10.7605, longitude: 106.6605 }, 3);
    expect(nearby.map((item) => item.note.id)).toEqual(['near', 'mid', 'far']);
  });
});
