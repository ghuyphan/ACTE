import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Reanimated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { MapClusterNode, MapPointGroup } from '../../hooks/map/mapDomain';
import type { ThemeColors } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import type { SharedPost } from '../../services/sharedFeedService';
import {
  mapMotionDurations,
  mapMotionEasing,
  mapMotionMarkerSettleSpring,
  mapMotionMarkerSpring,
} from './mapMotion';
import MapSharedPostCallout from './MapSharedPostCallout';
import { photoOrbMinZoom, samePlaceSplitMinZoom } from './mapMarkerTokens';
import MapSelectedNoteCallout from './MapSelectedNoteCallout';

type SharedPostWithCoordinates = SharedPost & {
  latitude: number;
  longitude: number;
};

type MapRegionChangeDetails = {
  isGesture?: boolean;
};

interface MapCanvasProps {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  isDark: boolean;
  currentZoom: number;
  markerNodes: MapClusterNode[];
  friendMarkers: SharedPostWithCoordinates[];
  noteById: Map<string, Note>;
  selectedGroupId: string | null;
  selectedGroup: MapPointGroup | null;
  selectedNote: Note | null;
  selectedFriendPostId: string | null;
  markerPulseId: string | null;
  markerPulseKey: number;
  reduceMotionEnabled: boolean;
  onMapPress: () => void;
  onMapReady: () => void;
  onRegionChangeComplete: (region: Region, details?: MapRegionChangeDetails) => void;
  onLeafPress: (groupId: string) => void;
  onNotePress: (noteId: string) => void;
  onClusterPress: (node: MapClusterNode) => void;
  onFriendPress: (postId: string) => void;
  preferLiteMarkers?: boolean;
  colors: ThemeColors;
}

interface MarkerRenderItem {
  key: string;
  testID: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  node: MapClusterNode;
  pointCount: number;
  isSelected: boolean;
  markerColor: string;
  pulseActive: boolean;
  photoNoteId: string | null;
  photoUri: string | null;
  noteId: string | null;
}

interface MarkerContentProps {
  isCluster: boolean;
  pointCount: number;
  zoomLevel: number;
  showPhotoThumbnail: boolean;
  photoNoteId: string | null;
  photoUri: string | null;
  selected: boolean;
  color: string;
  accentColor: string;
  cardBackgroundColor: string;
  pulseActive: boolean;
  pulseKey: number;
  reduceMotionEnabled: boolean;
  imageTrackingKey?: string | null;
  onImageLoadStart?: (key: string) => void;
  onImageLoadEnd?: (key: string) => void;
}

const ANDROID_MARKER_REFRESH_MS = {
  reducedMotion: 120,
  standard: 320,
} as const;

function getClusterSize(pointCount: number) {
  if (pointCount < 10) {
    return 34;
  }

  if (pointCount < 100) {
    return 40;
  }

  return 48;
}

function formatMarkerCount(pointCount: number) {
  if (pointCount > 99) {
    return '99+';
  }

  return String(pointCount);
}

function getMapPalette(colors: ThemeColors, isDark: boolean) {
  return {
    focus: colors.primary,
    cluster: colors.primary,
    text: colors.accent,
    photo: colors.primary,
    cardBackground: colors.card,
    friend: colors.accent,
    friendSoft: isDark ? `${colors.accent}22` : `${colors.accent}1F`,
  };
}

function getSharedPostMarkerPhotoUri(post: SharedPost) {
  if (post.type !== 'photo') {
    return null;
  }

  return (
    post.dualPrimaryPhotoLocalUri?.trim() ||
    post.photoLocalUri?.trim() ||
    post.dualSecondaryPhotoLocalUri?.trim() ||
    null
  );
}

function getLeafMarkerBaseScale(
  zoomLevel: number,
  variant: 'single' | 'photo' | 'group'
) {
  const zoomProgress = Math.min(1, Math.max(0, (zoomLevel - 4) / 12));

  if (variant === 'photo') {
    return 0.82 + zoomProgress * 0.14;
  }

  if (variant === 'group') {
    return 0.86 + zoomProgress * 0.12;
  }

  return 0.84 + zoomProgress * 0.14;
}

