import { Image } from 'expo-image';
import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Radii, Typography } from '../../../constants/theme';
import { useStickerPhysics, type StickerPhysicsState } from '../../../hooks/useStickerPhysics';
import { useTheme } from '../../../hooks/useTheme';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import {
  getStickerOutlineOffsets,
  getStickerOutlineSize,
} from '../stickerCanvasMetrics';
import LivePhotoIcon from '../../ui/LivePhotoIcon';

export interface RecapStickerPileItem {
  key: string;
  kind: 'sticker' | 'photo';
  previewUri: string;
  count: number;
  assetWidth?: number;
  assetHeight?: number;
  outlineEnabled?: boolean;
  isLivePhoto?: boolean;
  pairedVideoUri?: string | null;
}

interface RecapStickerPileProps {
  title?: string;
  items: RecapStickerPileItem[];
  deferUntilAfterInteractions?: boolean;
}

type PilePosition = {
  x: number;
  y: number;
  size: number;
  rotate: number;
};

type PileItemMetrics = {
  width: number;
  height: number;
  outlineSize: number;
};

const RECAP_MIN_PHYSICS_BASE = 52;
const STICKER_OUTLINE_COLOR = 'rgba(255,255,255,0.98)';
const PREFER_CONTINUOUS_OUTLINE = Platform.OS === 'android';

function getPilePositions(count: number): PilePosition[] {
  if (count <= 1) {
    return [{ x: 0.5, y: 92, size: 156, rotate: -5 }];
  }

  if (count === 2) {
    return [
      { x: 0.34, y: 84, size: 124, rotate: -8 },
      { x: 0.68, y: 114, size: 110, rotate: 7 },
    ];
  }

  if (count === 3) {
    return [
      { x: 0.22, y: 126, size: 92, rotate: -10 },
      { x: 0.5, y: 82, size: 114, rotate: 3 },
      { x: 0.78, y: 126, size: 92, rotate: 8 },
    ];
  }

  if (count === 4) {
    return [
      { x: 0.18, y: 126, size: 80, rotate: -10 },
      { x: 0.39, y: 84, size: 92, rotate: -5 },
      { x: 0.62, y: 90, size: 92, rotate: 6 },
      { x: 0.82, y: 128, size: 76, rotate: 10 },
    ];
  }

  if (count <= 6) {
    return [
      { x: 0.14, y: 124, size: 70, rotate: -10 },
      { x: 0.29, y: 84, size: 78, rotate: -7 },
      { x: 0.46, y: 134, size: 68, rotate: 4 },
      { x: 0.61, y: 88, size: 76, rotate: 8 },
      { x: 0.77, y: 128, size: 68, rotate: -8 },
      { x: 0.88, y: 90, size: 62, rotate: 10 },
    ];
  }

  return [
    { x: 0.1, y: 126, size: 60, rotate: -10 },
    { x: 0.22, y: 88, size: 66, rotate: -6 },
    { x: 0.34, y: 138, size: 58, rotate: 4 },
    { x: 0.47, y: 94, size: 64, rotate: 8 },
    { x: 0.59, y: 142, size: 56, rotate: -8 },
    { x: 0.71, y: 96, size: 64, rotate: 7 },
    { x: 0.83, y: 136, size: 56, rotate: -6 },
    { x: 0.91, y: 92, size: 52, rotate: 10 },
  ];
}

function getItemAssetSize(item: RecapStickerPileItem) {
  if (item.kind === 'sticker') {
    return {
      width: Math.max(item.assetWidth ?? 100, 1),
      height: Math.max(item.assetHeight ?? 100, 1),
    };
  }

  return {
    width: 100,
    height: 100,
  };
}

function getPileItemMetrics(item: RecapStickerPileItem, size: number): PileItemMetrics {
  if (item.kind === 'photo') {
    return {
      width: size,
      height: size,
      outlineSize: 0,
    };
  }

  const assetSize = getItemAssetSize(item);
  const longestEdge = Math.max(assetSize.width, assetSize.height, 1);
  const width = assetSize.width * (size / longestEdge);
  const height = assetSize.height * (size / longestEdge);

  return {
    width,
    height,
    outlineSize: getStickerOutlineSize(width, height),
  };
}

