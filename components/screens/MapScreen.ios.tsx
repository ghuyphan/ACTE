import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type MapView from 'react-native-maps';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../map/MapCanvas';
import MapFilterBar from '../map/MapFilterBar';
import MapFriendsPreviewCard from '../map/MapFriendsPreviewCard';
import { getMapLayoutTransition, mapMotionPressTiming } from '../map/mapMotion';
import MapPreviewCard from '../map/MapPreviewCard';
import MapStatusCard from '../map/MapStatusCard';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from '../map/overlayTokens';
import { useAuth } from '../../hooks/useAuth';
import type { MapClusterNode } from '../../hooks/map/mapDomain';
import { regionToZoom } from '../../hooks/map/mapDomain';
import { useMapScreenState } from '../../hooks/map/useMapScreenState';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

const MIN_ZOOM_DELTA = 0.002;

type OverlayState = 'content' | 'no-filter-results' | 'no-notes';

export default function MapScreenIOS() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReducedMotion();
  const { user } = useAuth();
  const { notes, loading } = useNotesStore();
  const { enabled: sharedEnabled, sharedPosts } = useSharedFeedStore();
  const { location, requestForegroundLocation, openAppSettings } = useGeofence();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [activeNearbyNoteId, setActiveNearbyNoteId] = useState<string | null>(null);
  const [markerPulseId, setMarkerPulseId] = useState<string | null>(null);
  const [markerPulseKey, setMarkerPulseKey] = useState(0);
  const [showFriendsPreview, setShowFriendsPreview] = useState(false);
  const [activeFriendPostId, setActiveFriendPostId] = useState<string | null>(null);
  const [showFriendsScan, setShowFriendsScan] = useState(false);
  const hasCenteredRef = useRef(false);
  const markerPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const friendsScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabScale = useSharedValue(1);
  const friendsScanProgress = useSharedValue(0);

  const {
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
    selectedNoteIndex,
    handleLeafMarkerPress,
    handleClusterMarkerPress,
    handleMapPress,
    selectNoteById,
    clusterNodes,
    nearbyItems,
    filteredCount,
    hasActiveFilters,
  } = useMapScreenState({ notes, location });

  const previewBottomOffset = insets.bottom + 12;
  const previewMode = selectedGroup ? 'group' : 'nearby';
  const overlayState: OverlayState =
    notes.length === 0 ? 'no-notes' : filteredCount === 0 ? 'no-filter-results' : 'content';
  const previewVisible = overlayState === 'content' && nearbyItems.length > 0;
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note] as const)), [notes]);
  const friendPosts = useMemo(
    () =>
      sharedPosts
        .filter((post) => post.authorUid !== user?.uid)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sharedPosts, user?.uid]
  );
  const friendsPreviewVisible = showFriendsPreview && friendPosts.length > 0;
  const hasFriendLayer = sharedEnabled && friendPosts.length > 0;

  useEffect(() => {
    return () => {
      if (markerPulseTimerRef.current) {
        clearTimeout(markerPulseTimerRef.current);
      }
      if (friendsScanTimeoutRef.current) {
        clearTimeout(friendsScanTimeoutRef.current);
      }
    };
  }, []);

  const emitLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const activeNearbyItem = useMemo(() => {
    if (nearbyItems.length === 0) {
      return null;
    }

    if (activeNearbyNoteId) {
      return nearbyItems.find((item) => item.note.id === activeNearbyNoteId) ?? nearbyItems[0];
    }

    return nearbyItems[0];
  }, [activeNearbyNoteId, nearbyItems]);

  useEffect(() => {
    if (nearbyItems.length === 0) {
      if (activeNearbyNoteId !== null) {
        setActiveNearbyNoteId(null);
      }
      return;
    }

    if (activeNearbyNoteId && nearbyItems.some((item) => item.note.id === activeNearbyNoteId)) {
      return;
    }

    setActiveNearbyNoteId(nearbyItems[0].note.id);
  }, [activeNearbyNoteId, nearbyItems]);

  useEffect(() => {
    if (!friendPosts.length) {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
      if (activeFriendPostId !== null) {
        setActiveFriendPostId(null);
      }
      return;
    }

    if (activeFriendPostId && friendPosts.some((post) => post.id === activeFriendPostId)) {
      return;
    }

    setActiveFriendPostId(friendPosts[0].id);
  }, [activeFriendPostId, friendPosts, showFriendsPreview]);

  const handleOpenPreview = useCallback(() => {
    if (selectedNote) {
      openNote(selectedNote.id);
      return;
    }

    if (activeNearbyItem) {
      openNote(activeNearbyItem.note.id);
    }
  }, [activeNearbyItem, openNote, selectedNote]);

  const handleMapCanvasPress = useCallback(() => {
    if (showFriendsPreview) {
      setShowFriendsPreview(false);
    }
    handleMapPress();
  }, [handleMapPress, showFriendsPreview]);

  const handleChangeFilterType = useCallback(
    (nextType: Parameters<typeof setFilterType>[0]) => {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
      setFilterType(nextType);
    },
    [setFilterType, showFriendsPreview]
  );

  const handleToggleFavorites = useCallback(() => {
    if (showFriendsPreview) {
      setShowFriendsPreview(false);
    }
    toggleFavoritesOnly();
  }, [showFriendsPreview, toggleFavoritesOnly]);

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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 450);
      setVisibleRegion(nextRegion);
      emitLightHaptic();
    }
  }, [
    emitLightHaptic,
    location,
    openAppSettings,
    reduceMotionEnabled,
    requestForegroundLocation,
    setVisibleRegion,
  ]);

  const handleClusterPress = useCallback(
    (node: MapClusterNode) => {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 350);
      setVisibleRegion(nextRegion);
    },
    [
      emitLightHaptic,
      handleClusterMarkerPress,
      initialRegion,
      reduceMotionEnabled,
      setVisibleRegion,
      showFriendsPreview,
      triggerMarkerPulse,
      visibleRegion,
    ]
  );

  const handleLeafPress = useCallback(
    (groupId: string) => {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
      triggerMarkerPulse(groupId);
      handleLeafMarkerPress(groupId);
      emitLightHaptic();
    },
    [emitLightHaptic, handleLeafMarkerPress, showFriendsPreview, triggerMarkerPulse]
  );

  const handleFocusNearbyNote = useCallback(
    (noteId: string) => {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
      const nearbyItem = nearbyItems.find((item) => item.note.id === noteId);
      if (!nearbyItem) {
        return;
      }

      setActiveNearbyNoteId(noteId);

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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 350);
      setVisibleRegion(nextRegion);
    },
    [initialRegion, nearbyItems, reduceMotionEnabled, setVisibleRegion, showFriendsPreview, visibleRegion]
  );

  const triggerFriendsScan = useCallback(() => {
    if (friendsScanTimeoutRef.current) {
      clearTimeout(friendsScanTimeoutRef.current);
    }

    if (reduceMotionEnabled) {
      return;
    }

    setShowFriendsScan(true);
    friendsScanProgress.value = 0;
    friendsScanProgress.value = withTiming(1, { duration: 860 });

    friendsScanTimeoutRef.current = setTimeout(() => {
      setShowFriendsScan(false);
      friendsScanProgress.value = 0;
      friendsScanTimeoutRef.current = null;
    }, 900);
  }, [friendsScanProgress, reduceMotionEnabled]);

  const handleOpenFriendsLayer = useCallback(() => {
    if (!hasFriendLayer) {
      return;
    }

    emitLightHaptic();
    triggerFriendsScan();
    setShowFriendsPreview((current) => !current);
    setActiveFriendPostId((current) => current ?? friendPosts[0]?.id ?? null);
  }, [emitLightHaptic, friendPosts, hasFriendLayer, triggerFriendsScan]);

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
    if (!isMapReady || hasCenteredRef.current || !mapRef.current) {
      return;
    }

    if (location) {
      hasCenteredRef.current = true;
      return;
    }

    if (notes.length > 1) {
      mapRef.current.fitToCoordinates(
        notes.map((note) => ({
          latitude: note.latitude,
          longitude: note.longitude,
        })),
        {
          edgePadding: { top: 150, right: 90, bottom: 210, left: 90 },
          animated: false,
        }
      );
      hasCenteredRef.current = true;
      return;
    }

    hasCenteredRef.current = true;
  }, [isMapReady, location, notes]);

  const countLabel = useMemo(() => {
    const base = `${filteredCount} ${filteredCount === 1 ? t('map.note', 'note') : t('map.notes', 'notes')}`;
    if (!hasActiveFilters) {
      return base;
    }

    return `${base} · ${t('map.filteredLabel', 'filtered')}`;
  }, [filteredCount, hasActiveFilters, t]);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));
  const friendsScanBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(friendsScanProgress.value, [0, 0.08, 1], [0, 0.22, 0]),
  }));
  const friendsScanRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(friendsScanProgress.value, [0, 0.16, 1], [0, 0.24, 0]),
    transform: [{ scale: interpolate(friendsScanProgress.value, [0, 1], [0.7, 2.8]) }],
  }));
  const friendsScanCoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(friendsScanProgress.value, [0, 0.2, 1], [0, 0.18, 0]),
    transform: [{ scale: interpolate(friendsScanProgress.value, [0, 1], [0.82, 1.7]) }],
  }));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapCanvas
        mapRef={mapRef}
        initialRegion={initialRegion}
        isDark={isDark}
        currentZoom={visibleRegion ? regionToZoom(visibleRegion) : regionToZoom(initialRegion)}
        markerNodes={clusterNodes}
        noteById={noteById}
        selectedGroupId={selectedGroupId}
        markerPulseId={markerPulseId}
        markerPulseKey={markerPulseKey}
        reduceMotionEnabled={reduceMotionEnabled}
        onMapPress={handleMapCanvasPress}
        onMapReady={() => {
          setIsMapReady(true);
          setVisibleRegion(initialRegion);
        }}
        onRegionChangeComplete={setVisibleRegion}
        onLeafPress={handleLeafPress}
        onClusterPress={handleClusterPress}
        colors={colors}
      />

      <Reanimated.View
        style={[styles.topHeader, { top: insets.top + 8 }]}
        pointerEvents="box-none"
        layout={getMapLayoutTransition(reduceMotionEnabled)}
      >
        <MapFilterBar
          filterState={filterState}
          countLabel={countLabel}
          onChangeType={handleChangeFilterType}
          onToggleFavorites={handleToggleFavorites}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />

        {hasFriendLayer ? (
          <Pressable
            testID="map-friends-chip"
            onPress={handleOpenFriendsLayer}
            style={({ pressed }) => [
              styles.friendsChipPressable,
              {
                opacity: pressed ? 0.94 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <View style={[styles.friendsChip, { borderColor: getOverlayBorderColor(isDark) }]}>
              <GlassView
                pointerEvents="none"
                style={StyleSheet.absoluteFillObject}
                glassEffectStyle="regular"
                colorScheme={isDark ? 'dark' : 'light'}
              />
              {isOlderIOS ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 18,
                      backgroundColor: getOverlayFallbackColor(isDark),
                    },
                  ]}
                />
              ) : null}

              <View style={styles.friendsChipInner}>
                <View style={[styles.friendsChipIconWrap, { backgroundColor: `${colors.primary}20` }]}>
                  <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.friendsChipLabel, { color: colors.text }]}>
                  {t('map.friendsChip', 'Friends')}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}
      </Reanimated.View>

      <Reanimated.View
        testID="map-recenter-wrapper"
        style={[styles.fabContainer, { top: insets.top + 20 }, fabAnimatedStyle]}
        layout={getMapLayoutTransition(reduceMotionEnabled)}
      >
        <Pressable
          testID="map-recenter"
          onPress={goToMyLocation}
          onPressIn={() => {
            fabScale.value = withTiming(0.95, mapMotionPressTiming);
          }}
          onPressOut={() => {
            fabScale.value = withTiming(1, mapMotionPressTiming);
          }}
        >
          <View style={[styles.fab, { borderColor: getOverlayBorderColor(isDark) }]}>
            <GlassView
              pointerEvents="none"
              style={StyleSheet.absoluteFillObject}
              glassEffectStyle="regular"
              colorScheme={isDark ? 'dark' : 'light'}
            />
            {isOlderIOS ? (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    borderRadius: 22,
                    backgroundColor: getOverlayFallbackColor(isDark),
                  },
                ]}
              />
            ) : null}
            <Ionicons name="location" size={20} color={colors.primary} />
          </View>
        </Pressable>
      </Reanimated.View>

      {notes.length > 0 && !friendsPreviewVisible ? (
        <MapPreviewCard
          previewMode={previewMode}
          visible={previewVisible}
          selectedGroup={selectedGroup}
          selectedNoteIndex={selectedNoteIndex}
          nearbyItems={nearbyItems}
          activeNearbyNoteId={activeNearbyNoteId}
          bottomOffset={previewBottomOffset}
          onOpen={handleOpenPreview}
          onFocusNearbyNote={handleFocusNearbyNote}
          onFocusGroupNote={selectNoteById}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      {friendsPreviewVisible ? (
        <MapFriendsPreviewCard
          visible={friendsPreviewVisible}
          posts={friendPosts}
          activePostId={activeFriendPostId}
          bottomOffset={previewBottomOffset}
          onOpen={() => handleOpenSharedPost()}
          onFocusPost={setActiveFriendPostId}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      <Reanimated.View
        testID="map-overlay-host"
        style={styles.emptyOverlay}
        pointerEvents={overlayState === 'content' || friendsPreviewVisible ? 'none' : 'box-none'}
        layout={getMapLayoutTransition(reduceMotionEnabled)}
      >
        {overlayState === 'no-notes' && !friendsPreviewVisible ? (
          <MapStatusCard
            overlayState="no-notes"
            isDark={isDark}
            primaryColor={colors.primary}
            textColor={colors.text}
            secondaryTextColor={colors.secondaryText}
            onClearFilters={clearFilters}
            reduceMotionEnabled={reduceMotionEnabled}
            title={t('map.emptyTitle', 'No notes on the map yet')}
            subtitle={t('map.emptySubtitle', 'Your saved notes will appear as pins here')}
            clearLabel={t('map.clearFilters', 'Clear filters')}
          />
        ) : null}

        {overlayState === 'no-filter-results' && !friendsPreviewVisible ? (
          <MapStatusCard
            overlayState="no-filter-results"
            isDark={isDark}
            primaryColor={colors.primary}
            textColor={colors.text}
            secondaryTextColor={colors.secondaryText}
            onClearFilters={() => {
              emitLightHaptic();
              clearFilters();
            }}
            reduceMotionEnabled={reduceMotionEnabled}
            title={t('map.filteredEmptyTitle', 'No notes match these filters')}
            subtitle={t(
              'map.filteredEmptySubtitle',
              'Try another filter combination or reset to view all notes'
            )}
            clearLabel={t('map.clearFilters', 'Clear filters')}
          />
        ) : null}
      </Reanimated.View>

      {showFriendsScan ? (
        <View testID="map-friends-scan" pointerEvents="none" style={styles.scanOverlay}>
          <Reanimated.View
            style={[
              styles.scanBackdrop,
              { backgroundColor: isDark ? 'rgba(10,12,18,0.14)' : 'rgba(255,248,230,0.18)' },
              friendsScanBackdropStyle,
            ]}
          />
          <Reanimated.View
            style={[
              styles.scanRing,
              { borderColor: `${colors.primary}66` },
              friendsScanRingStyle,
            ]}
          />
          <Reanimated.View
            style={[
              styles.scanCore,
              { backgroundColor: `${colors.primary}24` },
              friendsScanCoreStyle,
            ]}
          />
        </View>
      ) : null}

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
  fabContainer: {
    position: 'absolute',
    right: 14,
    zIndex: 12,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    ...mapOverlayTokens.overlayShadow,
  },
  topHeader: {
    position: 'absolute',
    left: 14,
    right: 72,
    zIndex: 12,
    gap: 10,
  },
  friendsChipPressable: {
    alignSelf: 'flex-start',
  },
  friendsChip: {
    minHeight: 38,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    ...mapOverlayTokens.overlayShadow,
  },
  friendsChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  friendsChipIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scanBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  scanRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
  },
  scanCore: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
  },
});
