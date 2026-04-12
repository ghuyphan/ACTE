import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import * as Haptics from '../../hooks/useHaptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../map/MapCanvas';
import MapFilterBar from '../map/MapFilterBar';
import MapFriendsPreviewCard from '../map/MapFriendsPreviewCard';
import MapPreviewCard from '../map/MapPreviewCard';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayMutedFillColor,
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
import { isOlderIOS } from '../../utils/platform';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';
import { Shadows } from '../../constants/theme';

const MIN_ZOOM_DELTA = 0.002;
const PROGRAMMATIC_REGION_TOLERANCE = 0.0005;
const PREVIEW_FOCUS_REGION_GUARD_MS = 900;
const HEAVY_MAP_WARMUP_DATASET_SIZE = 24;

type MapRegionChangeDetails = {
  isGesture?: boolean;
};

type OverlayState = 'content' | 'no-filter-results' | 'no-notes';

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
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const hasCenteredRef = useRef(false);
  const markerPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    selectNoteById,
    clusterNodes,
    nearbyItems,
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
  const {
    activeFriendPostId,
    activeNearbyNoteId,
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
  const distanceAnchor = useMemo(() => {
    if (activePreviewNote) {
      return {
        latitude: activePreviewNote.latitude,
        longitude: activePreviewNote.longitude,
      };
    }

    if (settledRegion) {
      return {
        latitude: settledRegion.latitude,
        longitude: settledRegion.longitude,
      };
    }

    if (visibleRegion) {
      return {
        latitude: visibleRegion.latitude,
        longitude: visibleRegion.longitude,
      };
    }

    if (location) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }

    return {
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
    };
  }, [
    activePreviewNote,
    initialRegion.latitude,
    initialRegion.longitude,
    location,
    settledRegion,
    visibleRegion,
  ]);
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
  const friendsPreviewVisible = showFriendsPreview && friendPosts.length > 0;
  const hasFriendLayer = sharedEnabled && friendPosts.length > 0;
  const hasOwnNotes = notes.length > 0;
  const hasPreviewItems = selectedGroup ? selectedGroup.notes.length > 0 : nearbyPreviewItems.length > 0;
  const overlayState: OverlayState =
    !mapUiReady
      ? 'content'
      : !hasOwnNotes
      ? 'no-notes'
      : notes.length > 0 && filteredCount === 0
        ? 'no-filter-results'
        : 'content';
  const overlayShowsNotesPreview =
    mapUiReady &&
    hasPreviewItems &&
    (overlayState === 'content' || notesPreviewPersistsWhenAreaEmpty);
  const bottomOverlayKind: 'hidden' | 'preview' | 'collapsed' | 'filtered-empty' | 'no-notes' =
    !mapUiReady || friendsPreviewVisible
      ? 'hidden'
      : overlayShowsNotesPreview && notesPreviewVisibility === 'visible'
        ? 'preview'
        : overlayShowsNotesPreview && notesPreviewVisibility === 'collapsed'
          ? 'collapsed'
          : overlayState === 'no-notes'
            ? 'no-notes'
            : overlayState === 'no-filter-results'
              ? 'filtered-empty'
              : 'hidden';
  const bottomOverlayVisible = bottomOverlayKind !== 'hidden';
  const isStatusOverlay =
    bottomOverlayKind === 'collapsed' ||
    bottomOverlayKind === 'filtered-empty' ||
    bottomOverlayKind === 'no-notes';

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
    resetToNearbyPreview();
    handleMapPress();
  }, [handleMapPress, resetToNearbyPreview]);

  const handleChangeFilterType = useCallback(
    (nextType: Parameters<typeof setFilterType>[0]) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      revealNotesPreview({ resetToNearby: true });
      setFilterType(nextType);
    },
    [revealNotesPreview, setFilterType]
  );

  const handleToggleFavorites = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
    revealNotesPreview({ resetToNearby: true });
    toggleFavoritesOnly();
  }, [revealNotesPreview, toggleFavoritesOnly]);

  const goToMyLocation = useCallback(async () => {
    let target = location;
    if (!target) {
      const result = await requestForegroundLocation();
      target = result.location;
      if (!target && result.requiresSettings) {
        await openAppSettings();
        return;
      }
    }

    if (target && mapRef.current) {
      const nextRegion = {
        latitude: target.coords.latitude,
        longitude: target.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 450);
      emitLightHaptic();
    }
  }, [
    animateToRegion,
    emitLightHaptic,
    location,
    openAppSettings,
    reduceMotionEnabled,
    requestForegroundLocation,
  ]);

  const handleClusterPress = useCallback(
    (node: MapClusterNode) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
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

  const handleLeafPress = useCallback(
    (groupId: string) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      resetToNearbyPreview();
      closeFriendsPreview();
      triggerMarkerPulse(groupId);
      handleLeafMarkerPress(groupId);
      emitLightHaptic();

      if (notesPreviewVisibility === 'collapsed') {
        revealNotesPreview();
      }
    },
    [
      closeFriendsPreview,
      emitLightHaptic,
      handleLeafMarkerPress,
      notesPreviewVisibility,
      revealNotesPreview,
      triggerMarkerPulse,
      resetToNearbyPreview,
    ]
  );

  const handleSeparatedNotePress = useCallback(
    (noteId: string) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
      resetToNearbyPreview();
      closeFriendsPreview();
      triggerMarkerPulse(noteId);
      selectNoteById(noteId);
      emitLightHaptic();

      if (notesPreviewVisibility === 'collapsed') {
        revealNotesPreview();
      }
    },
    [
      closeFriendsPreview,
      emitLightHaptic,
      notesPreviewVisibility,
      revealNotesPreview,
      selectNoteById,
      triggerMarkerPulse,
      resetToNearbyPreview,
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
    collapseNotesPreview();
  }, [collapseNotesPreview, emitLightHaptic]);

  const handleDismissFriendsPreview = useCallback(() => {
    emitLightHaptic();
    closeFriendsPreview();
  }, [closeFriendsPreview, emitLightHaptic]);

  const focusFriendPost = useCallback(
    (postId: string, options?: { animate?: boolean; openPreview?: boolean }) => {
      nearbyPreviewFocusGuardUntilRef.current = 0;
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
          setTimeout(() => {
            openFriendsPreview();
          }, 150);
        } else {
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
    if (!mapUiReady || !isMapReady || hasCenteredRef.current || !mapRef.current) {
      return;
    }

    if (location) {
      hasCenteredRef.current = true;
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

    if (fitCoordinates.length > 1) {
      mapRef.current.fitToCoordinates(
        fitCoordinates,
        {
          edgePadding: { top: 150, right: 90, bottom: 210, left: 90 },
          animated: false,
        }
      );
      hasCenteredRef.current = true;
      return;
    }

    hasCenteredRef.current = true;
  }, [friendMarkerPosts, isMapReady, location, mapUiReady, notes]);

  const countLabel = useMemo(() => {
    const base = `${filteredCount} ${filteredCount === 1 ? t('map.note', 'note') : t('map.notes', 'notes')}`;
    const suffixes: string[] = [];

    if (hasActiveFilters) {
      suffixes.push(t('map.filteredLabel', 'filtered'));
    }

    return suffixes.length > 0 ? `${base} · ${suffixes.join(' · ')}` : base;
  }, [filteredCount, hasActiveFilters, t]);

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
        reduceMotionEnabled={reduceMotionEnabled}
        onMapPress={handleMapCanvasPress}
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
          countLabel={countLabel}
          onChangeType={handleChangeFilterType}
          onToggleFavorites={handleToggleFavorites}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
          headerAccessory={
            hasFriendLayer ? (
              <Pressable
                testID="map-friends-chip"
                onPress={handleOpenFriendsLayer}
                style={({ pressed }) => [
                  styles.friendsChipPressable,
                  {
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.friendsChip,
                    {
                      borderColor:
                        Platform.OS === 'android'
                          ? friendsPreviewVisible
                            ? colors.androidTabShellSelectedBorder
                            : colors.androidTabShellMutedBorder
                          : friendsPreviewVisible
                            ? `${colors.primary}55`
                            : getOverlayBorderColor(isDark),
                      backgroundColor: friendsPreviewVisible
                        ? Platform.OS === 'android'
                          ? colors.androidTabShellSelectedBackground
                          : isDark
                            ? 'rgba(255,193,7,0.16)'
                            : 'rgba(255,193,7,0.14)'
                        : Platform.OS === 'android'
                          ? colors.androidTabShellMutedBackground
                          : getOverlayMutedFillColor(isDark),
                      shadowColor: Platform.OS === 'android' ? colors.androidTabShellShadow : undefined,
                    },
                  ]}
                >
                  <GlassView
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    glassEffectStyle="regular"
                    colorScheme={isDark ? 'dark' : 'light'}
                    fallbackColor="transparent"
                  />
                  {isOlderIOS ? (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 16,
                          backgroundColor: friendsPreviewVisible
                            ? (isDark ? 'rgba(48,38,12,0.72)' : 'rgba(255,247,214,0.92)')
                            : getOverlayFallbackColor(isDark),
                        },
                      ]}
                    />
                  ) : null}

                  <View style={styles.friendsChipInner}>
                    <Ionicons
                      name={friendsPreviewVisible ? 'sparkles' : 'sparkles-outline'}
                      size={13}
                      color={Platform.OS === 'android' && !friendsPreviewVisible ? colors.androidTabShellActive : colors.primary}
                    />
                    <Text
                      style={[
                        styles.friendsChipLabel,
                        {
                          color:
                            Platform.OS === 'android'
                              ? friendsPreviewVisible
                                ? colors.primary
                                : colors.androidTabShellActive
                              : friendsPreviewVisible
                                ? colors.primary
                                : colors.text,
                        },
                      ]}
                    >
                      {t('map.friendsChip', 'Friends')}
                    </Text>
                    {friendsPreviewVisible ? (
                      <View
                        style={[
                          styles.friendsChipActiveDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ) : null
          }
        />
      </View>

      <View testID="map-recenter-wrapper" style={[styles.fabContainer, { top: insets.top + 20 }]}>
        <Pressable
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
                    borderColor: getOverlayBorderColor(isDark),
                    backgroundColor: getOverlayFallbackColor(isDark),
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
            />
            {Platform.OS === 'android' ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: mapOverlayTokens.floatingButtonSize / 2,
                    backgroundColor: getOverlayScrimColor(isDark),
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
                    backgroundColor: getOverlayFallbackColor(isDark),
                  },
                ]}
              />
            ) : null}
            <Ionicons name="location" size={20} color={colors.primary} />
          </View>
        </Pressable>
      </View>

      {mapUiReady &&
      (notes.length > 0 || bottomOverlayKind === 'no-notes') &&
      !friendsPreviewVisible ? (
        <MapPreviewCard
          mode={isStatusOverlay ? 'status' : 'preview'}
          previewMode={previewMode}
          visible={bottomOverlayVisible}
          selectedGroup={selectedGroup}
          selectedNoteIndex={selectedNoteIndex}
          nearbyItems={nearbyPreviewItems}
          activeNearbyNoteId={activeNearbyNoteId}
          activeNoteReadyToOpen={activeNoteReadyToOpen}
          distanceAnchor={distanceAnchor}
          bottomOffset={previewBottomOffset}
          statusTitle={
            bottomOverlayKind === 'no-notes'
              ? t('map.emptyTitleShort', 'No notes')
              : bottomOverlayKind === 'filtered-empty'
              ? t('map.filteredEmptyTitle', 'No notes match these filters')
              : undefined
          }
          statusSubtitle={
            bottomOverlayKind === 'no-notes'
              ? undefined
              : bottomOverlayKind === 'filtered-empty'
              ? t(
                  'map.filteredEmptySubtitle',
                  'Try another filter combination or reset to view all notes'
                )
              : undefined
          }
          statusIcon={
            bottomOverlayKind === 'no-notes'
              ? 'pin-outline'
              : bottomOverlayKind === 'filtered-empty'
                ? 'filter-outline'
                : 'albums-outline'
          }
          statusActionLabel={
            bottomOverlayKind === 'no-notes'
              ? undefined
              : bottomOverlayKind === 'filtered-empty'
              ? t('map.clearFilters', 'Clear filters')
              : bottomOverlayKind === 'collapsed'
              ? t('map.showPreview', 'Show preview')
              : undefined
          }
          statusActionTestID={
            bottomOverlayKind === 'no-notes'
              ? undefined
              : bottomOverlayKind === 'filtered-empty'
              ? 'map-clear-filters'
              : bottomOverlayKind === 'collapsed'
                ? 'map-show-preview'
                : undefined
          }
          onStatusAction={() => {
            if (bottomOverlayKind === 'no-notes') {
              return;
            }

            if (bottomOverlayKind === 'filtered-empty') {
              revealNotesPreview({ resetToNearby: true });
              clearFilters();
              return;
            }

            if (bottomOverlayKind === 'collapsed') {
              revealNotesPreview();
            }
          }}
          onStatusExpand={
            bottomOverlayKind === 'collapsed'
              ? () => {
                  revealNotesPreview();
                }
              : undefined
          }
          onFocusPreviewNote={focusPreviewNote}
          onActivatePreviewNote={handleActivatePreviewNote}
          onPrimaryAction={handlePreviewPrimaryAction}
          onDismiss={handleDismissNotesPreview}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      {mapUiReady && friendsPreviewVisible ? (
        <MapFriendsPreviewCard
          visible={friendsPreviewVisible}
          posts={friendPosts}
          activePostId={activeFriendPostId}
          bottomOffset={previewBottomOffset}
          onOpen={() => handleOpenSharedPost()}
          onDismiss={handleDismissFriendsPreview}
          onFocusPost={(postId) => focusFriendPost(postId)}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
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
    right: 72,
    zIndex: 12,
  },
  friendsChipPressable: {
    alignSelf: 'flex-start',
  },
  friendsChip: {
    minHeight: mapOverlayTokens.controlHeight,
    borderRadius: mapOverlayTokens.overlayCompactRadius,
    overflow: 'hidden',
    borderWidth: 1,
  },
  friendsChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  friendsChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  friendsChipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
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