function buildPlacement(
  item: RecapStickerPileItem,
  position: PilePosition,
  width: number,
  height: number,
  metrics: PileItemMetrics,
  zIndex: number
): NoteStickerPlacement {
  const baseSize = Math.max(RECAP_MIN_PHYSICS_BASE, Math.min(width, height) * 0.3);
  const assetSize = getItemAssetSize(item);
  const scale = position.size / Math.max(baseSize, 1);
  const topInset = 6;
  const centerX = Math.min(
    Math.max(position.x * width, metrics.width / 2),
    Math.max(metrics.width / 2, width - metrics.width / 2)
  );
  const centerY = Math.min(
    Math.max(position.y, metrics.height / 2 + topInset),
    Math.max(metrics.height / 2 + topInset, height - metrics.height / 2 - 6)
  );

  return {
    id: item.key,
    assetId: `${item.key}:asset`,
    x: centerX / Math.max(width, 1),
    y: centerY / Math.max(height, 1),
    scale,
    rotation: position.rotate,
    zIndex,
    opacity: 1,
    outlineEnabled: item.kind === 'photo' ? false : item.outlineEnabled !== false,
    motionLocked: false,
    asset: {
      id: `${item.key}:asset`,
      ownerUid: 'recap',
      localUri: item.previewUri,
      remotePath: null,
      uploadFingerprint: null,
      mimeType: item.kind === 'photo' ? 'image/jpeg' : 'image/png',
      width: assetSize.width,
      height: assetSize.height,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: null,
      source: 'import',
    },
  };
}

