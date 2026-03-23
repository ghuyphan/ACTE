import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../map/MapCanvas';
import MapFilterBar from '../map/MapFilterBar';
import { getMapLayoutTransition, mapMotionPressTiming } from '../map/mapMotion';
import MapPreviewCard from '../map/MapPreviewCard';
import MapStatusCard from '../map/MapStatusCard';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from '../map/overlayTokens';
import type { MapClusterNode } from '../../hooks/map/mapDomain';
import { regionToZoom } from '../../hooks/map/mapDomain';
import { useMapScreenState } from '../../hooks/map/useMapScreenState';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

const MIN_ZOOM_DELTA = 0.002;

type OverlayState = 'content' | 'no-filter-results' | 'no-notes';

export default function MapScreenIOS() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReducedMotion();
  const { notes, loading } = useNotesStore();
  const { location, requestForegroundLocation, openAppSettings } = useGeofence();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [activeNearbyNoteId, setActiveNearbyNoteId] = useState<string | null>(null);
  const [markerPulseId, setMarkerPulseId] = useState<string | null>(null);
  const [markerPulseKey, setMarkerPulseKey] = useState(0);
  const hasCenteredRef = useRef(false);
  const markerPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabScale = useSharedValue(1);

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

  const handleOpenPreview = useCallback(() => {
    if (selectedNote) {
      openNote(selectedNote.id);
      return;
    }

    if (activeNearbyItem) {
      openNote(activeNearbyItem.note.id);
    }
  }, [activeNearbyItem, openNote, selectedNote]);

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
      triggerMarkerPulse,
      visibleRegion,
    ]
  );

  const handleLeafPress = useCallback(
    (groupId: string) => {
      triggerMarkerPulse(groupId);
      handleLeafMarkerPress(groupId);
      emitLightHaptic();
    },
    [emitLightHaptic, handleLeafMarkerPress, triggerMarkerPulse]
  );

  const handleFocusNearbyNote = useCallback(
    (noteId: string) => {
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
    [initialRegion, nearbyItems, reduceMotionEnabled, setVisibleRegion, visibleRegion]
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
        onMapPress={handleMapPress}
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
          onChangeType={setFilterType}
          onToggleFavorites={toggleFavoritesOnly}
          onInteraction={emitLightHaptic}
          reduceMotionEnabled={reduceMotionEnabled}
        />
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

      {notes.length > 0 ? (
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

      <Reanimated.View
        testID="map-overlay-host"
        style={styles.emptyOverlay}
        pointerEvents={overlayState === 'content' ? 'none' : 'box-none'}
        layout={getMapLayoutTransition(reduceMotionEnabled)}
      >
        {overlayState === 'no-notes' ? (
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

        {overlayState === 'no-filter-results' ? (
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
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9,
  },
});