const OVERLAP_COORDINATE_PRECISION = 6;

function getOverlapCoordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(OVERLAP_COORDINATE_PRECISION)}:${longitude.toFixed(OVERLAP_COORDINATE_PRECISION)}`;
}

function getSeparatedNoteCoordinate(
  latitude: number,
  longitude: number,
  index: number,
  count: number,
  zoomLevel: number
) {
  if (count <= 1) {
    return { latitude, longitude };
  }

  const earthMetersPerDegree = 111111;
  const metersPerPixel = 156543.03392 / Math.pow(2, zoomLevel);
  const clampedCount = Math.min(count, 6);
  const horizontalRadiusMeters = Math.max(
    4,
    Math.min(10, metersPerPixel * (12 + clampedCount * 1.75))
  );
  const verticalRadiusMeters = Math.max(
    3,
    Math.min(8, metersPerPixel * (8 + clampedCount * 1.25))
  );
  const arcStart = (5 * Math.PI) / 6;
  const arcEnd = Math.PI / 6;
  const angleProgress = count === 1 ? 0.5 : index / (count - 1);
  const angle = arcStart + (arcEnd - arcStart) * angleProgress;
  const longitudeMetersPerDegree = Math.max(
    1,
    Math.cos((latitude * Math.PI) / 180) * earthMetersPerDegree
  );

  return {
    latitude: latitude + (verticalRadiusMeters * Math.sin(angle)) / earthMetersPerDegree,
    longitude: longitude + (horizontalRadiusMeters * Math.cos(angle)) / longitudeMetersPerDegree,
  };
}

function getSplitNoteCoordinate(
  note: Note,
  siblingNotes: Note[],
  zoomLevel: number
) {
  const overlapKey = getOverlapCoordinateKey(note.latitude, note.longitude);
  const overlappingNotes = siblingNotes.filter(
    (candidate) => getOverlapCoordinateKey(candidate.latitude, candidate.longitude) === overlapKey
  );

  if (overlappingNotes.length <= 1) {
    return {
      latitude: note.latitude,
      longitude: note.longitude,
    };
  }

  const overlapIndex = overlappingNotes.findIndex((candidate) => candidate.id === note.id);
  const anchorLatitude =
    overlappingNotes.reduce((sum, candidate) => sum + candidate.latitude, 0) / overlappingNotes.length;
  const anchorLongitude =
    overlappingNotes.reduce((sum, candidate) => sum + candidate.longitude, 0) / overlappingNotes.length;

  return getSeparatedNoteCoordinate(
    anchorLatitude,
    anchorLongitude,
    overlapIndex === -1 ? 0 : overlapIndex,
    overlappingNotes.length,
    zoomLevel
  );
}

const MarkerContent = memo(function MarkerContent({
  isCluster,
  pointCount,
  zoomLevel,
  showPhotoThumbnail,
  photoNoteId,
  photoUri,
  selected,
  color,
  accentColor,
  cardBackgroundColor,
  pulseActive,
  pulseKey,
  reduceMotionEnabled,
  imageTrackingKey,
  onImageLoadStart,
  onImageLoadEnd,
}: MarkerContentProps) {
  const activeProgress = useSharedValue(selected ? 1 : 0);
  const pulseProgress = useSharedValue(0);

  const size = useMemo(() => (isCluster ? getClusterSize(pointCount) : pointCount > 1 ? 33 : 18), [isCluster, pointCount]);
  const leafMarkerBaseScale = useMemo(() => {
    if (isCluster) {
      return 1;
    }

    if (showPhotoThumbnail) {
      return getLeafMarkerBaseScale(zoomLevel, 'photo');
    }

    if (pointCount > 1) {
      return getLeafMarkerBaseScale(zoomLevel, 'group');
    }

    return getLeafMarkerBaseScale(zoomLevel, 'single');
  }, [isCluster, pointCount, showPhotoThumbnail, zoomLevel]);
  const scaleProgress = useSharedValue(leafMarkerBaseScale);

  useEffect(() => {
    activeProgress.value = reduceMotionEnabled
      ? withTiming(selected ? 1 : 0, { duration: mapMotionDurations.fast })
      : withSpring(selected ? 1 : 0, mapMotionMarkerSpring);
  }, [activeProgress, reduceMotionEnabled, selected]);

  useEffect(() => {
    scaleProgress.value = reduceMotionEnabled
      ? withTiming(leafMarkerBaseScale, {
          duration: mapMotionDurations.standard,
          easing: mapMotionEasing.standard,
        })
      : withSpring(leafMarkerBaseScale, mapMotionMarkerSettleSpring);
  }, [leafMarkerBaseScale, reduceMotionEnabled, scaleProgress]);

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
      ? interpolate(pulseProgress.value, [0, 1], [1, 1.05])
      : interpolate(focusProgress, [0, 1], [1, pointCount > 1 ? 1.04 : 1.07]);
    const lift = isCluster
      ? 0
      : interpolate(focusProgress, [0, 1], [0, pointCount > 1 ? -0.5 : -1]);
    return {
      transform: [
        { translateY: lift },
        { scale: scaleBoost * scaleProgress.value },
      ],
    };
  }, [isCluster, pointCount, scaleProgress]);

  const haloStyle = useAnimatedStyle(() => {
    const focusProgress = Math.max(activeProgress.value, pulseProgress.value);
    return {
      opacity: interpolate(focusProgress, [0, 1], [0, isCluster ? 0.14 : 0.2]),
      transform: [{ scale: interpolate(focusProgress, [0, 1], [0.94, isCluster ? 1.12 : 1.16]) }],
    };
  });

  const handleImageLoadStart = () => {
    if (imageTrackingKey) {
      onImageLoadStart?.(imageTrackingKey);
    }
  };

  const handleImageLoadEnd = () => {
    if (imageTrackingKey) {
      onImageLoadEnd?.(imageTrackingKey);
    }
  };

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

  const singleMarkerIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(activeProgress.value, [0, 1], [1, 1.04]) }],
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
                width: size + 8,
                height: size + 8,
                borderRadius: (size + 8) / 2,
                borderColor: 'rgba(255,255,255,0.96)',
              },
              clusterStyle,
            ]}
          >
            <Text style={styles.clusterText}>{formatMarkerCount(pointCount)}</Text>
          </Reanimated.View>
        ) : showPhotoThumbnail && photoUri ? (
          <View style={styles.photoMarkerShell}>
            <View
              testID={photoNoteId ? `photo-marker-${photoNoteId}` : undefined}
              style={[
                styles.photoMarkerOrb,
                {
                  borderColor: selected ? accentColor : 'rgba(255,255,255,0.96)',
                  backgroundColor: cardBackgroundColor,
                },
              ]}
            >
              <Image
                source={{ uri: photoUri }}
                style={styles.photoMarkerImage}
                contentFit="cover"
                transition={0}
                onLoadStart={handleImageLoadStart}
                onLoad={handleImageLoadEnd}
                onError={handleImageLoadEnd}
              />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.photoMarkerBadge,
                { backgroundColor: selected ? accentColor : `${color}F0` },
              ]}
            >
              <Ionicons name="camera" size={10} color="#FFFFFF" />
            </View>
          </View>
        ) : pointCount > 1 ? (
          <Reanimated.View
            style={[
              styles.groupMarker,
              {
                borderColor: 'rgba(255,255,255,0.96)',
              },
              groupMarkerStyle,
            ]}
          >
            <Ionicons name="albums" size={12} color="#FFFFFF" />
            <Text style={styles.groupMarkerText}>{formatMarkerCount(pointCount)}</Text>
          </Reanimated.View>
        ) : (
          <Reanimated.View style={[styles.singleMarker, singleMarkerOuterStyle]}>
            <Reanimated.View
              style={[
                styles.singleMarkerIconWrap,
                { backgroundColor: `${color}16` },
                singleMarkerIconStyle,
              ]}
            >
              <Ionicons name="document-text" size={14} color={selected ? accentColor : color} />
            </Reanimated.View>
          </Reanimated.View>
        )}
      </Reanimated.View>
    </>
  );
});

function MapCanvas({
  mapRef,
  initialRegion,
  isDark,
  currentZoom,
  markerNodes,
  friendMarkers,
  noteById,
  selectedGroupId,
  selectedGroup,
  selectedNote,
  selectedFriendPostId,
  markerPulseId,
  markerPulseKey,
  reduceMotionEnabled,
  onMapPress,
  onMapReady,
  onRegionChangeComplete,
  onLeafPress,
  onNotePress,
  onClusterPress,
  onFriendPress,
  preferLiteMarkers = false,
  colors,
}: MapCanvasProps) {
  const isAndroid = Platform.OS === 'android';
  const palette = useMemo(() => getMapPalette(colors, isDark), [colors, isDark]);
  const [androidShouldTrackMarkerViews, setAndroidShouldTrackMarkerViews] = useState(isAndroid);
  const [pendingMarkerImageKeys, setPendingMarkerImageKeys] = useState<Set<string>>(new Set());
  const androidMarkerRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCalloutAnchor = useMemo(() => ({ x: 0.5, y: 0.86 }), []);
  // Android applies map color scheme only from initial props, so remount on theme flips.
  const mapViewKey = isAndroid ? `map-${isDark ? 'dark' : 'light'}` : 'map';

  const markerRenderItems = useMemo<MarkerRenderItem[]>(
    () => {
      const items: MarkerRenderItem[] = [];

      for (const node of markerNodes) {
        const markerColor = node.primaryType === 'photo' ? palette.photo : palette.text;
        const shouldSplitSamePlaceGroup =
          !node.isCluster &&
          !preferLiteMarkers &&
          node.pointCount > 1 &&
          currentZoom >= samePlaceSplitMinZoom;

        if (shouldSplitSamePlaceGroup) {
          const splitNotes = node.noteIds
            .map((noteId) => noteById.get(noteId) ?? null)
            .filter((note): note is Note => note != null);

          if (splitNotes.length > 1) {
            splitNotes.forEach((note) => {
              const canShowPhotoThumbnail = note.type === 'photo' && currentZoom >= photoOrbMinZoom;

              items.push({
                key: `split-${note.id}`,
                testID: `leaf-marker-${note.id}`,
                coordinate: getSplitNoteCoordinate(note, splitNotes, currentZoom),
                node,
                pointCount: 1,
                isSelected: selectedNote?.id === note.id,
                markerColor: note.type === 'photo' ? palette.photo : palette.text,
                pulseActive: markerPulseId === note.id,
                photoNoteId: canShowPhotoThumbnail ? note.id : null,
                photoUri: canShowPhotoThumbnail ? getNotePhotoUri(note) : null,
                noteId: note.id,
              });
            });

            continue;
          }
        }

        const isSelected = node.groupId != null && node.groupId === selectedGroupId;
        const markerId = node.isCluster ? node.id : node.groupId ?? node.id;
        const pulseActive = markerPulseId === markerId;
        const representativeNote =
          !node.isCluster && node.noteIds.length > 0 ? noteById.get(node.noteIds[0]) ?? null : null;
        const canShowPhotoThumbnail =
          !preferLiteMarkers &&
          !node.isCluster &&
          node.pointCount === 1 &&
          node.primaryType === 'photo' &&
          node.noteIds.length === 1 &&
          currentZoom >= photoOrbMinZoom;

        items.push({
          key: node.id,
          testID: node.isCluster ? `cluster-marker-${node.id}` : `leaf-marker-${node.groupId ?? node.id}`,
          coordinate: { latitude: node.latitude, longitude: node.longitude },
          node,
          pointCount: node.pointCount,
          isSelected,
          markerColor,
          pulseActive,
          photoNoteId: canShowPhotoThumbnail ? representativeNote?.id ?? null : null,
          photoUri:
            canShowPhotoThumbnail && representativeNote ? getNotePhotoUri(representativeNote) : null,
          noteId: null,
        });
      }

      return items.sort((left, right) => {
        const leftPriority = left.node.isCluster ? 0 : left.isSelected ? 2 : 1;
        const rightPriority = right.node.isCluster ? 0 : right.isSelected ? 2 : 1;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        if (left.pointCount !== right.pointCount) {
          return right.pointCount - left.pointCount;
        }

        return left.key.localeCompare(right.key);
      });
    },
    [
      currentZoom,
      markerNodes,
      markerPulseId,
      noteById,
      palette.photo,
      palette.text,
      preferLiteMarkers,
      selectedGroupId,
      selectedNote?.id,
    ]
  );
  const expectedMarkerImageKeys = useMemo(() => {
    const nextKeys = new Set<string>();

    for (const item of markerRenderItems) {
      if (item.photoUri) {
        nextKeys.add(`${item.key}::${item.photoUri}`);
      }
    }

    for (const post of friendMarkers) {
      const avatarUri = post.authorPhotoURLSnapshot?.trim();
      if (avatarUri) {
        nextKeys.add(`friend-${post.id}::${avatarUri}`);
      }

      const sharedPhotoUri = getSharedPostMarkerPhotoUri(post);
      if (sharedPhotoUri) {
        nextKeys.add(`friend-post-${post.id}::${sharedPhotoUri}`);
      }
    }

    return nextKeys;
  }, [friendMarkers, markerRenderItems]);

  useEffect(() => {
    if (!isAndroid) {
      setPendingMarkerImageKeys((current) => (current.size === 0 ? current : new Set()));
      return;
    }

    setPendingMarkerImageKeys((current) => {
      if (
        current.size === expectedMarkerImageKeys.size &&
        Array.from(expectedMarkerImageKeys).every((key) => current.has(key))
      ) {
        return current;
      }

      return new Set(expectedMarkerImageKeys);
    });
  }, [expectedMarkerImageKeys, isAndroid]);

  const handleMarkerImageLoadStart = (imageKey: string) => {
    if (!isAndroid) {
      return;
    }

    setPendingMarkerImageKeys((currentKeys) => {
      if (currentKeys.has(imageKey)) {
        return currentKeys;
      }

      const nextKeys = new Set(currentKeys);
      nextKeys.add(imageKey);
      return nextKeys;
    });
  };

  const handleMarkerImageLoadEnd = (imageKey: string) => {
    if (!isAndroid) {
      return;
    }

    setPendingMarkerImageKeys((currentKeys) => {
      if (!currentKeys.has(imageKey)) {
        return currentKeys;
      }

      const nextKeys = new Set(currentKeys);
      nextKeys.delete(imageKey);
      return nextKeys;
    });
  };
  useEffect(() => {
    return () => {
      if (androidMarkerRefreshTimerRef.current) {
        clearTimeout(androidMarkerRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAndroid || preferLiteMarkers) {
      setAndroidShouldTrackMarkerViews(false);
      return;
    }

    setAndroidShouldTrackMarkerViews(true);

    if (androidMarkerRefreshTimerRef.current) {
      clearTimeout(androidMarkerRefreshTimerRef.current);
    }

    androidMarkerRefreshTimerRef.current = setTimeout(() => {
      setAndroidShouldTrackMarkerViews(false);
      androidMarkerRefreshTimerRef.current = null;
    }, reduceMotionEnabled ? ANDROID_MARKER_REFRESH_MS.reducedMotion : ANDROID_MARKER_REFRESH_MS.standard);
  }, [
    currentZoom,
    friendMarkers,
    isAndroid,
    isDark,
    markerNodes,
    selectedNote?.id,
    preferLiteMarkers,
    reduceMotionEnabled,
    selectedFriendPostId,
    selectedGroupId,
  ]);

  return (
    <MapView
      key={mapViewKey}
      testID="map-canvas"
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onPress={onMapPress}
      onMapReady={onMapReady}
      onRegionChangeComplete={onRegionChangeComplete}
      showsCompass={false}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
      showsIndoorLevelPicker={false}
      userInterfaceStyle={isDark ? 'dark' : 'light'}
    >
      {markerRenderItems.map(
        ({
          key,
          testID,
          coordinate,
          node,
          pointCount,
          isSelected,
          markerColor,
          pulseActive,
          photoNoteId,
          photoUri,
          noteId,
        }) => {
        const showSelectedCallout =
          !preferLiteMarkers &&
          !node.isCluster &&
          Boolean(selectedGroup) &&
          selectedGroup!.notes.length === 1 &&
          Boolean(selectedNote) &&
          node.groupId === selectedGroup!.id;
        const markerZIndex = showSelectedCallout ? 30 : isSelected ? 20 : node.isCluster ? 5 : 10;
        const imageTrackingKey = photoUri ? `${key}::${photoUri}` : null;
        const markerRenderKey = isAndroid
          ? `${key}-${
              showSelectedCallout
                ? `callout-${selectedNote?.id ?? 'none'}`
                : isSelected
                  ? `selected-${noteId ?? node.groupId ?? key}`
                  : 'idle'
            }`
          : key;

        return (
          preferLiteMarkers && !node.isCluster ? (
            <Marker
              key={markerRenderKey}
              testID={testID}
              coordinate={coordinate}
              pinColor={isSelected ? palette.focus : markerColor}
              accessibilityLabel={node.isCluster ? `${formatMarkerCount(pointCount)} notes` : 'Map note marker'}
              onPress={(event) => {
                event.stopPropagation?.();
                if (noteId) {
                  onNotePress(noteId);
                } else if (node.groupId) {
                  onLeafPress(node.groupId);
                }
              }}
            />
          ) : (
            <Marker
              key={markerRenderKey}
              testID={testID}
              coordinate={coordinate}
              anchor={showSelectedCallout ? selectedCalloutAnchor : { x: 0.5, y: 0.5 }}
              accessibilityLabel={node.isCluster ? `${formatMarkerCount(pointCount)} notes` : 'Map note marker'}
              zIndex={markerZIndex}
              tracksViewChanges={
                pulseActive ||
                reduceMotionEnabled ||
                (!isAndroid && (showSelectedCallout || isSelected)) ||
                (isAndroid &&
                  (androidShouldTrackMarkerViews ||
                    (imageTrackingKey ? pendingMarkerImageKeys.has(imageTrackingKey) : false)))
              }
              onPress={(event) => {
                event.stopPropagation?.();
                if (node.isCluster) {
                  onClusterPress(node);
                  return;
                }

                if (noteId) {
                  onNotePress(noteId);
                } else if (node.groupId) {
                  onLeafPress(node.groupId);
                }
              }}
            >
              <View
                style={[
                  styles.markerWrap,
                  showSelectedCallout ? styles.selectedMarkerHitArea : null,
                ]}
                collapsable={false}
              >
                {showSelectedCallout && selectedNote ? (
                  <View pointerEvents="none" style={styles.selectedMarkerOverlay} collapsable={false}>
                    <MapSelectedNoteCallout
                      note={selectedNote}
                      colors={colors}
                      showOrb={false}
                    />
                  </View>
                ) : null}
                <MarkerContent
                  isCluster={node.isCluster}
                  pointCount={pointCount}
                  zoomLevel={currentZoom}
                  showPhotoThumbnail={Boolean(photoUri)}
                  photoNoteId={photoNoteId}
                  photoUri={photoUri}
                  selected={isSelected}
                  color={node.isCluster ? palette.cluster : markerColor}
                  accentColor={palette.focus}
                  cardBackgroundColor={palette.cardBackground}
                  pulseActive={pulseActive}
                  pulseKey={markerPulseKey}
                  reduceMotionEnabled={reduceMotionEnabled}
                  imageTrackingKey={imageTrackingKey}
                  onImageLoadStart={handleMarkerImageLoadStart}
                  onImageLoadEnd={handleMarkerImageLoadEnd}
                />
              </View>
            </Marker>
          )
        );
      })}
      {friendMarkers.map((post) => {
        const isSelected = selectedFriendPostId === post.id;
        const authorLabel = post.authorDisplayName?.trim() || 'F';
        const sharedPhotoUri = getSharedPostMarkerPhotoUri(post);
        const friendImageTrackingKey = post.authorPhotoURLSnapshot?.trim()
          ? `friend-${post.id}::${post.authorPhotoURLSnapshot.trim()}`
          : null;
        const friendPhotoTrackingKey = sharedPhotoUri ? `friend-post-${post.id}::${sharedPhotoUri}` : null;
        const showSelectedFriendCallout = isSelected;
        const friendMarkerKey = isAndroid
          ? `friend-${post.id}-${showSelectedFriendCallout ? 'callout' : isSelected ? 'selected' : 'idle'}`
          : `friend-${post.id}`;

        return (
          preferLiteMarkers ? (
            <Marker
              key={friendMarkerKey}
              testID={`friend-marker-${post.id}`}
              coordinate={{ latitude: post.latitude, longitude: post.longitude }}
              pinColor={isSelected ? palette.friend : palette.focus}
              accessibilityLabel={`${authorLabel}'s shared map marker`}
              onPress={(event) => {
                event.stopPropagation?.();
                onFriendPress(post.id);
              }}
            />
          ) : (
            <Marker
              key={friendMarkerKey}
              testID={`friend-marker-${post.id}`}
              coordinate={{ latitude: post.latitude, longitude: post.longitude }}
              anchor={showSelectedFriendCallout ? selectedCalloutAnchor : { x: 0.5, y: 0.5 }}
              accessibilityLabel={`${authorLabel}'s shared map marker`}
              tracksViewChanges={
                reduceMotionEnabled ||
                (!isAndroid && showSelectedFriendCallout) ||
                (isAndroid &&
                  (androidShouldTrackMarkerViews ||
                    (friendImageTrackingKey
                      ? pendingMarkerImageKeys.has(friendImageTrackingKey)
                      : false) ||
                    (friendPhotoTrackingKey
                      ? pendingMarkerImageKeys.has(friendPhotoTrackingKey)
                      : false)))
              }
              zIndex={showSelectedFriendCallout ? 30 : isSelected ? 20 : 10}
              onPress={(event) => {
                event.stopPropagation?.();
                onFriendPress(post.id);
              }}
            >
              <View
                style={[
                  styles.markerWrap,
                  showSelectedFriendCallout ? styles.selectedFriendMarkerHitArea : null,
                ]}
                collapsable={false}
              >
                {showSelectedFriendCallout ? (
                  <View pointerEvents="none" style={styles.selectedFriendMarkerOverlay} collapsable={false}>
                    <MapSharedPostCallout
                      post={post}
                      colors={colors}
                      photoUri={sharedPhotoUri}
                    />
                  </View>
                ) : null}

                <View
                  style={[
                    sharedPhotoUri ? styles.friendPhotoMarker : styles.friendMarker,
                    {
                      borderColor: isSelected ? palette.friend : '#FFFFFF',
                      backgroundColor: sharedPhotoUri
                        ? palette.cardBackground
                        : isSelected
                          ? `${palette.friend}24`
                          : palette.friendSoft,
                    },
                  ]}
                >
                  {sharedPhotoUri ? (
                    <View style={styles.friendPhotoImageWrap}>
                      <Image
                        source={{ uri: sharedPhotoUri }}
                        style={styles.friendPhotoImage}
                        contentFit="cover"
                        transition={0}
                        onLoadStart={() => {
                          if (friendPhotoTrackingKey) {
                            handleMarkerImageLoadStart(friendPhotoTrackingKey);
                          }
                        }}
                        onLoad={() => {
                          if (friendPhotoTrackingKey) {
                            handleMarkerImageLoadEnd(friendPhotoTrackingKey);
                          }
                        }}
                        onError={() => {
                          if (friendPhotoTrackingKey) {
                            handleMarkerImageLoadEnd(friendPhotoTrackingKey);
                          }
                        }}
                      />
                    </View>
                  ) : post.authorPhotoURLSnapshot ? (
                    <Image
                      source={{ uri: post.authorPhotoURLSnapshot }}
                      style={styles.friendAvatar}
                      contentFit="cover"
                      transition={0}
                      onLoadStart={() => {
                        if (friendImageTrackingKey) {
                          handleMarkerImageLoadStart(friendImageTrackingKey);
                        }
                      }}
                      onLoad={() => {
                        if (friendImageTrackingKey) {
                          handleMarkerImageLoadEnd(friendImageTrackingKey);
                        }
                      }}
                      onError={() => {
                        if (friendImageTrackingKey) {
                          handleMarkerImageLoadEnd(friendImageTrackingKey);
                        }
                      }}
                    />
                  ) : (
                    <View style={[styles.friendAvatar, { backgroundColor: palette.friendSoft }]}>
                      <Text style={[styles.friendInitial, { color: palette.friend }]}>
                        {authorLabel.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      sharedPhotoUri ? styles.friendAuthorBadgeWrap : styles.friendBadge,
                      { backgroundColor: sharedPhotoUri ? palette.cardBackground : palette.friend },
                    ]}
                  >
                    {post.authorPhotoURLSnapshot ? (
                      <Image
                        source={{ uri: post.authorPhotoURLSnapshot }}
                        style={sharedPhotoUri ? styles.friendAuthorBadge : styles.friendBadgeAvatar}
                        contentFit="cover"
                        transition={0}
                        onLoadStart={() => {
                          if (friendImageTrackingKey) {
                            handleMarkerImageLoadStart(friendImageTrackingKey);
                          }
                        }}
                        onLoad={() => {
                          if (friendImageTrackingKey) {
                            handleMarkerImageLoadEnd(friendImageTrackingKey);
                          }
                        }}
                        onError={() => {
                          if (friendImageTrackingKey) {
                            handleMarkerImageLoadEnd(friendImageTrackingKey);
                          }
                        }}
                      />
                    ) : sharedPhotoUri ? (
                      <View style={[styles.friendAuthorBadge, { backgroundColor: palette.friendSoft }]}>
                        <Text style={[styles.friendBadgeInitial, { color: palette.friend }]}>
                          {authorLabel.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    ) : (
                      <Ionicons name="sparkles" size={9} color="#FFFFFF" />
                    )}
                  </View>
                </View>
              </View>
            </Marker>
          )
        );
      })}
    </MapView>
  );
}

export default memo(MapCanvas);

const styles = StyleSheet.create({
  markerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
    minHeight: 60,
  },
  selectedMarkerHitArea: {
    minWidth: 212,
    minHeight: 148,
    justifyContent: 'flex-end',
  },
  selectedMarkerOverlay: {
    position: 'absolute',
    bottom: 52,
    width: 204,
    alignItems: 'center',
  },
  selectedFriendMarkerHitArea: {
    minWidth: 204,
    minHeight: 206,
    justifyContent: 'flex-end',
  },
  selectedFriendMarkerOverlay: {
    position: 'absolute',
    bottom: 54,
    width: 196,
    alignItems: 'center',
  },
  halo: {
    position: 'absolute',
  },
  clusterMarker: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  clusterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  groupMarker: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  groupMarkerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  photoMarkerShell: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  photoMarkerOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  photoMarkerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  photoMarkerBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  markerOrb: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
    overflow: 'visible',
  },
  markerOrbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  singleMarkerIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  friendPhotoMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  friendPhotoImageWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  friendPhotoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  friendInitial: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  friendAuthorBadgeWrap: {
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  friendAuthorBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  friendBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendBadgeAvatar: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  friendBadgeInitial: {
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
});
