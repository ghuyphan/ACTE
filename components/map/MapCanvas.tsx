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
  showRichPreviewMarker: boolean;
  showStackPreviewMarker: boolean;
  previewNoteId: string | null;
  photoNoteId: string | null;
  photoUri: string | null;
  previewTitle: string | null;
  previewText: string | null;
  countBadgeLabel: string | null;
  noteId: string | null;
}

interface MarkerContentProps {
  isCluster: boolean;
  pointCount: number;
  zoomLevel: number;
  showRichPreview: boolean;
  showStackPreview: boolean;
  previewNoteId: string | null;
  showPhotoThumbnail: boolean;
  photoNoteId: string | null;
  photoUri: string | null;
  previewTitle: string | null;
  previewText: string | null;
  countBadgeLabel: string | null;
  selected: boolean;
  color: string;
  accentColor: string;
  cardBackgroundColor: string;
  cardTextColor: string;
  cardSubtextColor: string;
  labelShadowColor: string;
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

function getMapPalette(colors: ThemeColors, isDark: boolean) {
  return {
    focus: colors.primary,
    cluster: colors.primary,
    text: colors.primary,
    photo: colors.primary,
    cardBackground: colors.card,
    cardText: colors.text,
    cardSubtext: colors.secondaryText,
    friend: colors.primary,
    friendSoft: colors.primarySoft,
    labelShadow: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(43,38,33,0.14)',
  };
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
  const ringRadiusMeters = Math.max(5, Math.min(14, metersPerPixel * (count === 2 ? 22 : 26)));
  const angleOffset = count === 2 ? 0 : -Math.PI / 2;
  const angle = angleOffset + (index / count) * Math.PI * 2;
  const longitudeMetersPerDegree = Math.max(
    1,
    Math.cos((latitude * Math.PI) / 180) * earthMetersPerDegree
  );

  return {
    latitude: latitude + (ringRadiusMeters * Math.sin(angle)) / earthMetersPerDegree,
    longitude: longitude + (ringRadiusMeters * Math.cos(angle)) / longitudeMetersPerDegree,
  };
}

const MarkerContent = memo(function MarkerContent({
  isCluster,
  pointCount,
  zoomLevel,
  showRichPreview,
  showStackPreview,
  previewNoteId,
  showPhotoThumbnail,
  photoNoteId,
  photoUri,
  previewTitle,
  previewText,
  countBadgeLabel,
  selected,
  color,
  accentColor,
  cardBackgroundColor,
  cardTextColor,
  cardSubtextColor,
  labelShadowColor,
  pulseActive,
  pulseKey,
  reduceMotionEnabled,
}: MarkerContentProps) {
  const activeProgress = useSharedValue(selected ? 1 : 0);
  const pulseProgress = useSharedValue(0);

  const size = useMemo(() => (isCluster ? getClusterSize(pointCount) : pointCount > 1 ? 33 : 18), [isCluster, pointCount]);
  const leafMarkerBaseScale = useMemo(() => {
    if (isCluster || showRichPreview || showStackPreview) {
      return 1;
    }

    if (showPhotoThumbnail) {
      return getLeafMarkerBaseScale(zoomLevel, 'photo');
    }

    if (pointCount > 1) {
      return getLeafMarkerBaseScale(zoomLevel, 'group');
    }

    return getLeafMarkerBaseScale(zoomLevel, 'single');
  }, [isCluster, pointCount, showPhotoThumbnail, showRichPreview, showStackPreview, zoomLevel]);
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
    const lift = isCluster || showRichPreview || showStackPreview
      ? 0
      : interpolate(focusProgress, [0, 1], [0, pointCount > 1 ? -0.5 : -1]);
    return {
      transform: [
        { translateY: lift },
        { scale: scaleBoost * scaleProgress.value },
      ],
    };
  }, [isCluster, pointCount, scaleProgress, showRichPreview, showStackPreview]);

