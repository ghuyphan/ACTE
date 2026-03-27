import { Image } from 'expo-image';
import { memo, useEffect, useMemo, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Reanimated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { MapClusterNode } from '../../hooks/map/mapDomain';
import type { ThemeColors } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { mapMotionDurations, mapMotionEasing } from './mapMotion';

interface MapCanvasProps {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  isDark: boolean;
  currentZoom: number;
  markerNodes: MapClusterNode[];
  noteById: Map<string, Note>;
  selectedGroupId: string | null;
  markerPulseId: string | null;
  markerPulseKey: number;
  reduceMotionEnabled: boolean;
  onMapPress: () => void;
  onMapReady: () => void;
  onRegionChangeComplete: (region: Region) => void;
  onLeafPress: (groupId: string) => void;
  onClusterPress: (node: MapClusterNode) => void;
  colors: ThemeColors;
}

interface MarkerContentProps {
  isCluster: boolean;
  pointCount: number;
  showPhotoThumbnail: boolean;
  photoNoteId: string | null;
  photoUri: string | null;
  selected: boolean;
  color: string;
  accentColor: string;
  pulseActive: boolean;
  pulseKey: number;
  reduceMotionEnabled: boolean;
}

function getClusterSize(pointCount: number) {
  if (pointCount < 10) {
    return 34;
  }

  if (pointCount < 25) {
    return 40;
  }

  return 46;
}

const MarkerContent = memo(function MarkerContent({
  isCluster,
  pointCount,
  showPhotoThumbnail,
  photoNoteId,
  photoUri,
  selected,
  color,
  accentColor,
  pulseActive,
  pulseKey,
  reduceMotionEnabled,
}: MarkerContentProps) {
  const activeProgress = useSharedValue(selected ? 1 : 0);
  const pulseProgress = useSharedValue(0);
  const enterProgress = useSharedValue(0);

  const size = useMemo(() => (isCluster ? getClusterSize(pointCount) : pointCount > 1 ? 33 : 18), [isCluster, pointCount]);
  const thumbnailSize = selected ? 48 : 38;

  useEffect(() => {
    enterProgress.value = reduceMotionEnabled
      ? withTiming(1, { duration: mapMotionDurations.fast })
      : withTiming(1, { duration: mapMotionDurations.slow });
  }, [enterProgress, reduceMotionEnabled]);

  useEffect(() => {
    activeProgress.value = reduceMotionEnabled
      ? withTiming(selected ? 1 : 0, { duration: mapMotionDurations.fast })
      : withTiming(selected ? 1 : 0, {
          duration: mapMotionDurations.standard,
          easing: mapMotionEasing.standard,
        });
  }, [activeProgress, reduceMotionEnabled, selected]);

  useEffect(() => {
    if (!pulseActive) {
      return;
    }

    pulseProgress.value = 0;
    pulseProgress.value = withTiming(1, { duration: reduceMotionEnabled ? 70 : 120 }, (finished) => {
      if (!finished) {
        return;
      }
      pulseProgress.value = withTiming(0, { duration: reduceMotionEnabled ? 70 : 180 });
    });
  }, [pulseActive, pulseKey, pulseProgress, reduceMotionEnabled]);

  const containerStyle = useAnimatedStyle(() => {
    const focusProgress = Math.max(activeProgress.value, pulseProgress.value);
    const scaleBoost = isCluster
      ? interpolate(pulseProgress.value, [0, 1], [1, 1.12])
      : interpolate(focusProgress, [0, 1], [1, pointCount > 1 ? 1.08 : 1.14]);
    const enterScale = interpolate(enterProgress.value, [0, 1], [0.88, 1]);
    return {
      opacity: enterProgress.value,
      transform: [{ scale: enterScale * scaleBoost }],
    };
  });

  const haloStyle = useAnimatedStyle(() => {
    const focusProgress = Math.max(activeProgress.value, pulseProgress.value);
    return {
      opacity: interpolate(focusProgress, [0, 1], [0, isCluster ? 0.24 : 0.34]),
      transform: [{ scale: interpolate(focusProgress, [0, 1], [0.82, 1.3]) }],
    };
  });

  const clusterStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.max(activeProgress.value, pulseProgress.value),
      [0, 1],
      [`${color}E0`, `${accentColor}F0`]
    ),
  }));

  const groupMarkerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(activeProgress.value, [0, 1], [color, accentColor]),
  }));

  const singleMarkerOuterStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(activeProgress.value, [0, 1], ['white', accentColor]),
    backgroundColor: interpolateColor(activeProgress.value, [0, 1], [`${color}30`, `${accentColor}44`]),
  }));

  const singleMarkerCoreStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(activeProgress.value, [0, 1], [color, accentColor]),
  }));

  return (
    <>
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size + 18,
            height: size + 18,
            borderRadius: (size + 18) / 2,
            backgroundColor: `${accentColor}33`,
          },
          haloStyle,
        ]}
      />
      <Reanimated.View style={containerStyle}>
        {isCluster ? (
          <Reanimated.View
            style={[
              styles.clusterMarker,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: 'rgba(255,255,255,0.95)',
              },
              clusterStyle,
            ]}
          >
            <Text style={styles.clusterText}>{pointCount}</Text>
          </Reanimated.View>
        ) : showPhotoThumbnail && photoUri ? (
          <Reanimated.View
            testID={photoNoteId ? `photo-marker-${photoNoteId}` : undefined}
            style={[
              styles.photoMarker,
              {
                width: thumbnailSize,
                height: thumbnailSize,
                borderRadius: thumbnailSize / 2,
                borderColor: selected ? accentColor : 'rgba(255,255,255,0.96)',
              },
            ]}
          >
            <Image
              source={{ uri: photoUri }}
              style={styles.photoMarkerImage}
              contentFit="cover"
              transition={0}
            />
            <View
              pointerEvents="none"
              style={[
                styles.photoMarkerBadge,
                { backgroundColor: selected ? accentColor : `${accentColor}E6` },
              ]}
            >
              <Text style={styles.photoMarkerBadgeText}>+</Text>
            </View>
          </Reanimated.View>
        ) : pointCount > 1 ? (
          <Reanimated.View
            style={[
              styles.groupMarker,
              {
                borderColor: 'white',
              },
              groupMarkerStyle,
            ]}
          >
            <Text style={styles.groupMarkerText}>{pointCount}</Text>
          </Reanimated.View>
        ) : (
          <Reanimated.View style={[styles.singleMarker, singleMarkerOuterStyle]}>
            <Reanimated.View style={[styles.singleMarkerCore, singleMarkerCoreStyle]} />
          </Reanimated.View>
        )}
      </Reanimated.View>
    </>
  );
});

