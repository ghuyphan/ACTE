import { Ionicons } from '@expo/vector-icons';
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
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import type { SharedPost } from '../../services/sharedFeedService';
import { mapMotionDurations, mapMotionEasing } from './mapMotion';

const SELECTED_RICH_PREVIEW_MIN_ZOOM = 16;
const PHOTO_ORB_MIN_ZOOM = 16;

type SharedPostWithCoordinates = SharedPost & {
  latitude: number;
  longitude: number;
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
  selectedFriendPostId: string | null;
  markerPulseId: string | null;
  markerPulseKey: number;
  reduceMotionEnabled: boolean;
  onMapPress: () => void;
  onMapReady: () => void;
  onRegionChangeComplete: (region: Region) => void;
  onLeafPress: (groupId: string) => void;
  onClusterPress: (node: MapClusterNode) => void;
  onFriendPress: (postId: string) => void;
  colors: ThemeColors;
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

function getMarkerPreviewText(note: Note) {
  const primarySource = note.type === 'text'
    ? note.content
    : note.promptAnswer || note.promptTextSnapshot || note.locationName || '';
  const normalized = formatNoteTextWithEmoji(primarySource, note.moodEmoji).trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 52 ? `${normalized.slice(0, 51)}…` : normalized;
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
    return 0.64 + zoomProgress * 0.36;
  }

  if (variant === 'group') {
    return 0.72 + zoomProgress * 0.28;
  }

  return 0.68 + zoomProgress * 0.32;
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
  const enterProgress = useSharedValue(0);

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
      transform: [{ scale: enterScale * scaleBoost * leafMarkerBaseScale }],
    };
  }, [isCluster, leafMarkerBaseScale, pointCount]);

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
            <View style={[styles.singleMarkerIconWrap, { backgroundColor: `${color}16` }]}>
              <Ionicons name="document-text" size={14} color={selected ? accentColor : color} />
            </View>
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
  friendMarkers,
  noteById,
  selectedGroupId,
  selectedFriendPostId,
  markerPulseId,
  markerPulseKey,
  reduceMotionEnabled,
  onMapPress,
  onMapReady,
  onRegionChangeComplete,
  onLeafPress,
  onClusterPress,
  onFriendPress,
  colors,
}: MapCanvasProps) {
  const palette = useMemo(() => getMapPalette(colors, isDark), [colors, isDark]);

  const markerRenderItems = useMemo(
    () =>
      markerNodes.map((node) => {
        const isSelected = node.groupId != null && node.groupId === selectedGroupId;
        const markerColor = node.primaryType === 'photo' ? palette.photo : palette.text;
        const markerId = node.isCluster ? node.id : node.groupId ?? node.id;
        const pulseActive = markerPulseId === markerId;
        const representativeNote =
          !node.isCluster && node.noteIds.length > 0 ? noteById.get(node.noteIds[0]) ?? null : null;
        const previewNote = !node.isCluster && representativeNote && isSelected ? representativeNote : null;
        const showRichPreviewMarker =
          Boolean(previewNote) &&
          node.pointCount === 1 &&
          currentZoom >= SELECTED_RICH_PREVIEW_MIN_ZOOM;
        const showStackPreviewMarker = false;
        const canShowPhotoThumbnail =
          !showRichPreviewMarker &&
          !node.isCluster &&
          node.pointCount === 1 &&
          node.primaryType === 'photo' &&
          node.noteIds.length === 1 &&
          currentZoom >= PHOTO_ORB_MIN_ZOOM;
        const photoNote = canShowPhotoThumbnail
          ? noteById.get(node.noteIds[0]) ?? null
          : representativeNote && (showRichPreviewMarker || showStackPreviewMarker)
            ? representativeNote
            : previewNote;

        return {
          node,
          isSelected,
          markerColor,
          pulseActive,
          showRichPreviewMarker,
          showStackPreviewMarker,
          usesFloatingLabel: showRichPreviewMarker,
          previewNoteId: (previewNote ?? representativeNote)?.id ?? null,
          photoNoteId: photoNote?.id ?? null,
          photoUri: photoNote ? getNotePhotoUri(photoNote) : null,
          previewTitle: (previewNote ?? representativeNote)?.locationName?.trim() || null,
          previewText: previewNote ?? representativeNote ? getMarkerPreviewText(previewNote ?? representativeNote!) : null,
          countBadgeLabel: node.pointCount > 1 ? String(node.pointCount) : null,
        };
      }),
    [currentZoom, markerNodes, markerPulseId, noteById, palette.photo, palette.text, selectedGroupId]
  );

  return (
    <MapView
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
      userInterfaceStyle={isDark ? 'dark' : 'light'}
    >
      {markerRenderItems.map(
        ({
          node,
          isSelected,
          markerColor,
          pulseActive,
          showRichPreviewMarker,
          showStackPreviewMarker,
          usesFloatingLabel,
          previewNoteId,
          photoNoteId,
          photoUri,
          previewTitle,
          previewText,
          countBadgeLabel,
        }) => {
        return (
          <Marker
            key={node.id}
            testID={node.isCluster ? `cluster-marker-${node.id}` : `leaf-marker-${node.groupId ?? node.id}`}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            anchor={usesFloatingLabel ? { x: 0.5, y: 0.28 } : { x: 0.5, y: 0.5 }}
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
            <View
              style={[
                styles.markerWrap,
                showRichPreviewMarker ? styles.richMarkerHitArea : null,
                showStackPreviewMarker ? styles.stackMarkerHitArea : null,
              ]}
              collapsable={false}
            >
              <MarkerContent
                isCluster={node.isCluster}
                pointCount={node.pointCount}
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
        );
      })}
      {friendMarkers.map((post) => {
        const isSelected = selectedFriendPostId === post.id;
        const authorLabel = post.authorDisplayName?.trim() || 'F';

        return (
          <Marker
            key={`friend-${post.id}`}
            testID={`friend-marker-${post.id}`}
            coordinate={{ latitude: post.latitude, longitude: post.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={isSelected || reduceMotionEnabled}
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
  richMarkerHitArea: {
    minWidth: 164,
    minHeight: 108,
    paddingBottom: 14,
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
    fontFamily: 'System',
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
    fontFamily: 'System',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    minWidth: 132,
    maxWidth: 168,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  richMarkerTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'System',
    marginBottom: 2,
  },
  richMarkerText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    fontFamily: 'System',
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
    fontFamily: 'System',
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
    fontFamily: 'System',
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
    fontFamily: 'System',
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
    fontFamily: 'System',
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
