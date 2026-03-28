import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../map/MapCanvas';
import MapFilterBar from '../map/MapFilterBar';
import MapFriendsPreviewCard from '../map/MapFriendsPreviewCard';
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
import type { SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';

const MIN_ZOOM_DELTA = 0.002;

type OverlayState = 'content' | 'no-filter-results' | 'no-notes' | 'no-area-results';

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
  const [notesPreviewDismissed, setNotesPreviewDismissed] = useState(false);
  const [markerPulseId, setMarkerPulseId] = useState<string | null>(null);
  const [markerPulseKey, setMarkerPulseKey] = useState(0);
  const [showFriendsPreview, setShowFriendsPreview] = useState(false);
  const [activeFriendPostId, setActiveFriendPostId] = useState<string | null>(null);
  const hasCenteredRef = useRef(false);
  const markerPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    clearSelection,
    selectNoteById,
    clusterNodes,
    nearbyItems,
    filteredCount,
    visibleAreaCount,
    showingAllFilteredResults,
    hasActiveFilters,
    showAllFilteredResults,
  } = useMapScreenState({ notes, location });

  const previewBottomOffset = insets.bottom + 12;
  const previewMode = selectedGroup ? 'group' : 'nearby';
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note] as const)), [notes]);
  const friendPosts = useMemo(
    () =>
      sharedPosts
        .filter((post) => post.authorUid !== user?.uid)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sharedPosts, user?.uid]
  );
  const friendMarkerPosts = useMemo(
    () =>
      friendPosts.filter(
        (post): post is SharedPost & { latitude: number; longitude: number } =>
          typeof post.latitude === 'number' &&
          Number.isFinite(post.latitude) &&
          typeof post.longitude === 'number' &&
          Number.isFinite(post.longitude)
      ),
    [friendPosts]
  );
  const friendsPreviewVisible = showFriendsPreview && friendPosts.length > 0;
  const hasFriendLayer = sharedEnabled && friendPosts.length > 0;
  const hasMapContent = notes.length > 0 || friendMarkerPosts.length > 0;
  const overlayState: OverlayState =
    !hasMapContent
      ? 'no-notes'
      : notes.length > 0 && filteredCount === 0
        ? 'no-filter-results'
        : notes.length > 0 && visibleAreaCount === 0 && !showingAllFilteredResults
          ? 'no-area-results'
          : 'content';
  const previewVisible = overlayState === 'content' && nearbyItems.length > 0 && !notesPreviewDismissed;

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
      if (notesPreviewDismissed) {
        setNotesPreviewDismissed(false);
      }
      setFilterType(nextType);
    },
    [notesPreviewDismissed, setFilterType, showFriendsPreview]
  );

  const handleToggleFavorites = useCallback(() => {
    if (showFriendsPreview) {
      setShowFriendsPreview(false);
    }
    if (notesPreviewDismissed) {
      setNotesPreviewDismissed(false);
    }
    toggleFavoritesOnly();
  }, [notesPreviewDismissed, showFriendsPreview, toggleFavoritesOnly]);

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
      if (notesPreviewDismissed) {
        setNotesPreviewDismissed(false);
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
      if (notesPreviewDismissed) {
        setNotesPreviewDismissed(false);
      }
      triggerMarkerPulse(groupId);
      handleLeafMarkerPress(groupId);
      emitLightHaptic();
    },
    [emitLightHaptic, handleLeafMarkerPress, notesPreviewDismissed, showFriendsPreview, triggerMarkerPulse]
  );

  const handleFocusNearbyNote = useCallback(
    (noteId: string) => {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
      if (notesPreviewDismissed) {
        setNotesPreviewDismissed(false);
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
    [
      initialRegion,
      nearbyItems,
      notesPreviewDismissed,
      reduceMotionEnabled,
      setVisibleRegion,
      showFriendsPreview,
      visibleRegion,
    ]
  );

  const handleOpenFriendsLayer = useCallback(() => {
    if (!hasFriendLayer) {
      return;
    }

    emitLightHaptic();
    setShowFriendsPreview((current) => !current);
    setActiveFriendPostId((current) => current ?? friendPosts[0]?.id ?? null);
  }, [emitLightHaptic, friendPosts, hasFriendLayer]);

  const handleDismissNotesPreview = useCallback(() => {
    emitLightHaptic();
    setNotesPreviewDismissed(true);
    clearSelection();
  }, [clearSelection, emitLightHaptic]);

  const handleDismissFriendsPreview = useCallback(() => {
    emitLightHaptic();
    setShowFriendsPreview(false);
  }, [emitLightHaptic]);

  const focusFriendPost = useCallback(
    (postId: string, options?: { animate?: boolean; openPreview?: boolean }) => {
      const targetPost =
        friendMarkerPosts.find((post) => post.id === postId) ??
        friendPosts.find((post) => post.id === postId);
      if (!targetPost) {
        return;
      }

      if (options?.openPreview ?? true) {
        setShowFriendsPreview(true);
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

        mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 350);
        setVisibleRegion(nextRegion);
      }
    },
    [friendMarkerPosts, friendPosts, initialRegion, reduceMotionEnabled, setVisibleRegion, visibleRegion]
  );

  const handleFriendMarkerPress = useCallback(
    (postId: string) => {
      emitLightHaptic();
      focusFriendPost(postId, { animate: false, openPreview: true });
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
    if (!isMapReady || hasCenteredRef.current || !mapRef.current) {
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
  }, [friendMarkerPosts, isMapReady, location, notes]);

  const countLabel = useMemo(() => {
    const base = `${filteredCount} ${filteredCount === 1 ? t('map.note', 'note') : t('map.notes', 'notes')}`;
    const suffixes: string[] = [];

    if (hasActiveFilters) {
      suffixes.push(t('map.filteredLabel', 'filtered'));
    }

    if (showingAllFilteredResults) {
      suffixes.push(t('map.allResultsLabel', 'all results'));
    }

    return suffixes.length > 0 ? `${base} · ${suffixes.join(' · ')}` : base;
  }, [filteredCount, hasActiveFilters, showingAllFilteredResults, t]);

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
        currentZoom={visibleRegion ? regionToZoom(visibleRegion) : regionToZoom(initialRegion)}
        markerNodes={clusterNodes}
        friendMarkers={friendMarkerPosts}
        noteById={noteById}
        selectedGroupId={selectedGroupId}
        selectedFriendPostId={activeFriendPostId}
        markerPulseId={markerPulseId}
        markerPulseKey={markerPulseKey}
        reduceMotionEnabled={reduceMotionEnabled}
        onMapPress={handleMapCanvasPress}
        onMapReady={() => {
          setIsMapReady(true);
        }}
        onRegionChangeComplete={setVisibleRegion}
        onLeafPress={handleLeafPress}
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
                      borderColor: friendsPreviewVisible ? `${colors.primary}55` : getOverlayBorderColor(isDark),
                    },
                  ]}
                >
                  {friendsPreviewVisible ? (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: isDark ? 'rgba(255,193,7,0.16)' : 'rgba(255,193,7,0.14)',
                        },
                      ]}
                    />
                  ) : null}
                  <GlassView
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    glassEffectStyle="regular"
                    colorScheme={isDark ? 'dark' : 'light'}
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
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.friendsChipLabel,
                        { color: friendsPreviewVisible ? colors.primary : colors.text },
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
          <View style={styles.fab}>
            <GlassView
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              glassEffectStyle="regular"
              colorScheme={isDark ? 'dark' : 'light'}
            />
            {isOlderIOS ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
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
      </View>

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
          onDismiss={handleDismissNotesPreview}
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
          onDismiss={handleDismissFriendsPreview}
          onFocusPost={(postId) => focusFriendPost(postId)}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      <View
        testID="map-overlay-host"
        style={styles.emptyOverlay}
        pointerEvents={overlayState === 'content' || friendsPreviewVisible ? 'none' : 'box-none'}
      >
        {overlayState === 'no-notes' && !friendsPreviewVisible ? (
          <MapStatusCard
            overlayState="no-notes"
            isDark={isDark}
            primaryColor={colors.primary}
            textColor={colors.text}
            secondaryTextColor={colors.secondaryText}
            reduceMotionEnabled={reduceMotionEnabled}
            title={t('map.emptyTitle', 'No notes on the map yet')}
            subtitle={t('map.emptySubtitle', 'Your saved notes will appear as pins here')}
          />
        ) : null}

        {overlayState === 'no-filter-results' && !friendsPreviewVisible ? (
          <MapStatusCard
            overlayState="no-filter-results"
            isDark={isDark}
            primaryColor={colors.primary}
            textColor={colors.text}
            secondaryTextColor={colors.secondaryText}
            reduceMotionEnabled={reduceMotionEnabled}
            title={t('map.filteredEmptyTitle', 'No notes match these filters')}
            subtitle={t(
              'map.filteredEmptySubtitle',
              'Try another filter combination or reset to view all notes'
            )}
            actionLabel={t('map.clearFilters', 'Clear filters')}
            actionTestID="map-clear-filters"
            onAction={() => {
              emitLightHaptic();
              setNotesPreviewDismissed(false);
              clearFilters();
            }}
          />
        ) : null}

        {overlayState === 'no-area-results' && !friendsPreviewVisible ? (
          <MapStatusCard
            overlayState="no-area-results"
            isDark={isDark}
            primaryColor={colors.primary}
            textColor={colors.text}
            secondaryTextColor={colors.secondaryText}
            reduceMotionEnabled={reduceMotionEnabled}
            title={t('map.areaEmptyTitle', 'No notes in this area')}
            subtitle={t(
              'map.areaEmptySubtitle',
              'Move the map a bit more or show all matching notes from anywhere.'
            )}
            actionLabel={t('map.showAllResults', 'Show all results')}
            actionTestID="map-show-all-results"
            onAction={() => {
              emitLightHaptic();
              setNotesPreviewDismissed(false);
              showAllFilteredResults();
            }}
          />
        ) : null}
      </View>

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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    minHeight: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  friendsChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  friendsChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'System',
  },
  friendsChipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9,
  },
});