export default function MapCanvas({
  mapRef,
  initialRegion,
  isDark,
  currentZoom,
  markerNodes,
  noteById,
  selectedGroupId,
  markerPulseId,
  markerPulseKey,
  reduceMotionEnabled,
  onMapPress,
  onMapReady,
  onRegionChangeComplete,
  onLeafPress,
  onClusterPress,
  colors,
}: MapCanvasProps) {
  const markerRenderItems = useMemo(
    () =>
      markerNodes.map((node) => {
        const isSelected = node.groupId != null && node.groupId === selectedGroupId;
        const markerColor = node.primaryType === 'photo' ? colors.danger : colors.accent;
        const markerId = node.isCluster ? node.id : node.groupId ?? node.id;
        const pulseActive = markerPulseId === markerId;
        const canShowPhotoThumbnail =
          !node.isCluster &&
          node.pointCount === 1 &&
          node.primaryType === 'photo' &&
          node.noteIds.length === 1 &&
          (isSelected || currentZoom >= 16);
        const photoNote = canShowPhotoThumbnail ? noteById.get(node.noteIds[0]) ?? null : null;

        return {
          node,
          isSelected,
          markerColor,
          pulseActive,
          photoNoteId: photoNote?.id ?? null,
          photoUri: photoNote ? getNotePhotoUri(photoNote) : null,
        };
      }),
    [colors.accent, colors.danger, currentZoom, markerNodes, markerPulseId, noteById, selectedGroupId]
  );

  return (
    <MapView
      testID="map-canvas"
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      onPress={onMapPress}
      onMapReady={onMapReady}
      onRegionChangeComplete={onRegionChangeComplete}
      showsCompass={false}
      showsUserLocation
      showsMyLocationButton={false}
      userInterfaceStyle={isDark ? 'dark' : 'light'}
    >
      {markerRenderItems.map(({ node, isSelected, markerColor, pulseActive, photoNoteId, photoUri }) => {
        return (
          <Marker
            key={node.id}
            testID={node.isCluster ? `cluster-marker-${node.id}` : `leaf-marker-${node.groupId ?? node.id}`}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={pulseActive || isSelected || reduceMotionEnabled}
            onPress={(event) => {
              event.stopPropagation?.();
              if (node.isCluster) {
                onClusterPress(node);
                return;
              }
              if (node.groupId) {
                onLeafPress(node.groupId);
              }
            }}
          >
            <View style={styles.markerWrap} collapsable={false}>
              <MarkerContent
                isCluster={node.isCluster}
                pointCount={node.pointCount}
                showPhotoThumbnail={Boolean(photoUri)}
                photoNoteId={photoNoteId}
                photoUri={photoUri}
                selected={isSelected}
                color={node.isCluster ? colors.primary : markerColor}
                accentColor={colors.primary}
                pulseActive={pulseActive}
                pulseKey={markerPulseKey}
                reduceMotionEnabled={reduceMotionEnabled}
              />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
    minHeight: 60,
  },
  halo: {
    position: 'absolute',
  },
  clusterMarker: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  clusterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'System',
  },
  groupMarker: {
    minWidth: 33,
    height: 33,
    borderRadius: 16.5,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  groupMarkerText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'System',
  },
  photoMarker: {
    overflow: 'hidden',
    borderWidth: 3,
    backgroundColor: '#F4F1EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMarkerImage: {
    width: '100%',
    height: '100%',
  },
  photoMarkerBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMarkerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 11,
    fontFamily: 'System',
  },
  singleMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleMarkerCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
