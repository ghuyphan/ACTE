import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type MapView from 'react-native-maps';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapCanvas from '../../components/map/MapCanvas';
import MapFilterBar from '../../components/map/MapFilterBar';
import { getMapLayoutTransition, mapMotionPressTiming } from '../../components/map/mapMotion';
import MapPreviewCard from '../../components/map/MapPreviewCard';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  mapOverlayTokens,
} from '../../components/map/overlayTokens';
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

interface MapStatusCardProps {
  overlayState: Exclude<OverlayState, 'content'>;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  secondaryTextColor: string;
  onClearFilters: () => void;
  reduceMotionEnabled: boolean;
  title: string;
  subtitle: string;
  clearLabel: string;
}

function MapStatusCard({
  overlayState,
  isDark,
  primaryColor,
  textColor,
  secondaryTextColor,
  onClearFilters,
  reduceMotionEnabled,
  title,
  subtitle,
  clearLabel,
}: MapStatusCardProps) {
  const isFiltered = overlayState === 'no-filter-results';
  const statusGlassTintColor = isDark ? 'rgba(18,18,24,0.34)' : 'rgba(255,255,255,0.42)';
  const statusGlassScrimColor = isDark ? 'rgba(12,12,18,0.18)' : 'rgba(255,255,255,0.20)';
  return (
    <Reanimated.View
      key={overlayState}
      testID="map-status-card"
      layout={getMapLayoutTransition(reduceMotionEnabled)}
      style={styles.emptyCardWrap}
    >
      <View
        style={[
          styles.emptyCard,
          { borderColor: getOverlayBorderColor(isDark) },
        ]}
      >
        <GlassView
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          tintColor={statusGlassTintColor}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.emptyCardScrim,
            { backgroundColor: statusGlassScrimColor },
          ]}
        />
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 24,
                backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
              },
            ]}
          />
        ) : null}
        <View style={styles.emptyCardContent}>
          <Ionicons
            name={isFiltered ? 'filter-outline' : 'map-outline'}
            size={isFiltered ? 36 : 40}
            color={primaryColor}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            {title}
          </Text>
          <Text style={[styles.emptySubtitle, { color: secondaryTextColor }]}>
            {subtitle}
          </Text>
          {isFiltered ? (
            <Pressable
              testID="map-clear-filters"
              style={[styles.clearFiltersBtn, { backgroundColor: `${primaryColor}20` }]}
              onPress={onClearFilters}
            >
              <Text style={[styles.clearFiltersText, { color: primaryColor }]}>
                {clearLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Reanimated.View>
  );
}

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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 700);
      setVisibleRegion(nextRegion);
      emitLightHaptic();
    }
  }, [emitLightHaptic, location, openAppSettings, reduceMotionEnabled, requestForegroundLocation, setVisibleRegion]);

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

      mapRef.current.animateToRegion(nextRegion, reduceMotionEnabled ? 0 : 450);
      setVisibleRegion(nextRegion);
    },
    [emitLightHaptic, handleClusterMarkerPress, initialRegion, reduceMotionEnabled, setVisibleRegion, triggerMarkerPulse, visibleRegion]
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
            subtitle={t('map.filteredEmptySubtitle', 'Try another filter combination or reset to view all notes')}
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
  emptyCardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  emptyCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  emptyCardContent: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyCardScrim: {
    borderRadius: 24,
  },
  emptyIcon: {
    marginBottom: 8,
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