  const haloStyle = useAnimatedStyle(() => {
    const focusProgress = Math.max(activeProgress.value, pulseProgress.value);
    return {
      opacity: interpolate(focusProgress, [0, 1], [0, isCluster ? 0.14 : 0.2]),
      transform: [{ scale: interpolate(focusProgress, [0, 1], [0.94, isCluster ? 1.12 : 1.16]) }],
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
            <Text style={styles.clusterText}>{pointCount}</Text>
          </Reanimated.View>
        ) : showRichPreview ? (
          <View
            testID={previewNoteId ? `note-marker-${previewNoteId}` : undefined}
            style={styles.richMarkerWrap}
          >
            <View
              style={[
                styles.markerOrb,
                styles.richMarkerOrb,
                {
                  borderColor: accentColor,
                  backgroundColor: cardBackgroundColor,
                },
              ]}
            >
              {photoUri ? (
                <Image
                  testID={photoNoteId ? `photo-marker-${photoNoteId}` : undefined}
                  source={{ uri: photoUri }}
                  style={styles.richMarkerImage}
                  contentFit="cover"
                  transition={0}
                />
              ) : (
                <View style={[styles.richMarkerIconWrap, { backgroundColor: `${accentColor}14` }]}>
                  <Ionicons name="document-text" size={18} color={accentColor} />
                </View>
              )}

              {countBadgeLabel ? (
                <View style={[styles.markerCountBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.markerCountBadgeText}>{countBadgeLabel}</Text>
                </View>
              ) : null}
            </View>
            <View
              style={[
                styles.richMarkerLabel,
                {
                  backgroundColor: cardBackgroundColor,
                  shadowColor: labelShadowColor,
                },
              ]}
            >
              {previewTitle ? (
                <Text style={[styles.richMarkerTitle, { color: cardTextColor }]} numberOfLines={1}>
                  {previewTitle}
                </Text>
              ) : null}
              {previewText ? (
                <Text style={[styles.richMarkerText, { color: cardSubtextColor }]} numberOfLines={2}>
                  {previewText}
                </Text>
              ) : null}
            </View>
          </View>
        ) : showStackPreview ? (
          <View
            testID={previewNoteId ? `stack-marker-${previewNoteId}` : undefined}
            style={styles.stackMarkerWrap}
          >
            <View
              style={[
                styles.markerOrb,
                styles.stackMarkerOrb,
                {
                  borderColor: selected ? accentColor : color,
                  backgroundColor: cardBackgroundColor,
                },
              ]}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={styles.stackMarkerImage}
                  contentFit="cover"
                  transition={0}
                />
              ) : (
                <View style={[styles.stackMarkerIconWrap, { backgroundColor: `${color}16` }]}>
                  <Ionicons name="albums" size={16} color={color} />
                </View>
              )}
              {countBadgeLabel ? (
                <View style={[styles.stackMarkerBadge, { backgroundColor: color }]}>
                  <Text style={styles.stackMarkerBadgeText}>{countBadgeLabel}</Text>
                </View>
              ) : null}
            </View>
            <View
              style={[
                styles.stackMarkerLabel,
                {
                  backgroundColor: cardBackgroundColor,
                  shadowColor: labelShadowColor,
                },
              ]}
            >
              <Text style={[styles.stackMarkerTitle, { color: cardTextColor }]} numberOfLines={1}>
                {previewTitle || `${pointCount} notes`}
              </Text>
            </View>
          </View>
        ) : showPhotoThumbnail && photoUri ? (
          <View style={styles.markerOrbWrap}>
            <View
              testID={photoNoteId ? `photo-marker-${photoNoteId}` : undefined}
              style={[
                styles.markerOrb,
                styles.stackMarkerOrb,
                {
                  borderColor: selected ? accentColor : 'rgba(255,255,255,0.96)',
                  backgroundColor: cardBackgroundColor,
                },
              ]}
            >
              <View style={styles.photoMarkerImageWrap}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoMarkerImage}
                  contentFit="cover"
                  transition={0}
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
            <Text style={styles.groupMarkerText}>{pointCount}</Text>
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
  const androidMarkerRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCalloutAnchor = useMemo(() => ({ x: 0.5, y: 0.86 }), []);
  // Android applies map color scheme only from initial props, so remount on theme flips.
  const mapViewKey = isAndroid ? `map-${isDark ? 'dark' : 'light'}` : 'map';

  const markerRenderItems = useMemo<MarkerRenderItem[]>(
    () =>
      markerNodes.reduce<MarkerRenderItem[]>((items, node) => {
        const markerColor = node.primaryType === 'photo' ? palette.photo : palette.text;
        const showRichPreviewMarker = false;
        const showStackPreviewMarker = false;
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
            return items.concat(splitNotes.map<MarkerRenderItem>((note, index) => {
              const canShowPhotoThumbnail = note.type === 'photo' && currentZoom >= photoOrbMinZoom;

              return {
                key: `split-${note.id}`,
                testID: `leaf-marker-${note.id}`,
                coordinate: getSeparatedNoteCoordinate(
                  node.latitude,
                  node.longitude,
                  index,
                  splitNotes.length,
                  currentZoom
                ),
                node,
                pointCount: 1,
                isSelected: selectedNote?.id === note.id,
                markerColor: note.type === 'photo' ? palette.photo : palette.text,
                pulseActive: markerPulseId === note.id,
                showRichPreviewMarker,
                showStackPreviewMarker,
                previewNoteId: null,
                photoNoteId: canShowPhotoThumbnail ? note.id : null,
                photoUri: canShowPhotoThumbnail ? getNotePhotoUri(note) : null,
                previewTitle: null,
                previewText: null,
                countBadgeLabel: null,
                noteId: note.id,
              };
            }));
          }
        }

        const isSelected = node.groupId != null && node.groupId === selectedGroupId;
        const markerId = node.isCluster ? node.id : node.groupId ?? node.id;
        const pulseActive = markerPulseId === markerId;
        const representativeNote =
          !node.isCluster && node.noteIds.length > 0 ? noteById.get(node.noteIds[0]) ?? null : null;
        const canShowPhotoThumbnail =
          !preferLiteMarkers &&
          !showRichPreviewMarker &&
          !node.isCluster &&
          node.pointCount === 1 &&
          node.primaryType === 'photo' &&
          node.noteIds.length === 1 &&
          currentZoom >= photoOrbMinZoom;

        return items.concat({
          key: node.id,
          testID: node.isCluster ? `cluster-marker-${node.id}` : `leaf-marker-${node.groupId ?? node.id}`,
          coordinate: { latitude: node.latitude, longitude: node.longitude },
          node,
          pointCount: node.pointCount,
          isSelected,
          markerColor,
          pulseActive,
          showRichPreviewMarker,
          showStackPreviewMarker,
          previewNoteId: null,
          photoNoteId: canShowPhotoThumbnail ? representativeNote?.id ?? null : null,
          photoUri:
            canShowPhotoThumbnail && representativeNote ? getNotePhotoUri(representativeNote) : null,
          previewTitle: null,
          previewText: null,
          countBadgeLabel: node.pointCount > 1 ? String(node.pointCount) : null,
          noteId: null,
        });
      }, []),
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
    }, reduceMotionEnabled ? 120 : 320);
  }, [
    currentZoom,
    friendMarkers,
    isAndroid,
    isDark,
    markerNodes,
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
          showRichPreviewMarker,
          showStackPreviewMarker,
          previewNoteId,
          photoNoteId,
          photoUri,
          previewTitle,
          previewText,
          countBadgeLabel,
          noteId,
        }) => {
        const showSelectedCallout =
          !preferLiteMarkers &&
          !node.isCluster &&
          Boolean(selectedGroup) &&
          selectedGroup!.notes.length === 1 &&
          Boolean(selectedNote) &&
          node.groupId === selectedGroup!.id;
        const markerKey = showSelectedCallout ? `${key}-selected-${selectedNote!.id}` : key;
        const markerZIndex = showSelectedCallout ? 30 : isSelected ? 20 : node.isCluster ? 5 : 10;

        return (
          preferLiteMarkers && !node.isCluster ? (
            <Marker
              key={key}
              testID={testID}
              coordinate={coordinate}
              pinColor={isSelected ? palette.focus : markerColor}
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
              key={markerKey}
              testID={testID}
              coordinate={coordinate}
              anchor={showSelectedCallout ? selectedCalloutAnchor : { x: 0.5, y: 0.5 }}
              zIndex={markerZIndex}
              tracksViewChanges={
                showSelectedCallout ||
                isSelected ||
                pulseActive ||
                reduceMotionEnabled ||
                (isAndroid && androidShouldTrackMarkerViews)
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
                  showRichPreviewMarker ? styles.richMarkerHitArea : null,
                  showStackPreviewMarker ? styles.stackMarkerHitArea : null,
                ]}
                collapsable={false}
              >
                {showSelectedCallout && selectedNote ? (
                  <View pointerEvents="none" style={styles.selectedMarkerOverlay} collapsable={false}>
                    <MapSelectedNoteCallout
                      note={selectedNote}
                      colors={colors}
                      visible
                      reduceMotionEnabled={reduceMotionEnabled}
                      showOrb={false}
                    />
                  </View>
                ) : null}
                <MarkerContent
                  isCluster={node.isCluster}
                  pointCount={pointCount}
                  zoomLevel={currentZoom}
                  showRichPreview={showRichPreviewMarker}
                  showStackPreview={showStackPreviewMarker}
                  previewNoteId={previewNoteId}
                  showPhotoThumbnail={Boolean(photoUri)}
                  photoNoteId={photoNoteId}
                  photoUri={photoUri}
                  previewTitle={previewTitle}
                  previewText={previewText}
                  countBadgeLabel={showRichPreviewMarker || showStackPreviewMarker ? countBadgeLabel : null}
                  selected={isSelected}
                  color={node.isCluster ? palette.cluster : markerColor}
                  accentColor={palette.focus}
                  cardBackgroundColor={palette.cardBackground}
                  cardTextColor={palette.cardText}
                  cardSubtextColor={palette.cardSubtext}
                  labelShadowColor={palette.labelShadow}
                  pulseActive={pulseActive}
                  pulseKey={markerPulseKey}
                  reduceMotionEnabled={reduceMotionEnabled}
                />
              </View>
            </Marker>
          )
        );
      })}
      {friendMarkers.map((post) => {
        const isSelected = selectedFriendPostId === post.id;
        const authorLabel = post.authorDisplayName?.trim() || 'F';

        return (
          preferLiteMarkers ? (
            <Marker
              key={`friend-${post.id}`}
              testID={`friend-marker-${post.id}`}
              coordinate={{ latitude: post.latitude, longitude: post.longitude }}
              pinColor={isSelected ? palette.friend : palette.focus}
              onPress={(event) => {
                event.stopPropagation?.();
                onFriendPress(post.id);
              }}
            />
          ) : (
            <Marker
              key={`friend-${post.id}`}
              testID={`friend-marker-${post.id}`}
              coordinate={{ latitude: post.latitude, longitude: post.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={
                isSelected || reduceMotionEnabled || (isAndroid && androidShouldTrackMarkerViews)
              }
              zIndex={isSelected ? 20 : 10}
              onPress={(event) => {
                event.stopPropagation?.();
                onFriendPress(post.id);
              }}
            >
              <View style={styles.markerWrap} collapsable={false}>
                <View
                  style={[
                    styles.friendMarker,
                    {
                      borderColor: isSelected ? palette.friend : '#FFFFFF',
                      backgroundColor: isSelected ? `${palette.friend}24` : palette.friendSoft,
                    },
                  ]}
                >
                  {post.authorPhotoURLSnapshot ? (
                    <Image
                      source={{ uri: post.authorPhotoURLSnapshot }}
                      style={styles.friendAvatar}
                      contentFit="cover"
                      transition={0}
                    />
                  ) : (
                    <View style={[styles.friendAvatar, { backgroundColor: palette.friendSoft }]}>
                      <Text style={[styles.friendInitial, { color: palette.friend }]}>
                        {authorLabel.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.friendBadge, { backgroundColor: palette.friend }]}>
                    <Ionicons name="sparkles" size={9} color="#FFFFFF" />
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
    minWidth: 176,
    minHeight: 136,
    justifyContent: 'flex-end',
  },
  selectedMarkerOverlay: {
    position: 'absolute',
    bottom: 50,
    width: 176,
    alignItems: 'center',
  },
  richMarkerHitArea: {
    minWidth: 164,
    minHeight: 108,
  },
  stackMarkerHitArea: {
    minWidth: 116,
    minHeight: 86,
    paddingBottom: 10,
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
  photoMarker: {
    overflow: 'hidden',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMarkerImageWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  photoMarkerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
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
  richMarkerWrap: {
    width: 176,
    height: 136,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  richMarkerOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  richMarkerImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  richMarkerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  richMarkerLabel: {
    width: 168,
    height: 68,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  richMarkerTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 2,
  },
  richMarkerText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  markerCountBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 11,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  stackMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stackMarkerOrb: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  stackMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  stackMarkerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackMarkerLabel: {
    maxWidth: 148,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  stackMarkerTitle: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  stackMarkerBadge: {
    position: 'absolute',
    top: -6,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stackMarkerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 10,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
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
});
