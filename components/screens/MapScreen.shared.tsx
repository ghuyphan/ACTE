import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import * as Haptics from '../../hooks/useHaptics';
import { Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../map/MapCanvas';
import MapFilterBar from '../map/MapFilterBar';
import MapFriendsPreviewCard from '../map/MapFriendsPreviewCard';
import MapPreviewCard from '../map/MapPreviewCard';
import MapStatusCard from '../map/MapStatusCard';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from '../map/overlayTokens';
import { useAuth } from '../../hooks/useAuth';
import type { MapClusterNode } from '../../hooks/map/mapDomain';
import { regionToZoom } from '../../hooks/map/mapDomain';
import { useMapPreviewState } from '../../hooks/map/useMapPreviewState';
import { useMapScreenState } from '../../hooks/map/useMapScreenState';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { useAndroidBottomTabOverlayInset } from '../../hooks/useAndroidBottomTabOverlayInset';
import type { SharedPost } from '../../services/sharedFeedService';
import { showAppAlert } from '../../utils/alert';
import { isOlderIOS } from '../../utils/platform';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';
import { Shadows } from '../../constants/theme';

const MIN_ZOOM_DELTA = 0.002;
const RECENTER_BUTTON_ZOOM_DELTA = 0.012;
const MARKER_FIRST_TAP_DELTA = 0.025;
const MARKER_SECOND_TAP_DELTA = 0.012;
const PROGRAMMATIC_REGION_TOLERANCE = 0.0005;
const PREVIEW_FOCUS_REGION_GUARD_MS = 900;
const HEAVY_MAP_WARMUP_DATASET_SIZE = 24;
const NOTE_PREVIEW_REST_HEIGHT = 168;
const NOTE_PREVIEW_EXPANDED_HEIGHT = 344;
const FRIEND_PREVIEW_REST_HEIGHT = 152;
const FRIEND_PREVIEW_EXPANDED_HEIGHT = 332;
const STATUS_PREVIEW_FILTERED_HEIGHT = 116;
const STATUS_PREVIEW_COLLAPSED_HEIGHT = 62;
const STATUS_PREVIEW_EMPTY_HEIGHT = 48;
const RECENTER_FAB_PREVIEW_GAP = 12;
const RECENTER_FAB_BOTTOM_DEFAULT = 86;

type MapRegionChangeDetails = {
  isGesture?: boolean;
};

type OverlayState = 'content' | 'no-filter-results' | 'no-notes' | 'area-empty';

type MapSaveTarget = {
  latitude: number;
  longitude: number;
};

function areRegionsClose(left: Region | null, right: Region) {
  if (!left) {
    return false;
  }

  return (
    Math.abs(left.latitude - right.latitude) < PROGRAMMATIC_REGION_TOLERANCE &&
    Math.abs(left.longitude - right.longitude) < PROGRAMMATIC_REGION_TOLERANCE &&
    Math.abs(left.latitudeDelta - right.latitudeDelta) < PROGRAMMATIC_REGION_TOLERANCE &&
    Math.abs(left.longitudeDelta - right.longitudeDelta) < PROGRAMMATIC_REGION_TOLERANCE
  );
}

function isCoordinateCenteredInRegion(region: Region | null, latitude: number, longitude: number) {
  if (!region) {
    return false;
  }

  const latitudeTolerance = Math.max(0.0004, region.latitudeDelta * 0.12);
  const longitudeTolerance = Math.max(0.0004, region.longitudeDelta * 0.12);

  return (
    Math.abs(region.latitude - latitude) <= latitudeTolerance &&
    Math.abs(region.longitude - longitude) <= longitudeTolerance
  );
}

function isCoordinateComfortablyInRegion(region: Region, latitude: number, longitude: number) {
  const latitudeTolerance = Math.max(0.0008, region.latitudeDelta * 0.4);
  const longitudeTolerance = Math.max(0.0008, region.longitudeDelta * 0.4);

  return (
    Math.abs(region.latitude - latitude) <= latitudeTolerance &&
    Math.abs(region.longitude - longitude) <= longitudeTolerance
  );
}

function getStatusPreviewHeight(kind: 'collapsed' | 'save-here' | 'filtered-empty' | 'no-notes' | 'area-empty') {
  if (kind === 'filtered-empty') {
    return STATUS_PREVIEW_FILTERED_HEIGHT;
  }

  if (kind === 'collapsed' || kind === 'save-here' || kind === 'area-empty') {
    return STATUS_PREVIEW_COLLAPSED_HEIGHT;
  }

  return STATUS_PREVIEW_EMPTY_HEIGHT;
}

export default function MapScreenIOS() {
  const isAndroid = Platform.OS === 'android';
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomTabOverlayInset = useAndroidBottomTabOverlayInset();
  const reduceMotionEnabled = useReducedMotion();
  const { user } = useAuth();
  const { notes, loading } = useNotesStore();
  const { enabled: sharedEnabled, sharedPosts } = useSharedFeedStore();
  const shouldDeferMapWarmup =
    isAndroid || notes.length + sharedPosts.length >= HEAVY_MAP_WARMUP_DATASET_SIZE;
  const { location, requestForegroundLocation, openAppSettings } = useGeofence();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [markerPulseId, setMarkerPulseId] = useState<string | null>(null);
  const [markerPulseKey, setMarkerPulseKey] = useState(0);
  const [mapUiReady, setMapUiReady] = useState(!shouldDeferMapWarmup);
  const [saveTarget, setSaveTarget] = useState<MapSaveTarget | null>(null);
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const hasAppliedInitialViewportRef = useRef(false);
  const hasCenteredOnLocationRef = useRef(false);
  const markerPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFriendsPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgrammaticRegionRef = useRef<Region | null>(null);
  const nearbyPreviewFocusGuardUntilRef = useRef(0);

  useEffect(() => {
    if (!shouldDeferMapWarmup || mapUiReady) {
      setMapUiReady(true);
      return;
    }

    const idleHandle = scheduleOnIdle(() => {
      setMapUiReady(true);
    }, { timeout: 250 });

    return () => {
      idleHandle.cancel();
    };
  }, [mapUiReady, shouldDeferMapWarmup]);

  const {
    filterState,
    setFilterType,
    toggleFavoritesOnly,
    clearFilters,
    initialRegion,
    visibleRegion,
    setVisibleRegion,
    setProgrammaticVisibleRegion,
    selectedGroupId,
    selectedGroup,
    selectedNote,
    selectedNoteIndex,
    handleLeafMarkerPress,
    handleClusterMarkerPress,
    handleMapPress,
    clearSelection,
    selectNoteById,
    clusterNodes,
    pointGroupMap,
    nearbyItems,
    notesInVisibleRegion,
    filteredNotes,
    filteredCount,
    hasActiveFilters,
  } = useMapScreenState({
    notes,
    location,
    enableHeavyCalculations: mapUiReady,
  });

  const previewBottomOffset =
    Platform.OS === 'android'
      ? bottomTabOverlayInset + 12
      : insets.bottom + 12;
  const previewMode = selectedGroup ? 'group' : 'nearby';
  const friendPosts = useMemo(
    () =>
      sharedPosts
        .filter((post) => post.authorUid !== user?.uid)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sharedPosts, user?.uid]
  );
  const friendMarkerPosts = useMemo(
    () =>
      mapUiReady
        ? friendPosts.filter(
            (post): post is SharedPost & { latitude: number; longitude: number } =>
              typeof post.latitude === 'number' &&
              Number.isFinite(post.latitude) &&
              typeof post.longitude === 'number' &&
              Number.isFinite(post.longitude)
          )
        : [],
    [friendPosts, mapUiReady]
  );
  const validPreviewNoteIds = useMemo(
    () => new Set(filteredNotes.map((note) => note.id)),
    [filteredNotes]
  );
  const {
    activeFriendPostId,
    activeNearbyNoteId,
    clearFriendsPreview,
    closeFriendsPreview,
    collapseNotesPreview,
    nearbyPreviewItems,
    notesPreviewPersistsWhenAreaEmpty,
    notesPreviewVisibility,
    openFriendsPreview,
    revealNotesPreview,
    setActiveFriendPostId,
    showFriendsPreview,
    toggleFriendsPreview,
    focusNearbyPreview,
    resetToNearbyPreview,
  } = useMapPreviewState({
    nearbyItems,
    friendPosts,
    validNoteIds: validPreviewNoteIds,
  });
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note] as const)), [notes]);
  const currentZoom = visibleRegion ? regionToZoom(visibleRegion) : regionToZoom(initialRegion);
  const nearbyItemById = useMemo(
    () => new Map(nearbyPreviewItems.map((item) => [item.note.id, item] as const)),
    [nearbyPreviewItems]
  );
  const activePreviewNote = useMemo(() => {
    if (selectedGroup && selectedNote) {
      return selectedNote;
    }

    if (activeNearbyNoteId) {
      return nearbyItemById.get(activeNearbyNoteId)?.note ?? null;
    }

    return nearbyPreviewItems[0]?.note ?? null;
  }, [activeNearbyNoteId, nearbyItemById, nearbyPreviewItems, selectedGroup, selectedNote]);
  const activeNoteReadyToOpen = useMemo(
    () =>
      activePreviewNote != null &&
      isCoordinateCenteredInRegion(
        settledRegion ?? initialRegion,
        activePreviewNote.latitude,
        activePreviewNote.longitude
      ),
    [activePreviewNote, initialRegion, settledRegion]
  );
  const activePreviewNoteId = activePreviewNote?.id ?? null;
  const activeFriendPost = useMemo(
    () => friendPosts.find((post) => post.id === activeFriendPostId) ?? null,
    [activeFriendPostId, friendPosts]
  );
  const activeFriendPostReadyToOpen = useMemo(
    () =>
      activeFriendPost != null &&
      typeof activeFriendPost.latitude === 'number' &&
      typeof activeFriendPost.longitude === 'number' &&
      isCoordinateCenteredInRegion(
        settledRegion ?? initialRegion,
        activeFriendPost.latitude,
        activeFriendPost.longitude
      ),
    [activeFriendPost, initialRegion, settledRegion]
  );
  const friendsPreviewVisible = showFriendsPreview && friendPosts.length > 0;
  const hasFriendLayer = sharedEnabled && friendPosts.length > 0;
  const hasOwnNotes = notes.length > 0;
  const hasNotesInVisibleRegion = notesInVisibleRegion.length > 0;
  const shouldShowAreaEmptyState =
    mapUiReady &&
    visibleRegion != null &&
    selectedGroup == null &&
    !notesPreviewPersistsWhenAreaEmpty &&
    filteredCount > 0 &&
    !hasNotesInVisibleRegion &&
    nearbyPreviewItems.length === 0;
  const hasPreviewItems = selectedGroup ? selectedGroup.notes.length > 0 : nearbyPreviewItems.length > 0;
  const overlayState: OverlayState =
    !mapUiReady
      ? 'content'
      : !hasOwnNotes
      ? 'no-notes'
      : notes.length > 0 && filteredCount === 0
        ? 'no-filter-results'
        : shouldShowAreaEmptyState
          ? 'area-empty'
        : 'content';
  const overlayShowsNotesPreview =
    mapUiReady &&
    hasPreviewItems &&
    (overlayState === 'content' || notesPreviewPersistsWhenAreaEmpty);
  const bottomOverlayKind:
    | 'hidden'
    | 'preview'
    | 'collapsed'
    | 'save-here'
    | 'filtered-empty'
    | 'no-notes'
    | 'area-empty' =
    !mapUiReady || friendsPreviewVisible
      ? 'hidden'
      : saveTarget
        ? 'save-here'
      : overlayShowsNotesPreview && notesPreviewVisibility === 'visible'
        ? 'preview'
        : overlayShowsNotesPreview && notesPreviewVisibility === 'collapsed'
          ? 'collapsed'
          : overlayState === 'area-empty'
            ? 'area-empty'
          : overlayState === 'no-notes'
            ? 'no-notes'
            : overlayState === 'no-filter-results'
              ? 'filtered-empty'
              : 'hidden';
  const bottomOverlayVisible = bottomOverlayKind !== 'hidden';
  const isStatusOverlay =
    bottomOverlayKind === 'collapsed' ||
    bottomOverlayKind === 'save-here' ||
    bottomOverlayKind === 'filtered-empty' ||
    bottomOverlayKind === 'no-notes' ||
    bottomOverlayKind === 'area-empty';
  const notesPreviewVisible = bottomOverlayKind === 'preview';
  const recenterPreviewRestingOffset =
    notesPreviewVisible
      ? NOTE_PREVIEW_REST_HEIGHT + RECENTER_FAB_PREVIEW_GAP
      : friendsPreviewVisible
        ? FRIEND_PREVIEW_REST_HEIGHT + RECENTER_FAB_PREVIEW_GAP
        : isStatusOverlay
          ? getStatusPreviewHeight(bottomOverlayKind) + RECENTER_FAB_PREVIEW_GAP
          : RECENTER_FAB_BOTTOM_DEFAULT;
  const recenterPreviewExpansionRange =
    notesPreviewVisible
      ? NOTE_PREVIEW_EXPANDED_HEIGHT - NOTE_PREVIEW_REST_HEIGHT
      : friendsPreviewVisible
        ? FRIEND_PREVIEW_EXPANDED_HEIGHT - FRIEND_PREVIEW_REST_HEIGHT
      : 0;
  const recenterAnchorsToPreview = notesPreviewVisible || friendsPreviewVisible || isStatusOverlay;
  const recenterPreviewProgress = useSharedValue(recenterAnchorsToPreview ? 1 : 0);
  const previewExpansionProgress = useSharedValue(0);
  const recenterRestingOffset = useSharedValue(recenterPreviewRestingOffset);
  const recenterExpansionRange = useSharedValue(recenterPreviewExpansionRange);

  useEffect(() => {
    recenterRestingOffset.value = reduceMotionEnabled
      ? recenterPreviewRestingOffset
      : withSpring(recenterPreviewRestingOffset, {
          damping: 24,
          stiffness: 220,
          mass: 0.86,
        });

    recenterExpansionRange.value = recenterPreviewExpansionRange;
    recenterPreviewProgress.value = reduceMotionEnabled
      ? (recenterAnchorsToPreview ? 1 : 0)
      : withSpring(recenterAnchorsToPreview ? 1 : 0, {
          damping: 24,
          stiffness: 220,
          mass: 0.86,
        });

    if (!notesPreviewVisible && !friendsPreviewVisible) {
      previewExpansionProgress.value = reduceMotionEnabled
        ? 0
        : withTiming(0, { duration: 140 });
    }
  }, [
    friendsPreviewVisible,
    notesPreviewVisible,
    previewExpansionProgress,
    recenterAnchorsToPreview,
    recenterExpansionRange,
    recenterPreviewExpansionRange,
    recenterPreviewProgress,
    recenterPreviewRestingOffset,
    recenterRestingOffset,
    reduceMotionEnabled,
  ]);

  const recenterFabAnimatedStyle = useAnimatedStyle(() => {
    const previewOffset =
      RECENTER_FAB_BOTTOM_DEFAULT +
      (recenterRestingOffset.value - RECENTER_FAB_BOTTOM_DEFAULT) * recenterPreviewProgress.value +
      previewExpansionProgress.value * recenterExpansionRange.value * recenterPreviewProgress.value;

    return {
      bottom: previewBottomOffset + previewOffset,
    };
  }, [previewBottomOffset]);

  useEffect(() => {
    if (overlayState !== 'content' && !notesPreviewPersistsWhenAreaEmpty) {
      resetToNearbyPreview();
    }
  }, [notesPreviewPersistsWhenAreaEmpty, overlayState, resetToNearbyPreview]);

  useEffect(() => {
    return () => {
      if (markerPulseTimerRef.current) {
        clearTimeout(markerPulseTimerRef.current);
      }
      if (openFriendsPreviewTimerRef.current) {
        clearTimeout(openFriendsPreviewTimerRef.current);
      }
    };
  }, []);

  const emitLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateProgrammaticRegion = useCallback(
    (region: Region, options?: { freezeNearbyPreviewSession?: boolean }) => {
      pendingProgrammaticRegionRef.current = region;
      if (options?.freezeNearbyPreviewSession) {
        nearbyPreviewFocusGuardUntilRef.current = Date.now() + PREVIEW_FOCUS_REGION_GUARD_MS;
      }
      setProgrammaticVisibleRegion(region);
    },
    [setProgrammaticVisibleRegion]
  );

  const animateToRegion = useCallback(
    (region: Region, duration: number, options?: { freezeNearbyPreviewSession?: boolean }) => {
      updateProgrammaticRegion(region, options);
      mapRef.current?.animateToRegion(region, duration);
    },
    [updateProgrammaticRegion]
  );

  const handleRegionChangeComplete = useCallback(
    (region: Region, details?: MapRegionChangeDetails) => {
      setSettledRegion(region);
      const isGoogleMapsGesture = details?.isGesture;
      const isInsidePreviewFocusGuard = Date.now() <= nearbyPreviewFocusGuardUntilRef.current;
      const matchesPendingProgrammaticRegion = areRegionsClose(pendingProgrammaticRegionRef.current, region);

      if (isGoogleMapsGesture === false || matchesPendingProgrammaticRegion || isInsidePreviewFocusGuard) {
        pendingProgrammaticRegionRef.current = null;
        setProgrammaticVisibleRegion(region);
        return;
      }

      nearbyPreviewFocusGuardUntilRef.current = 0;
      pendingProgrammaticRegionRef.current = null;
      setVisibleRegion(region);
    },
    [setProgrammaticVisibleRegion, setVisibleRegion]
  );

  const triggerMarkerPulse = useCallback(
    (nextMarkerId: string) => {
      if (markerPulseTimerRef.current) {
        clearTimeout(markerPulseTimerRef.current);
      }

      setMarkerPulseId(nextMarkerId);
      setMarkerPulseKey((current) => current + 1);

      markerPulseTimerRef.current = setTimeout(() => {
        setMarkerPulseId((current) => (current === nextMarkerId ? null : current));
        markerPulseTimerRef.current = null;
      }, reduceMotionEnabled ? 90 : 240);
    },
    [reduceMotionEnabled]
  );

  const openNote = useCallback(
    (noteId: string) => {
      if (Platform.OS === 'ios') {
        openNoteDetail(noteId);
        return;
      }
      router.push(`/note/${noteId}` as any);
    },
    [openNoteDetail, router]
  );

  const handleMapCanvasPress = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
    setSaveTarget(null);
    resetToNearbyPreview();
    clearFriendsPreview();
    handleMapPress();
  }, [clearFriendsPreview, handleMapPress, resetToNearbyPreview]);

  const handleMapCanvasLongPress = useCallback(
    (coordinate: MapSaveTarget) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      setSaveTarget(coordinate);
      resetToNearbyPreview();
      clearFriendsPreview();
      clearSelection();
      emitLightHaptic();
    },
    [clearFriendsPreview, clearSelection, emitLightHaptic, resetToNearbyPreview]
  );

  const handleSaveAtTarget = useCallback(() => {
    if (!saveTarget) {
      return;
    }

    router.push({
      pathname: '/(tabs)',
      params: {
        mapSaveAt: String(Date.now()),
        mapSaveLat: saveTarget.latitude.toFixed(7),
        mapSaveLon: saveTarget.longitude.toFixed(7),
      },
    } as Href);
  }, [router, saveTarget]);

  const handleChangeFilterType = useCallback(
    (nextType: Parameters<typeof setFilterType>[0]) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      setSaveTarget(null);
      revealNotesPreview({ resetToNearby: true });
      setFilterType(nextType);
    },
    [revealNotesPreview, setFilterType]
  );

  const handleToggleFavorites = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
    setSaveTarget(null);
    revealNotesPreview({ resetToNearby: true });
    toggleFavoritesOnly();
  }, [revealNotesPreview, toggleFavoritesOnly]);

  const handleClearActiveFilters = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
    setSaveTarget(null);
    revealNotesPreview({ resetToNearby: true });
    clearFilters();
  }, [clearFilters, revealNotesPreview]);

  const goToMyLocation = useCallback(async () => {
    setSaveTarget(null);
    const result = await requestForegroundLocation();
    const target = result?.location ?? location;

    if (!target && result?.requiresSettings) {
      await openAppSettings();
      return;
    }

    if (!target && result?.reason === 'permission_denied') {
      showAppAlert(
        t('map.locationPermissionTitle', 'Location access is off'),
        t(
          'map.locationPermissionBody',
          'Allow location access so Noto can center the map on you.'
        )
      );
      return;
    }

    if (!target) {
      showAppAlert(
        t('capture.locationUnavailableTitle', 'Location unavailable'),
        t(
          'capture.noLocation',
          'Noto could not get your current location yet. Please try again in a moment.'
        )
      );
      return;
    }

    if (target && mapRef.current) {
      const baseRegion = settledRegion ?? visibleRegion ?? initialRegion;
      const isAlreadyCentered = isCoordinateCenteredInRegion(
        baseRegion,
        target.coords.latitude,
        target.coords.longitude
      );
      const focusRegion = {
        latitude: target.coords.latitude,
        longitude: target.coords.longitude,
        latitudeDelta: Math.max(baseRegion.latitudeDelta, MIN_ZOOM_DELTA),
        longitudeDelta: Math.max(baseRegion.longitudeDelta, MIN_ZOOM_DELTA),
      };
      const zoomRegion = {
        latitude: target.coords.latitude,
        longitude: target.coords.longitude,
        latitudeDelta: Math.max(
          MIN_ZOOM_DELTA,
          Math.min(baseRegion.latitudeDelta, RECENTER_BUTTON_ZOOM_DELTA)
        ),
        longitudeDelta: Math.max(
          MIN_ZOOM_DELTA,
          Math.min(baseRegion.longitudeDelta, RECENTER_BUTTON_ZOOM_DELTA)
        ),
      };
      const shouldZoomIn =
        isAlreadyCentered &&
        (baseRegion.latitudeDelta > zoomRegion.latitudeDelta + PROGRAMMATIC_REGION_TOLERANCE ||
          baseRegion.longitudeDelta > zoomRegion.longitudeDelta + PROGRAMMATIC_REGION_TOLERANCE);
      const nextRegion = shouldZoomIn ? zoomRegion : focusRegion;

      animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 450);
      emitLightHaptic();
    }
  }, [
    animateToRegion,
    emitLightHaptic,
    initialRegion,
    location,
    openAppSettings,
    reduceMotionEnabled,
    requestForegroundLocation,
    settledRegion,
    t,
    visibleRegion,
  ]);

  const fitToFilteredResults = useCallback(() => {
    if (!mapRef.current || filteredNotes.length === 0) {
      return;
    }

    const coordinates = filteredNotes.map((note) => ({
      latitude: note.latitude,
      longitude: note.longitude,
    }));

    if (coordinates.length === 1) {
      const [onlyCoordinate] = coordinates;
      if (!onlyCoordinate) {
        return;
      }

      animateToRegion(
        {
          latitude: onlyCoordinate.latitude,
          longitude: onlyCoordinate.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        reduceMotionEnabled ? 0 : 350
      );
      return;
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 150, right: 90, bottom: 210, left: 90 },
      animated: !reduceMotionEnabled,
    });
  }, [animateToRegion, filteredNotes, reduceMotionEnabled]);

  const handleClusterPress = useCallback(
    (node: MapClusterNode) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      setSaveTarget(null);
      resetToNearbyPreview();
      revealNotesPreview();
      handleClusterMarkerPress();
      emitLightHaptic();
      triggerMarkerPulse(node.id);

      if (!mapRef.current) {
        return;
      }

      const baseRegion = visibleRegion ?? initialRegion;
      const currentZoom = regionToZoom(baseRegion);
      const targetZoom = node.expansionZoom ?? currentZoom + 2;
      const zoomSteps = Math.max(1, targetZoom - currentZoom);
      const zoomFactor = Math.pow(2, zoomSteps);

      const nextRegion = {
        latitude: node.latitude,
        longitude: node.longitude,
        latitudeDelta: Math.max(baseRegion.latitudeDelta / zoomFactor, MIN_ZOOM_DELTA),
        longitudeDelta: Math.max(baseRegion.longitudeDelta / zoomFactor, MIN_ZOOM_DELTA),
      };

      animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 350);
    },
    [
      animateToRegion,
      emitLightHaptic,
      handleClusterMarkerPress,
      initialRegion,
      revealNotesPreview,
      reduceMotionEnabled,
      triggerMarkerPulse,
      resetToNearbyPreview,
      visibleRegion,
    ]
  );

  const focusMarkerOnMap = useCallback(
    (latitude: number, longitude: number, options?: { closeZoom?: boolean }) => {
      const baseRegion = visibleRegion ?? initialRegion;
      const maxDelta = options?.closeZoom ? MARKER_SECOND_TAP_DELTA : MARKER_FIRST_TAP_DELTA;
      const nextLatitudeDelta = Math.max(
        MIN_ZOOM_DELTA,
        Math.min(baseRegion.latitudeDelta, maxDelta)
      );
      const nextLongitudeDelta = Math.max(
        MIN_ZOOM_DELTA,
        Math.min(baseRegion.longitudeDelta, maxDelta)
      );
      const alreadyFocused =
        (options?.closeZoom
          ? isCoordinateCenteredInRegion(baseRegion, latitude, longitude)
          : isCoordinateComfortablyInRegion(baseRegion, latitude, longitude)) &&
        baseRegion.latitudeDelta <= nextLatitudeDelta + PROGRAMMATIC_REGION_TOLERANCE &&
        baseRegion.longitudeDelta <= nextLongitudeDelta + PROGRAMMATIC_REGION_TOLERANCE;

      if (alreadyFocused) {
        return;
      }

      animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: nextLatitudeDelta,
          longitudeDelta: nextLongitudeDelta,
        },
        reduceMotionEnabled ? 0 : 350
      );
    },
    [animateToRegion, initialRegion, reduceMotionEnabled, visibleRegion]
  );

  const handleLeafPress = useCallback(
    (groupId: string) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      setSaveTarget(null);
      resetToNearbyPreview();
      closeFriendsPreview();
      triggerMarkerPulse(groupId);
      const isRepeatTap = selectedGroupId === groupId;
      const group = pointGroupMap.get(groupId) ?? null;
      handleLeafMarkerPress(groupId);
      emitLightHaptic();

      if (notesPreviewVisibility === 'collapsed') {
        revealNotesPreview();
      }

      if (group) {
        focusMarkerOnMap(group.latitude, group.longitude, { closeZoom: isRepeatTap });
      }
    },
    [
      closeFriendsPreview,
      emitLightHaptic,
      handleLeafMarkerPress,
      notesPreviewVisibility,
      pointGroupMap,
      revealNotesPreview,
      selectedGroupId,
      triggerMarkerPulse,
      resetToNearbyPreview,
      focusMarkerOnMap,
    ]
  );

  const handleSeparatedNotePress = useCallback(
    (noteId: string) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      setSaveTarget(null);
      resetToNearbyPreview();
      closeFriendsPreview();
      triggerMarkerPulse(noteId);
      const isRepeatTap = selectedNote?.id === noteId;
      const note = noteById.get(noteId) ?? null;
      selectNoteById(noteId);
      emitLightHaptic();

      if (notesPreviewVisibility === 'collapsed') {
        revealNotesPreview();
      }

      if (note) {
        focusMarkerOnMap(note.latitude, note.longitude, { closeZoom: isRepeatTap });
      }
    },
    [
      closeFriendsPreview,
      emitLightHaptic,
      noteById,
      notesPreviewVisibility,
      revealNotesPreview,
      selectedNote,
      selectNoteById,
      triggerMarkerPulse,
      resetToNearbyPreview,
      focusMarkerOnMap,
    ]
  );

  const handleFocusNearbyNote = useCallback(
    (noteId: string) => {
      focusNearbyPreview(nearbyPreviewItems, noteId);
      const nearbyItem = nearbyItemById.get(noteId);
      if (!nearbyItem) {
        return;
      }

      if (!mapRef.current) {
        return;
      }

      const baseRegion = visibleRegion ?? initialRegion;
      const nextRegion = {
        latitude: nearbyItem.latitude,
        longitude: nearbyItem.longitude,
        latitudeDelta: Math.max(Math.min(baseRegion.latitudeDelta, 0.025), MIN_ZOOM_DELTA),
        longitudeDelta: Math.max(Math.min(baseRegion.longitudeDelta, 0.025), MIN_ZOOM_DELTA),
      };

      animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 350, {
        freezeNearbyPreviewSession: true,
      });
    },
    [
      animateToRegion,
      initialRegion,
      nearbyItemById,
      nearbyPreviewItems,
      reduceMotionEnabled,
      focusNearbyPreview,
      visibleRegion,
    ]
  );

  const focusPreviewNote = useCallback(
    (noteId: string) => {
      if (selectedGroup) {
        selectNoteById(noteId);
        return;
      }

      handleFocusNearbyNote(noteId);
    },
    [handleFocusNearbyNote, selectNoteById, selectedGroup]
  );

  const handleActivatePreviewNote = useCallback(
    (noteId: string) => {
      if (noteId !== activePreviewNoteId) {
        focusPreviewNote(noteId);
        return;
      }

      if (!activeNoteReadyToOpen) {
        focusPreviewNote(noteId);
        return;
      }

      openNote(noteId);
    },
    [activeNoteReadyToOpen, activePreviewNoteId, focusPreviewNote, openNote]
  );

  const handlePreviewPrimaryAction = useCallback(() => {
    if (!activePreviewNoteId) {
      return;
    }

    handleActivatePreviewNote(activePreviewNoteId);
  }, [activePreviewNoteId, handleActivatePreviewNote]);

  const handleOpenFriendsLayer = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
    setSaveTarget(null);
    resetToNearbyPreview();
    if (!hasFriendLayer) {
      return;
    }

    emitLightHaptic();
    toggleFriendsPreview(friendPosts[0]?.id ?? null);
  }, [emitLightHaptic, friendPosts, hasFriendLayer, resetToNearbyPreview, toggleFriendsPreview]);

  const handleDismissNotesPreview = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
    emitLightHaptic();
    resetToNearbyPreview();
    clearSelection();
    collapseNotesPreview();
  }, [clearSelection, collapseNotesPreview, emitLightHaptic, resetToNearbyPreview]);

  const handleDismissFriendsPreview = useCallback(() => {
    emitLightHaptic();
    closeFriendsPreview();
  }, [closeFriendsPreview, emitLightHaptic]);

  const focusFriendPost = useCallback(
    (postId: string, options?: { animate?: boolean; openPreview?: boolean }) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      setSaveTarget(null);
      const targetPost =
        friendMarkerPosts.find((post) => post.id === postId) ??
        friendPosts.find((post) => post.id === postId);
      if (!targetPost) {
        return;
      }

      setActiveFriendPostId(postId);

      if (
        options?.animate !== false &&
        typeof targetPost.latitude === 'number' &&
        typeof targetPost.longitude === 'number' &&
        mapRef.current
      ) {
        const baseRegion = visibleRegion ?? initialRegion;
        const nextRegion = {
          latitude: targetPost.latitude,
          longitude: targetPost.longitude,
          latitudeDelta: Math.max(Math.min(baseRegion.latitudeDelta, 0.025), MIN_ZOOM_DELTA),
          longitudeDelta: Math.max(Math.min(baseRegion.longitudeDelta, 0.025), MIN_ZOOM_DELTA),
        };

        animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 350);
      }

      const shouldOpenPreview = options?.openPreview ?? true;
      if (shouldOpenPreview) {
        if (options?.animate !== false && !reduceMotionEnabled && !showFriendsPreview) {
          if (openFriendsPreviewTimerRef.current) {
            clearTimeout(openFriendsPreviewTimerRef.current);
          }
          openFriendsPreviewTimerRef.current = setTimeout(() => {
            openFriendsPreview();
            openFriendsPreviewTimerRef.current = null;
          }, 150);
        } else {
          if (openFriendsPreviewTimerRef.current) {
            clearTimeout(openFriendsPreviewTimerRef.current);
            openFriendsPreviewTimerRef.current = null;
          }
          openFriendsPreview();
        }
      }
    },
    [
      animateToRegion,
      friendMarkerPosts,
      friendPosts,
      initialRegion,
      openFriendsPreview,
      reduceMotionEnabled,
      setActiveFriendPostId,
      showFriendsPreview,
      visibleRegion,
    ]
  );

  const handleFriendMarkerPress = useCallback(
    (postId: string) => {
      emitLightHaptic();
      focusFriendPost(postId, { animate: true, openPreview: true });
    },
    [emitLightHaptic, focusFriendPost]
  );

  const handleOpenSharedPost = useCallback(
    (postId?: string) => {
      const nextPostId = postId ?? activeFriendPostId;
      if (!nextPostId) {
        return;
      }

      router.push(`/shared/${nextPostId}` as any);
    },
    [activeFriendPostId, router]
  );

  useEffect(() => {
    if (!mapUiReady || !isMapReady || !mapRef.current) {
      return;
    }

    const fitCoordinates = [
      ...notes.map((note) => ({
        latitude: note.latitude,
        longitude: note.longitude,
      })),
      ...friendMarkerPosts.map((post) => ({
        latitude: post.latitude,
        longitude: post.longitude,
      })),
    ];

    if (!hasAppliedInitialViewportRef.current && fitCoordinates.length > 0) {
      if (fitCoordinates.length > 1) {
        mapRef.current.fitToCoordinates(
          fitCoordinates,
          {
            edgePadding: { top: 150, right: 90, bottom: 210, left: 90 },
            animated: false,
          }
        );
        hasAppliedInitialViewportRef.current = true;
        return;
      }

      const [coordinate] = fitCoordinates;
      const baseRegion = settledRegion ?? visibleRegion ?? initialRegion;
      animateToRegion(
        {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: Math.max(
            MIN_ZOOM_DELTA,
            Math.min(baseRegion.latitudeDelta, RECENTER_BUTTON_ZOOM_DELTA)
          ),
          longitudeDelta: Math.max(
            MIN_ZOOM_DELTA,
            Math.min(baseRegion.longitudeDelta, RECENTER_BUTTON_ZOOM_DELTA)
          ),
        },
        0
      );
      hasAppliedInitialViewportRef.current = true;
      return;
    }

    if (fitCoordinates.length > 0 || !location || hasCenteredOnLocationRef.current) {
      return;
    }

    const baseRegion = settledRegion ?? visibleRegion ?? initialRegion;
    if (
      isCoordinateCenteredInRegion(
        baseRegion,
        location.coords.latitude,
        location.coords.longitude
      )
    ) {
      hasCenteredOnLocationRef.current = true;
      return;
    }

    animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: Math.max(
          MIN_ZOOM_DELTA,
          Math.min(baseRegion.latitudeDelta, RECENTER_BUTTON_ZOOM_DELTA)
        ),
        longitudeDelta: Math.max(
          MIN_ZOOM_DELTA,
          Math.min(baseRegion.longitudeDelta, RECENTER_BUTTON_ZOOM_DELTA)
        ),
      },
      0
    );
    hasCenteredOnLocationRef.current = true;
  }, [
    animateToRegion,
    friendMarkerPosts,
    initialRegion,
    isMapReady,
    location,
    mapUiReady,
    notes,
    settledRegion,
    visibleRegion,
  ]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Prevent native tabs from auto-adjusting MapKit's internal scroll view on iOS. */}
      <View pointerEvents="none" style={styles.scrollInsetGuard} />
      <MapCanvas
        mapRef={mapRef}
        initialRegion={initialRegion}
        isDark={isDark}
        currentZoom={currentZoom}
        markerNodes={clusterNodes}
        friendMarkers={friendMarkerPosts}
        noteById={noteById}
        selectedGroupId={selectedGroupId}
        selectedGroup={selectedGroup}
        selectedNote={selectedNote}
        selectedFriendPostId={activeFriendPostId}
        markerPulseId={markerPulseId}
        markerPulseKey={markerPulseKey}
        saveTargetCoordinate={saveTarget}
        reduceMotionEnabled={reduceMotionEnabled}
        onMapPress={handleMapCanvasPress}
        onMapLongPress={handleMapCanvasLongPress}
        onMapReady={() => {
          setIsMapReady(true);
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
        onLeafPress={handleLeafPress}
        onNotePress={handleSeparatedNotePress}
        onClusterPress={handleClusterPress}
        onFriendPress={handleFriendMarkerPress}
        colors={colors}
      />

      <View style={[styles.topHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
        <MapFilterBar
          filterState={filterState}
          onChangeType={handleChangeFilterType}
          onToggleFavorites={handleToggleFavorites}
          onClearFilters={handleClearActiveFilters}
          onInteraction={emitLightHaptic}
          hasActiveFilters={hasActiveFilters}
          reduceMotionEnabled={reduceMotionEnabled}
          friendsChip={
            hasFriendLayer
              ? {
                  active: friendsPreviewVisible,
                  label: t('map.friendsChip', 'Friends'),
                  onPress: handleOpenFriendsLayer,
                  testID: 'map-friends-chip',
                }
              : null
          }
        />
      </View>

      <Reanimated.View
        testID="map-recenter-wrapper"
        style={[styles.fabContainer, recenterFabAnimatedStyle]}
      >
        <Pressable
          accessibilityHint={t('map.recenterHint', 'Center the map on your current location')}
          accessibilityLabel={t('map.recenter', 'Recenter map')}
          accessibilityRole="button"
          testID="map-recenter"
          onPress={goToMyLocation}
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
        >
          <View
            style={[
              styles.fab,
              Platform.OS === 'android'
                ? {
                    borderWidth: 1,
                    borderColor: getOverlayBorderColor(isDark, colors),
                    backgroundColor: getOverlayFallbackColor(isDark, colors),
                    shadowColor: colors.androidTabShellShadow,
                  }
                : null,
              Platform.OS === 'android' ? styles.androidFabShadow : null,
            ]}
          >
            <GlassView
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              glassEffectStyle="regular"
              colorScheme={isDark ? 'dark' : 'light'}
              fallbackColor="transparent"
              tintColor={colors.glassOverlaySurface}
            />
            {Platform.OS === 'android' ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: mapOverlayTokens.floatingButtonSize / 2,
                    backgroundColor: getOverlayScrimColor(isDark, colors),
                  },
                ]}
              />
            ) : null}
            {isOlderIOS ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: mapOverlayTokens.floatingButtonSize / 2,
                    backgroundColor: getOverlayFallbackColor(isDark, colors),
                  },
                ]}
              />
            ) : null}
            <Ionicons name="location" size={20} color={colors.primary} />
          </View>
        </Pressable>
      </Reanimated.View>

      {mapUiReady && notesPreviewVisible && !friendsPreviewVisible ? (
        <MapPreviewCard
          previewMode={previewMode}
          visible={bottomOverlayVisible}
          selectedGroup={selectedGroup}
          selectedNoteIndex={selectedNoteIndex}
          nearbyItems={nearbyPreviewItems}
          activeNearbyNoteId={activeNearbyNoteId}
          activeNoteReadyToOpen={activeNoteReadyToOpen}
          bottomOffset={previewBottomOffset}
          onFocusPreviewNote={focusPreviewNote}
          onOpenPreviewNote={openNote}
          onPrimaryAction={handlePreviewPrimaryAction}
          onDismiss={handleDismissNotesPreview}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
          externalExpansionProgress={previewExpansionProgress}
        />
      ) : null}

      {mapUiReady && isStatusOverlay && !friendsPreviewVisible ? (
        <MapStatusCard
          visible={bottomOverlayVisible}
          bottomOffset={previewBottomOffset}
          title={
            bottomOverlayKind === 'no-notes'
              ? t('map.emptyTitleShort', 'No notes')
              : bottomOverlayKind === 'filtered-empty'
                ? t('map.filteredEmptyTitle', 'No notes match these filters')
                : undefined
          }
          subtitle={
            bottomOverlayKind === 'filtered-empty'
              ? t(
                  'map.filteredEmptySubtitle',
                  'Try another filter combination or reset to view all notes'
                )
              : undefined
          }
          icon={
            bottomOverlayKind === 'no-notes'
              ? 'pin-outline'
              : bottomOverlayKind === 'filtered-empty'
                ? 'filter-outline'
                : bottomOverlayKind === 'area-empty'
                  ? 'compass-outline'
                : 'albums-outline'
          }
          actionLabel={
            bottomOverlayKind === 'save-here'
              ? t('map.saveHere', 'Save here')
              : bottomOverlayKind === 'filtered-empty'
              ? t('map.clearFilters', 'Clear filters')
              : bottomOverlayKind === 'area-empty'
                ? t('map.showAllResults', 'Show all results')
              : bottomOverlayKind === 'collapsed'
                ? t('map.showPreview', 'Nearby notes')
              : undefined
          }
          actionIcon={
            bottomOverlayKind === 'save-here'
              ? 'add-circle-outline'
              : bottomOverlayKind === 'filtered-empty'
              ? 'close-circle-outline'
              : bottomOverlayKind === 'area-empty'
                ? 'map-outline'
              : bottomOverlayKind === 'collapsed'
                ? 'chevron-up'
                : undefined
          }
          actionTestID={
            bottomOverlayKind === 'save-here'
              ? 'map-save-here'
              : bottomOverlayKind === 'filtered-empty'
              ? 'map-clear-filters'
              : bottomOverlayKind === 'area-empty'
                ? 'map-show-all-results'
              : bottomOverlayKind === 'collapsed'
                ? 'map-show-preview'
                : undefined
          }
          onAction={() => {
            if (bottomOverlayKind === 'save-here') {
              handleSaveAtTarget();
              return;
            }

            if (bottomOverlayKind === 'filtered-empty') {
              handleClearActiveFilters();
              return;
            }

            if (bottomOverlayKind === 'area-empty') {
              fitToFilteredResults();
              return;
            }

            if (bottomOverlayKind === 'collapsed') {
              revealNotesPreview();
            }
          }}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      {mapUiReady && friendsPreviewVisible ? (
        <MapFriendsPreviewCard
          visible={friendsPreviewVisible}
          posts={friendPosts}
          activePostId={activeFriendPostId}
          activePostReadyToOpen={activeFriendPostReadyToOpen}
          bottomOffset={previewBottomOffset}
          onOpen={handleOpenSharedPost}
          onDismiss={handleDismissFriendsPreview}
          onFocusPost={(postId) => focusFriendPost(postId)}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
          externalExpansionProgress={previewExpansionProgress}
        />
      ) : null}

      <View
        testID="map-overlay-host"
        style={[
          styles.emptyOverlay,
          {
            paddingTop: insets.top + 72,
            paddingBottom: previewBottomOffset,
          },
        ]}
        pointerEvents="none"
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollInsetGuard: {
    ...StyleSheet.absoluteFill,
  },
  fabContainer: {
    position: 'absolute',
    right: 14,
    zIndex: 12,
  },
  fab: {
    width: mapOverlayTokens.floatingButtonSize,
    height: mapOverlayTokens.floatingButtonSize,
    borderRadius: mapOverlayTokens.floatingButtonSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    ...mapOverlayTokens.overlayShadow,
  },
  topHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 12,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 9,
  },
  androidFabShadow: {
    ...Shadows.androidChrome,
  },
});
