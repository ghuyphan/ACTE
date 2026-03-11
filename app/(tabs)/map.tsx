import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type MapView from 'react-native-maps';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../../components/map/MapCanvas';
import MapFilterBar from '../../components/map/MapFilterBar';
import MapPreviewCard from '../../components/map/MapPreviewCard';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  mapOverlayTokens,
} from '../../components/map/overlayTokens';
import type { MapClusterNode } from '../../hooks/map/mapDomain';
import { DEFAULT_REGION, regionToZoom } from '../../hooks/map/mapDomain';
import { useMapScreenState } from '../../hooks/map/useMapScreenState';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

const MIN_ZOOM_DELTA = 0.002;

export default function MapScreen() {
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
  const hasCenteredRef = useRef(false);
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

  const mapAnimationDuration = reduceMotionEnabled ? 0 : 900;
  const previewBottomOffset = insets.bottom + 12;
  const [activeNearbyNoteId, setActiveNearbyNoteId] = useState<string | null>(null);

  const emitLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 700);
      setVisibleRegion(nextRegion);
      emitLightHaptic();
    }
  }, [emitLightHaptic, location, openAppSettings, reduceMotionEnabled, requestForegroundLocation, setVisibleRegion]);

  const handleClusterPress = useCallback(
    (node: MapClusterNode) => {
      handleClusterMarkerPress();
      emitLightHaptic();

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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 450);
      setVisibleRegion(nextRegion);
    },
    [emitLightHaptic, handleClusterMarkerPress, initialRegion, reduceMotionEnabled, setVisibleRegion, visibleRegion]
  );

  const handleLeafPress = useCallback(
    (groupId: string) => {
      handleLeafMarkerPress(groupId);
      emitLightHaptic();
    },
    [emitLightHaptic, handleLeafMarkerPress]
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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 420);
      setVisibleRegion(nextRegion);
    },
    [initialRegion, nearbyItems, reduceMotionEnabled, setVisibleRegion, visibleRegion]
  );

  useEffect(() => {
    if (!isMapReady || hasCenteredRef.current || !mapRef.current) {
      return;
    }

    if (location) {
      const target = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      mapRef.current.animateToRegion(target, mapAnimationDuration);
      setVisibleRegion(target);
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
          animated: !reduceMotionEnabled,
        }
      );
      hasCenteredRef.current = true;
      return;
    }

    if (notes.length === 1) {
      const target = {
        latitude: notes[0].latitude,
        longitude: notes[0].longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      };
      mapRef.current.animateToRegion(target, mapAnimationDuration);
      setVisibleRegion(target);
      hasCenteredRef.current = true;
      return;
    }

    mapRef.current.animateToRegion(DEFAULT_REGION, mapAnimationDuration);
    setVisibleRegion(DEFAULT_REGION);
    hasCenteredRef.current = true;
  }, [isMapReady, location, mapAnimationDuration, notes, reduceMotionEnabled, setVisibleRegion]);

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
        markerNodes={clusterNodes}
        selectedGroupId={selectedGroupId}
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

      <View style={[styles.topHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
        <MapFilterBar
          filterState={filterState}
          countLabel={countLabel}
          onChangeType={setFilterType}
          onToggleFavorites={toggleFavoritesOnly}
          onInteraction={emitLightHaptic}
        />
      </View>

      <Reanimated.View style={[styles.fabContainer, { top: insets.top + 20 }, fabAnimatedStyle]}>
        <Pressable
          testID="map-recenter"
          onPress={goToMyLocation}
          onPressIn={() => {
            fabScale.value = withSpring(0.95, {
              stiffness: 260,
              damping: 20,
            });
          }}
          onPressOut={() => {
            fabScale.value = withSpring(1, {
              stiffness: 260,
              damping: 20,
            });
          }}
        >
          <GlassView
            style={[styles.fab, { borderColor: getOverlayBorderColor(isDark) }]}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          >
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
          </GlassView>
        </Pressable>
      </Reanimated.View>

      <MapPreviewCard
        selectedGroup={selectedGroup}
        selectedNoteIndex={selectedNoteIndex}
        nearbyItems={nearbyItems}
        activeNearbyNoteId={activeNearbyNoteId}
        bottomOffset={previewBottomOffset}
        onOpen={handleOpenPreview}
        onFocusNearbyNote={handleFocusNearbyNote}
        onFocusGroupNote={selectNoteById}
        onInteraction={emitLightHaptic}
      />

      {notes.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)' },
            ]}
          >
            <Ionicons name="map-outline" size={40} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('map.emptyTitle', 'No notes on the map yet')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
              {t('map.emptySubtitle', 'Your saved notes will appear as pins here')}
            </Text>
          </View>
        </View>
      ) : filteredCount === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)' },
            ]}
          >
            <Ionicons name="filter-outline" size={36} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('map.filteredEmptyTitle', 'No notes match these filters')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
              {t('map.filteredEmptySubtitle', 'Try another filter combination or reset to view all notes')}
            </Text>
            <Pressable
              testID="map-clear-filters"
              style={[styles.clearFiltersBtn, { backgroundColor: `${colors.primary}20` }]}
              onPress={() => {
                emitLightHaptic();
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                clearFilters();
              }}
            >
              <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
                {t('map.clearFilters', 'Clear filters')}
              </Text>
            </Pressable>
          </View>
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
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9,
  },
  emptyCard: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    maxWidth: 320,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'System',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'System',
  },
  clearFiltersBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