const RecapBubble = memo(function RecapBubble({
  item,
  metrics,
  physicsState,
}: {
  item: RecapStickerPileItem;
  metrics: PileItemMetrics;
  physicsState: SharedValue<StickerPhysicsState[]>;
}) {
  const { colors } = useTheme();
  const outlineOffsets = useMemo(
    () =>
      item.kind === 'sticker' && item.outlineEnabled !== false
        ? getStickerOutlineOffsets(metrics.outlineSize, {
            preferContinuous: PREFER_CONTINUOUS_OUTLINE,
          })
        : [],
    [item.kind, item.outlineEnabled, metrics.outlineSize]
  );

  const bubbleStyle = useAnimatedStyle(() => {
    const state = physicsState.value.find((candidate: StickerPhysicsState) => candidate.id === item.key);

    if (!state) {
      return {
        opacity: 0,
      };
    }

    return {
      opacity: state.opacity,
      transform: [
        { translateX: state.x - metrics.width / 2 },
        { translateY: state.y - metrics.height / 2 },
        { rotate: `${state.rotation}deg` },
        { scaleX: state.jellyScaleX },
        { scaleY: state.jellyScaleY },
      ],
    };
  }, [item.key, metrics.height, metrics.width, physicsState]);

  return (
    <>
      <Animated.View
        style={[
          styles.bubbleWrap,
          {
            width: metrics.width,
            height: metrics.height,
          },
          bubbleStyle,
        ]}
      >
        {item.kind === 'photo' ? (
          <View
            style={[
              styles.photoBubble,
              {
                width: metrics.width,
                height: metrics.height,
              },
            ]}
          >
            <Image source={{ uri: item.previewUri }} style={styles.photoImage} contentFit="cover" />
            {item.isLivePhoto ? (
              <View style={[styles.liveBadge, { backgroundColor: colors.card }]}>
                <LivePhotoIcon size={14} color={colors.primary} />
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.stickerBubble,
              {
                width: metrics.width,
                height: metrics.height,
              },
            ]}
          >
            <View style={styles.stickerInner}>
              {item.outlineEnabled !== false ? (
                <View pointerEvents="none" style={styles.stickerOutlineLayer}>
                  {outlineOffsets.map((offset, index) => (
                    <Image
                      key={`${item.key}-outline-${index}`}
                      source={{ uri: item.previewUri }}
                      style={[
                        styles.stickerImage,
                        {
                          tintColor: STICKER_OUTLINE_COLOR,
                          opacity: 0.92,
                          transform: [
                            { translateX: offset.x * metrics.outlineSize },
                            { translateY: offset.y * metrics.outlineSize },
                          ],
                        },
                      ]}
                      contentFit="contain"
                      transition={0}
                    />
                  ))}
                </View>
              ) : null}
              <Image source={{ uri: item.previewUri }} style={styles.stickerImage} contentFit="contain" />
            </View>
            {item.count > 1 ? (
              <View style={[styles.countBadge, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>x{item.count}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Animated.View>
    </>
  );
});

const RecapStickerPileContent = memo(function RecapStickerPileContent({
  title = 'Used this month',
  items,
}: Pick<RecapStickerPileProps, 'title' | 'items'>) {
  const { colors } = useTheme();
  const displayItems = useMemo(() => items.slice(0, 8), [items]);
  const positions = useMemo(() => getPilePositions(displayItems.length), [displayItems.length]);
  const [layout, setLayout] = useState({ width: 1, height: 176 });
  const displayEntries = useMemo(
    () =>
      displayItems.map((item, index) => {
        const position = positions[index] ?? positions[positions.length - 1];
        return {
          item,
          position,
          metrics: getPileItemMetrics(item, position.size),
        };
      }),
    [displayItems, positions]
  );

  const placements = useMemo(
    () =>
      displayEntries.map(({ item, position, metrics }, index) =>
        buildPlacement(item, position, layout.width, layout.height, metrics, index + 1)
      ),
    [displayEntries, layout.height, layout.width]
  );
  const physicsState = useStickerPhysics({
    placements,
    layout,
    isActive: displayItems.length > 0,
    motionVariant: 'physics',
    minimumBaseSize: RECAP_MIN_PHYSICS_BASE,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({
      width: Math.max(width, 1),
      height: Math.max(height, 176),
    });
  };

  return (
    <View
      testID="notes-recap-sticker-pile"
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.secondaryText }]}>{title}</Text>
      <View style={styles.canvas} onLayout={handleLayout}>
        {displayEntries.map(({ item, metrics }) => (
          <RecapBubble
            key={item.key}
            item={item}
            metrics={metrics}
            physicsState={physicsState}
          />
        ))}
      </View>
    </View>
  );
});

const RecapStickerPilePlaceholder = memo(function RecapStickerPilePlaceholder({
  title = 'Used this month',
}: Pick<RecapStickerPileProps, 'title'>) {
  const { colors } = useTheme();

  return (
    <View
      testID="notes-recap-sticker-pile-placeholder"
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.secondaryText }]}>{title}</Text>
      <View style={styles.canvas} />
    </View>
  );
});

function RecapStickerPile({
  title = 'Used this month',
  items,
  deferUntilAfterInteractions = false,
}: RecapStickerPileProps) {
  const shouldDeferMount = deferUntilAfterInteractions && process.env.NODE_ENV !== 'test';
  const [isReady, setIsReady] = useState(!shouldDeferMount);

  useEffect(() => {
    if (!shouldDeferMount) {
      setIsReady(true);
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setIsReady(false);
    animationFrameId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      }, 48);
    });

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [shouldDeferMount]);

  if (!isReady) {
    return <RecapStickerPilePlaceholder title={title} />;
  }

  return <RecapStickerPileContent title={title} items={items} />;
}

export default memo(RecapStickerPile);

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    borderRadius: 30,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    ...Typography.pill,
    fontSize: 12,
  },
  canvas: {
    flex: 1,
    minHeight: 176,
    position: 'relative',
  },
  bubbleWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  photoBubble: {
    position: 'absolute',
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  stickerBubble: {
    position: 'absolute',
    overflow: 'visible',
  },
  stickerInner: {
    flex: 1,
    overflow: 'visible',
  },
  stickerOutlineLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  stickerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  countBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 22,
    height: 18,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    ...Typography.pill,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
});
