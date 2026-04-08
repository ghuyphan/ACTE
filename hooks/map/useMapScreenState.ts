import type * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';
import type { Note } from '../../services/database';
import {
  applyMapFilters,
  buildMapGeometry,
  buildMapViewportState,
  getInitialMapRegion,
  MapFilterState,
  MapFilterType,
  regionToZoom,
} from './mapDomain';

interface UseMapScreenStateParams {
  notes: Note[];
  location: Location.LocationObject | null;
  enableHeavyCalculations?: boolean;
}

function areRegionsEquivalent(left: Region | null, right: Region) {
  if (!left) {
    return false;
  }

  return (
    Math.abs(left.latitude - right.latitude) < 0.00001 &&
    Math.abs(left.longitude - right.longitude) < 0.00001 &&
    Math.abs(left.latitudeDelta - right.latitudeDelta) < 0.00001 &&
    Math.abs(left.longitudeDelta - right.longitudeDelta) < 0.00001
  );
}

export function useMapScreenState({
  notes,
  location,
  enableHeavyCalculations = true,
}: UseMapScreenStateParams) {
  const [filterState, setFilterState] = useState<MapFilterState>({
    type: 'all',
    favoritesOnly: false,
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [nearbyBrowseRegion, setNearbyBrowseRegion] = useState<Region | null>(null);
  const lastMarkerTapAtRef = useRef(0);
  const ignoreNextMapPressUntilRef = useRef(0);
  const visibleRegionRef = useRef<Region | null>(null);

  const initialRegion = useMemo(() => getInitialMapRegion(location, notes), [location, notes]);

  const filteredNotes = useMemo(
    () => applyMapFilters(notes, filterState),
    [filterState, notes]
  );

  const mapGeometry = useMemo(
    () => (enableHeavyCalculations ? buildMapGeometry(filteredNotes) : buildMapGeometry([])),
    [enableHeavyCalculations, filteredNotes]
  );
  const pointGroups = mapGeometry.pointGroups;
  const pointGroupMap = mapGeometry.pointGroupMap;

  const selectedGroup = useMemo(
    () => (selectedGroupId ? pointGroupMap.get(selectedGroupId) ?? null : null),
    [pointGroupMap, selectedGroupId]
  );

  const selectedNote = selectedGroup?.notes[selectedNoteIndex] ?? null;
  const viewportState = useMemo(
    () =>
      buildMapViewportState({
        filteredNotes,
        geometry: mapGeometry,
        initialRegion,
        visibleRegion,
        nearbyBrowseRegion,
        location,
        enableHeavyCalculations,
      }),
    [
      enableHeavyCalculations,
      filteredNotes,
      initialRegion,
      location,
      mapGeometry,
      nearbyBrowseRegion,
      visibleRegion,
    ]
  );
  const clusterNodes = viewportState.clusterNodes;
  const nearbyItems = viewportState.nearbyItems;
  const notesInVisibleRegion = viewportState.notesInVisibleRegion;

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

  const updateVisibleRegion = useCallback((region: Region) => {
    if (areRegionsEquivalent(visibleRegionRef.current, region)) {
      return;
    }

    setVisibleRegion(region);
    setNearbyBrowseRegion(region);
  }, []);

  const setProgrammaticVisibleRegion = useCallback((region: Region) => {
    if (areRegionsEquivalent(visibleRegionRef.current, region)) {
      return;
    }

    setVisibleRegion(region);
  }, []);

  const handleLeafMarkerPress = useCallback((groupId: string) => {
    const now = Date.now();
    lastMarkerTapAtRef.current = now;
    ignoreNextMapPressUntilRef.current = now + 320;
    setSelectedGroupId(groupId);
    setSelectedNoteIndex(0);
  }, []);

  const handleClusterMarkerPress = useCallback(() => {
    const now = Date.now();
    lastMarkerTapAtRef.current = now;
    ignoreNextMapPressUntilRef.current = now + 320;
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const handleMapPress = useCallback(() => {
    const now = Date.now();

    if (now <= ignoreNextMapPressUntilRef.current) {
      ignoreNextMapPressUntilRef.current = 0;
      return;
    }

    if (now - lastMarkerTapAtRef.current < 250) {
      return;
    }
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const clearSelection = useCallback(() => {
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

  useEffect(() => {
    visibleRegionRef.current = visibleRegion;
  }, [visibleRegion]);

  return {
    filterState,
    setFilterType,
    toggleFavoritesOnly,
    clearFilters,
    initialRegion,
    visibleRegion,
    setVisibleRegion: updateVisibleRegion,
    setProgrammaticVisibleRegion,
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
    clearSelection,
    selectNoteById,
    clusterNodes,
    pointGroupMap,
    nearbyItems,
    filteredNotes,
    filteredCount,
    hasActiveFilters: filterState.type !== 'all' || filterState.favoritesOnly,
    currentZoom: visibleRegion ? regionToZoom(visibleRegion) : regionToZoom(initialRegion),
  };
}
