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

const SYNTHETIC_MAP_PRESS_GUARD_MS = 120;

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
  const suppressMapPressAfterMarkerTapAtRef = useRef(0);
  const visibleRegionRef = useRef<Region | null>(null);
  const selectedNoteIntentIdRef = useRef<string | null>(null);

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
      selectedNoteIntentIdRef.current = null;
      return;
    }

    const intendedNoteId = selectedNoteIntentIdRef.current;
    if (!selectedGroup || !intendedNoteId) {
      return;
    }

    const nextIndex = selectedGroup.notes.findIndex((note) => note.id === intendedNoteId);
    if (nextIndex === -1) {
      selectedNoteIntentIdRef.current = null;
      setSelectedGroupId(null);
      setSelectedNoteIndex(0);
      return;
    }

    if (nextIndex !== selectedNoteIndex) {
      setSelectedNoteIndex(nextIndex);
    }
  }, [selectedGroup, selectedGroupId, selectedNoteIndex]);

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }

    if (!pointGroupMap.has(selectedGroupId)) {
      selectedNoteIntentIdRef.current = null;
      setSelectedGroupId(null);
      setSelectedNoteIndex(0);
    }
  }, [pointGroupMap, selectedGroupId]);

  const setFilterType = useCallback((nextType: MapFilterType) => {
    selectedNoteIntentIdRef.current = null;
    setFilterState((current) => ({ ...current, type: nextType }));
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const toggleFavoritesOnly = useCallback(() => {
    selectedNoteIntentIdRef.current = null;
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
    setNearbyBrowseRegion(region);
  }, []);

  const clearSelectedGroup = useCallback(() => {
    selectedNoteIntentIdRef.current = null;
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const handleLeafMarkerPress = useCallback((groupId: string) => {
    const group = pointGroupMap.get(groupId) ?? null;
    suppressMapPressAfterMarkerTapAtRef.current = Date.now();
    selectedNoteIntentIdRef.current = group?.notes[0]?.id ?? null;
    setSelectedGroupId(groupId);
    setSelectedNoteIndex(0);
  }, [pointGroupMap]);

  const handleClusterMarkerPress = useCallback(() => {
    suppressMapPressAfterMarkerTapAtRef.current = Date.now();
    clearSelectedGroup();
  }, [clearSelectedGroup]);

  const handleMapPress = useCallback(() => {
    const elapsedSinceMarkerTap = Date.now() - suppressMapPressAfterMarkerTapAtRef.current;
    if (elapsedSinceMarkerTap >= 0 && elapsedSinceMarkerTap <= SYNTHETIC_MAP_PRESS_GUARD_MS) {
      suppressMapPressAfterMarkerTapAtRef.current = 0;
      return;
    }

    suppressMapPressAfterMarkerTapAtRef.current = 0;
    clearSelectedGroup();
  }, [clearSelectedGroup]);

  const clearSelection = useCallback(() => {
    suppressMapPressAfterMarkerTapAtRef.current = 0;
    clearSelectedGroup();
  }, [clearSelectedGroup]);

  const openPrevInGroup = useCallback(() => {
    if (!selectedGroup) {
      return;
    }
    setSelectedNoteIndex((current) => {
      const nextIndex = (current - 1 + selectedGroup.notes.length) % selectedGroup.notes.length;
      selectedNoteIntentIdRef.current = selectedGroup.notes[nextIndex]?.id ?? null;
      return nextIndex;
    });
  }, [selectedGroup]);

  const openNextInGroup = useCallback(() => {
    if (!selectedGroup) {
      return;
    }
    setSelectedNoteIndex((current) => {
      const nextIndex = (current + 1) % selectedGroup.notes.length;
      selectedNoteIntentIdRef.current = selectedGroup.notes[nextIndex]?.id ?? null;
      return nextIndex;
    });
  }, [selectedGroup]);

  const selectNoteById = useCallback(
    (noteId: string) => {
      const group = pointGroups.find((item) => item.notes.some((note) => note.id === noteId));
      if (!group) {
        return;
      }

      const index = group.notes.findIndex((note) => note.id === noteId);
      selectedNoteIntentIdRef.current = noteId;
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
