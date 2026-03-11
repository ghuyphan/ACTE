import type * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';
import type { Note } from '../../services/database';
import {
  applyMapFilters,
  buildClusterIndex,
  buildMapPointGroups,
  DEFAULT_REGION,
  getInitialMapRegion,
  getMapClusterNodes,
  getNearbyNoteItems,
  getNotesInRegion,
  getPointGroupMap,
  getRegionCenter,
  MapFilterState,
  MapFilterType,
  MapPointGroup,
  regionToZoom,
} from './mapDomain';

interface UseMapScreenStateParams {
  notes: Note[];
  location: Location.LocationObject | null;
}

export function useMapScreenState({ notes, location }: UseMapScreenStateParams) {
  const [filterState, setFilterState] = useState<MapFilterState>({
    type: 'all',
    favoritesOnly: false,
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [isNearbyCollapsed, setIsNearbyCollapsed] = useState(false);
  const lastMarkerTapAtRef = useRef(0);

  const initialRegion = useMemo(() => getInitialMapRegion(location, notes), [location, notes]);

  const filteredNotes = useMemo(
    () => applyMapFilters(notes, filterState),
    [filterState, notes]
  );

  const pointGroups = useMemo<MapPointGroup[]>(() => buildMapPointGroups(filteredNotes), [filteredNotes]);
  const pointGroupMap = useMemo(() => getPointGroupMap(pointGroups), [pointGroups]);

  const clusterIndex = useMemo(() => buildClusterIndex(pointGroups), [pointGroups]);

  const clusteringRegion = visibleRegion ?? initialRegion ?? DEFAULT_REGION;

  const clusterNodes = useMemo(
    () => getMapClusterNodes(clusterIndex, clusteringRegion, pointGroupMap),
    [clusterIndex, clusteringRegion, pointGroupMap]
  );

  const selectedGroup = useMemo(
    () => (selectedGroupId ? pointGroupMap.get(selectedGroupId) ?? null : null),
    [pointGroupMap, selectedGroupId]
  );

  const selectedNote = selectedGroup?.notes[selectedNoteIndex] ?? null;

  const nearbyAnchor = useMemo(() => {
    if (location) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }

    if (visibleRegion) {
      return getRegionCenter(visibleRegion);
    }

    return getRegionCenter(initialRegion);
  }, [initialRegion, location, visibleRegion]);

  const nearbyCandidates = useMemo(() => {
    if (!visibleRegion) {
      return filteredNotes;
    }

    const inRegion = getNotesInRegion(filteredNotes, visibleRegion);
    return inRegion.length > 0 ? inRegion : filteredNotes;
  }, [filteredNotes, visibleRegion]);

  const nearbyItems = useMemo(
    () => getNearbyNoteItems(nearbyCandidates, nearbyAnchor, 30),
    [nearbyAnchor, nearbyCandidates]
  );

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedNoteIndex(0);
      return;
    }

    if (selectedNoteIndex > selectedGroup.notes.length - 1) {
      setSelectedNoteIndex(0);
    }
  }, [selectedGroup, selectedNoteIndex]);

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }

    if (!pointGroupMap.has(selectedGroupId)) {
      setSelectedGroupId(null);
      setSelectedNoteIndex(0);
    }
  }, [pointGroupMap, selectedGroupId]);

  const setFilterType = useCallback((nextType: MapFilterType) => {
    setFilterState((current) => ({ ...current, type: nextType }));
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const toggleFavoritesOnly = useCallback(() => {
    setFilterState((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }));
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState({ type: 'all', favoritesOnly: false });
  }, []);

  const handleLeafMarkerPress = useCallback((groupId: string) => {
    lastMarkerTapAtRef.current = Date.now();
    setSelectedGroupId(groupId);
    setSelectedNoteIndex(0);
  }, []);

  const handleClusterMarkerPress = useCallback(() => {
    lastMarkerTapAtRef.current = Date.now();
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const handleMapPress = useCallback(() => {
    if (Date.now() - lastMarkerTapAtRef.current < 250) {
      return;
    }
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const openPrevInGroup = useCallback(() => {
    if (!selectedGroup) {
      return;
    }
    setSelectedNoteIndex((current) => (current - 1 + selectedGroup.notes.length) % selectedGroup.notes.length);
  }, [selectedGroup]);

  const openNextInGroup = useCallback(() => {
    if (!selectedGroup) {
      return;
    }
    setSelectedNoteIndex((current) => (current + 1) % selectedGroup.notes.length);
  }, [selectedGroup]);

  const selectNoteById = useCallback(
    (noteId: string) => {
      const group = pointGroups.find((item) => item.notes.some((note) => note.id === noteId));
      if (!group) {
        return;
      }

      const index = group.notes.findIndex((note) => note.id === noteId);
      lastMarkerTapAtRef.current = Date.now();
      setSelectedGroupId(group.id);
      setSelectedNoteIndex(index === -1 ? 0 : index);
    },
    [pointGroups]
  );

  const selectedNoteId = selectedNote?.id ?? null;
  const filteredCount = filteredNotes.length;

  return {
    filterState,
    setFilterType,
    toggleFavoritesOnly,
    clearFilters,
    initialRegion,
    visibleRegion,
    setVisibleRegion,
    selectedGroupId,
    selectedGroup,
    selectedNote,
    selectedNoteId,
    selectedNoteIndex,
    openPrevInGroup,
    openNextInGroup,
    handleLeafMarkerPress,
    handleClusterMarkerPress,
    handleMapPress,
    selectNoteById,
    clusterNodes,
    pointGroupMap,
    nearbyItems,
    isNearbyCollapsed,
    setIsNearbyCollapsed,
    filteredNotes,
    filteredCount,
    hasActiveFilters: filterState.type !== 'all' || filterState.favoritesOnly,
    currentZoom: visibleRegion ? regionToZoom(visibleRegion) : regionToZoom(initialRegion),
  };
}
