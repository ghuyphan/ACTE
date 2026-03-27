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

export function useMapScreenState({ notes, location }: UseMapScreenStateParams) {
  const [filterState, setFilterState] = useState<MapFilterState>({
    type: 'all',
    favoritesOnly: false,
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [allowOffscreenResults, setAllowOffscreenResults] = useState(false);
  const lastMarkerTapAtRef = useRef(0);
  const visibleRegionRef = useRef<Region | null>(null);

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

  const notesInVisibleRegion = useMemo(() => {
    if (!visibleRegion) {
      return filteredNotes;
    }

    return getNotesInRegion(filteredNotes, visibleRegion);
  }, [filteredNotes, visibleRegion]);

  const nearbyCandidates = useMemo(() => {
    if (!visibleRegion) {
      return filteredNotes;
    }

    if (notesInVisibleRegion.length > 0) {
      return notesInVisibleRegion;
    }

    return allowOffscreenResults ? filteredNotes : [];
  }, [allowOffscreenResults, filteredNotes, notesInVisibleRegion, visibleRegion]);

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
    setAllowOffscreenResults(false);
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const toggleFavoritesOnly = useCallback(() => {
    setFilterState((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }));
    setAllowOffscreenResults(false);
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState({ type: 'all', favoritesOnly: false });
    setAllowOffscreenResults(false);
  }, []);

  const updateVisibleRegion = useCallback((region: Region) => {
    if (areRegionsEquivalent(visibleRegionRef.current, region)) {
      return;
    }

    setVisibleRegion(region);
    setAllowOffscreenResults(false);
  }, []);

  const showAllFilteredResults = useCallback(() => {
    setAllowOffscreenResults(true);
    setSelectedGroupId(null);
    setSelectedNoteIndex(0);
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
    showAllFilteredResults,
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
    filteredNotes,
    filteredCount,
    visibleAreaCount: notesInVisibleRegion.length,
    showingAllFilteredResults:
      Boolean(visibleRegion) &&
      notesInVisibleRegion.length === 0 &&
      filteredNotes.length > 0 &&
      allowOffscreenResults,
    hasActiveFilters: filterState.type !== 'all' || filterState.favoritesOnly,
    currentZoom: visibleRegion ? regionToZoom(visibleRegion) : regionToZoom(initialRegion),
  };
}
