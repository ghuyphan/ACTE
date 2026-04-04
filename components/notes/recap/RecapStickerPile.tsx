import {
  Canvas,
  Group,
  Image as SkiaImage,
  Path,
  useImage,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  createStampFramePath,
  getStampFrameMetrics,
  STAMP_OUTLINE_COLOR,
  STAMP_PAPER_BORDER_COLOR,
} from '../stampFrameMetrics';

export interface RecapStickerPileItem {
  key: string;
  kind: 'sticker' | 'photo';
  previewUri: string;
  count: number;
  assetWidth?: number;
  assetHeight?: number;
  outlineEnabled?: boolean;
  renderMode?: 'default' | 'stamp';
  isLivePhoto?: boolean;
  pairedVideoUri?: string | null;
}

interface RecapStickerPileProps {
  title?: string;
  items: RecapStickerPileItem[];
  deferUntilAfterInteractions?: boolean;
  physicsEnabled?: boolean;
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
const RECAP_COLLISION_INSET = 2;
const STICKER_OUTLINE_COLOR = 'rgba(255,255,255,0.98)';
const PREFER_CONTINUOUS_OUTLINE = Platform.OS === 'android';

function getDensePilePositions(count: number): PilePosition[] {
  const rows =
    count >= 72 ? 7 : count >= 48 ? 6 : Math.min(5, Math.max(2, Math.ceil(count / 6)));
  const baseColumns = Math.ceil(count / rows);
  const rowCounts = Array.from({ length: rows }, (_, rowIndex) =>
    Math.floor(count / rows) + (rowIndex < count % rows ? 1 : 0)
  );
  const topY = rows >= 7 ? 66 : rows === 6 ? 70 : rows >= 5 ? 76 : rows === 4 ? 80 : 84;
  const bottomY = rows >= 7 ? 154 : rows === 6 ? 150 : rows >= 5 ? 148 : rows === 4 ? 144 : 138;
  const rowBaseSize = clamp(
    66 - Math.max(baseColumns - 4, 0) * 5 - Math.max(rows - 2, 0) * 4,
    rows >= 6 ? 18 : 24,
    54
  );

  return rowCounts.flatMap((rowCount, rowIndex) => {
    const rowRatio = rows <= 1 ? 0.5 : rowIndex / (rows - 1);
    const yBase = topY + (bottomY - topY) * rowRatio;
    const rowInset = rows >= 6 ? (rowIndex % 2 === 0 ? 0.06 : 0.1) : rowIndex % 2 === 0 ? 0.1 : 0.14;
    const left = rowInset;
    const right = 1 - rowInset;
    const step = rowCount <= 1 ? 0 : (right - left) / (rowCount - 1);

    return Array.from({ length: rowCount }, (_, columnIndex) => {
      const wave = (columnIndex + rowIndex) % 2 === 0 ? -1 : 1;
      const x = rowCount <= 1 ? 0.5 : left + step * columnIndex;
      const centerBias =
        rowCount > 2 && columnIndex === Math.floor(rowCount / 2)
          ? 4
          : rowCount > 3 &&
              columnIndex > 0 &&
              columnIndex < rowCount - 1
            ? 2
            : 0;
      const size = clamp(
        rowBaseSize + centerBias - rowIndex * 1.5 + (wave > 0 ? 1 : -1),
        rows >= 6 ? 16 : 24,
        58
      );
      const rotate = clamp(
        wave * (rows >= 6 ? 3.5 : rows >= 4 ? 5 : 7) +
          (columnIndex - (rowCount - 1) / 2) * (rows >= 6 ? 0.8 : 1.2),
        -10,
        10
      );

      return {
        x,
        y: yBase + wave * (rows >= 6 ? 2 : rows >= 4 ? 3 : 5),
        size,
        rotate,
      };
    });
  });
}

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

  if (count > 8) {
    return getDensePilePositions(count);
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

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getPileSpreadFactor(count: number) {
  if (count <= 1) {
    return 1;
  }

  if (count === 2) {
    return 2.5;
  }

  if (count === 3) {
    return 1.55;
  }

  if (count === 4) {
    return 1.3;
  }

  if (count <= 6) {
    return 1.3;
  }

  if (count <= 8) {
    return 1.08;
  }

  if (count <= 12) {
    return 1;
  }

  if (count <= 18) {
    return 0.96;
  }

  return 0.92;
}

function getAdjustedPilePosition(count: number, position: PilePosition): PilePosition {
  const spreadFactor = getPileSpreadFactor(count);

  return {
    ...position,
    x: clamp(0.5 + (position.x - 0.5) * spreadFactor, 0.08, 0.92),
  };
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

function getPileCountScale(count: number) {
  if (count <= 1) {
    return 0.96;
  }

  if (count === 2) {
    return 0.98;
  }

  if (count === 3) {
    return 0.94;
  }

  if (count === 4) {
    return 0.91;
  }

  if (count <= 6) {
    return 0.87;
  }

  if (count <= 8) {
    return 0.83;
  }

  if (count <= 12) {
    return 0.74;
  }

  if (count <= 18) {
    return 0.66;
  }

  if (count <= 24) {
    return 0.58;
  }

  if (count <= 36) {
    return 0.5;
  }

  if (count <= 48) {
    return 0.44;
  }

  if (count <= 64) {
    return 0.38;
  }

  if (count <= 80) {
    return 0.34;
  }

  return 0.3;
}

function getPileMinimumVisualSize(count: number, item: RecapStickerPileItem) {
  if (count <= 2) {
    return item.kind === 'sticker' ? 104 : 94;
  }

  if (count <= 4) {
    return item.kind === 'sticker' ? 80 : 72;
  }

  if (count <= 8) {
    return item.kind === 'sticker' ? 60 : 54;
  }

  if (count <= 12) {
    return item.kind === 'sticker' ? 46 : 42;
  }

  if (count <= 18) {
    return item.kind === 'sticker' ? 38 : 34;
  }

  if (count <= 24) {
    return item.kind === 'sticker' ? 30 : 28;
  }

  if (count <= 36) {
    return item.kind === 'sticker' ? 24 : 22;
  }

  if (count <= 48) {
    return item.kind === 'sticker' ? 20 : 18;
  }

  if (count <= 64) {
    return item.kind === 'sticker' ? 18 : 16;
  }

  return item.kind === 'sticker' ? 16 : 14;
}

function getAdjustedPileSize(
  count: number,
  item: RecapStickerPileItem,
  size: number,
  largestSize: number
) {
  const countScale = getPileCountScale(count);
  if (largestSize <= 0) {
    return Math.max(size * countScale, getPileMinimumVisualSize(count, item));
  }

  const relativeSize = size / largestSize;
  const hierarchyStrength = count <= 3 ? 0.02 : count <= 6 ? 0.05 : 0.08;
  const hierarchyScale = 1 - (1 - relativeSize) * hierarchyStrength;
  const itemKindScale = item.kind === 'sticker' ? 1.02 : 1;
  const nextSize = size * countScale * hierarchyScale * itemKindScale;

  return Math.max(nextSize, getPileMinimumVisualSize(count, item));
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

function getPilePlacementAnchor(
  position: PilePosition,
  width: number,
  height: number,
  metrics: PileItemMetrics
) {
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
    centerX,
    centerY,
    rotation: position.rotate,
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
  const anchor = getPilePlacementAnchor(position, width, height, metrics);

  return {
    id: item.key,
    assetId: `${item.key}:asset`,
    x: anchor.centerX / Math.max(width, 1),
    y: anchor.centerY / Math.max(height, 1),
    scale,
    rotation: anchor.rotation,
    zIndex,
    opacity: 1,
    outlineEnabled: item.kind === 'photo' ? false : item.outlineEnabled !== false,
    motionLocked: false,
    renderMode: item.kind === 'photo' ? 'default' : item.renderMode === 'stamp' ? 'stamp' : 'default',
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
  anchorX,
  anchorY,
  rotation,
  physicsState,
  physicsStateIndex,
}: {
  item: RecapStickerPileItem;
  metrics: PileItemMetrics;
  anchorX: number;
  anchorY: number;
  rotation: number;
  physicsState?: SharedValue<StickerPhysicsState[]>;
  physicsStateIndex?: number;
}) {
  const { colors } = useTheme();
  const stampImage = useImage(item.previewUri);
  const stampMetrics =
    item.kind === 'sticker' && item.renderMode === 'stamp'
      ? getStampFrameMetrics(metrics.width, metrics.height)
      : null;
  const stampPath = useMemo(
    () => (stampMetrics ? createStampFramePath(stampMetrics) : null),
    [stampMetrics]
  );
  const outlineOffsets = useMemo(
    () =>
      item.kind === 'sticker' && item.renderMode !== 'stamp' && item.outlineEnabled !== false
        ? getStickerOutlineOffsets(metrics.outlineSize, {
            preferContinuous: PREFER_CONTINUOUS_OUTLINE,
          })
        : [],
    [item.kind, item.outlineEnabled, item.renderMode, metrics.outlineSize]
  );
  const stampOutlineWidth = stampMetrics ? Math.max(2.2, stampMetrics.perforationRadius * 0.62) : 0;
  const stampBorderWidth = stampMetrics ? Math.max(1, stampMetrics.perforationRadius * 0.18) : 0;

  const bubbleStyle = useAnimatedStyle(() => {
    if (!physicsState || physicsStateIndex === undefined) {
      return {
        opacity: 1,
        transform: [
          { translateX: anchorX - metrics.width / 2 },
          { translateY: anchorY - metrics.height / 2 },
          { rotate: `${rotation}deg` },
        ],
      };
    }

    const state = physicsState.value[physicsStateIndex];

    if (!state || state.id !== item.key) {
      return {
        opacity: 1,
        transform: [
          { translateX: anchorX - metrics.width / 2 },
          { translateY: anchorY - metrics.height / 2 },
          { rotate: `${rotation}deg` },
        ],
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
  }, [anchorX, anchorY, item.key, metrics.height, metrics.width, physicsState, physicsStateIndex, rotation]);

  return (
    <>
      <Animated.View
        testID={`notes-recap-item-${item.key}`}
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
              {item.renderMode !== 'stamp' && item.outlineEnabled !== false ? (
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
              {stampMetrics && stampPath ? (
                <View style={styles.stampArtwork}>
                  <Canvas style={styles.stampArtwork}>
                    {stampImage ? (
                      <Group
                        clip={stampPath}
                      >
                        <SkiaImage
                          image={stampImage}
                          fit="cover"
                          x={0}
                          y={0}
                          width={stampMetrics.outerWidth}
                          height={stampMetrics.outerHeight}
                        />
                      </Group>
                    ) : null}
                    <Path
                      path={stampPath}
                      color={STAMP_OUTLINE_COLOR}
                      style="stroke"
                      strokeWidth={stampOutlineWidth}
                    />
                    <Path
                      path={stampPath}
                      color={STAMP_PAPER_BORDER_COLOR}
                      style="stroke"
                      strokeWidth={stampBorderWidth}
                    />
                  </Canvas>
                </View>
              ) : (
                <Image
                  source={{ uri: item.previewUri }}
                  style={styles.stickerImage}
                  contentFit="contain"
                  transition={0}
                />
              )}
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
  physicsEnabled = true,
}: Pick<RecapStickerPileProps, 'title' | 'items'> & { physicsEnabled?: boolean }) {
  const { colors } = useTheme();
  const displayItems = useMemo(() => items, [items]);
  const positions = useMemo(() => getPilePositions(displayItems.length), [displayItems.length]);
  const [layout, setLayout] = useState({ width: 1, height: 176 });
  const displayEntries = useMemo(
    () => {
      const largestBaseSize = positions.reduce((largest, position) => Math.max(largest, position.size), 0);

      return displayItems.map((item, index) => {
        const basePosition = positions[index] ?? positions[positions.length - 1];
        const position = getAdjustedPilePosition(displayItems.length, basePosition);
        const adjustedSize = getAdjustedPileSize(
          displayItems.length,
          item,
          position.size,
          largestBaseSize
        );
        return {
          item,
          position,
          metrics: getPileItemMetrics(item, adjustedSize),
        };
      });
    },
    [displayItems, positions]
  );
  const staticAnchors = useMemo(
    () =>
      displayEntries.map(({ position, metrics }) =>
        getPilePlacementAnchor(position, layout.width, layout.height, metrics)
      ),
    [displayEntries, layout.height, layout.width]
  );

  const placements = useMemo(
    () =>
      displayEntries.map(({ item, position, metrics }, index) =>
        buildPlacement(item, position, layout.width, layout.height, metrics, index + 1)
      ),
    [displayEntries, layout.height, layout.width]
  );
  const physicsState = useStickerPhysics({
    placements: physicsEnabled ? placements : [],
    layout,
    isActive: physicsEnabled && displayEntries.length > 0,
    sensorDriven: true,
    collisionResponse: 'gentle',
    motionVariant: 'physics',
    minimumBaseSize: RECAP_MIN_PHYSICS_BASE,
    collisionInset: RECAP_COLLISION_INSET,
  });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const nextLayout = {
      width: Math.max(width, 1),
      height: Math.max(height, 176),
    };
    setLayout((currentLayout) =>
      currentLayout.width === nextLayout.width && currentLayout.height === nextLayout.height
        ? currentLayout
        : nextLayout
    );
  }, []);

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
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: colors.secondaryText }]}>{title}</Text>
      </View>
      <View style={styles.canvas} onLayout={handleLayout}>
        {displayEntries.map(({ item, metrics }, index) => (
          <RecapBubble
            key={item.key}
            item={item}
            metrics={metrics}
            anchorX={
              (physicsEnabled ? placements[index]?.x : undefined) ??
              staticAnchors[index]?.centerX ??
              0
            }
            anchorY={
              (physicsEnabled ? placements[index]?.y : undefined) ??
              staticAnchors[index]?.centerY ??
              0
            }
            rotation={
              (physicsEnabled ? placements[index]?.rotation : undefined) ??
              staticAnchors[index]?.rotation ??
              0
            }
            physicsState={physicsEnabled ? physicsState : undefined}
            physicsStateIndex={index}
          />
        ))}
      </View>
    </View>
  );
});

function RecapStickerPile({
  title = 'Used this month',
  items,
  deferUntilAfterInteractions = false,
  physicsEnabled = true,
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

  return (
    <RecapStickerPileContent
      title={title}
      items={items}
      physicsEnabled={physicsEnabled && isReady}
    />
  );
}

export default memo(RecapStickerPile);

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    borderRadius: 30,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 14,
    paddingBottom: 12,
  },
  titleWrap: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  title: {
    ...Typography.pill,
    fontSize: 12,
  },
  canvas: {
    flex: 1,
    minHeight: 176,
    position: 'relative',
    marginHorizontal: -6,
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
  stampArtwork: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  stampPerforation: {
    position: 'absolute',
  },
  stampPaper: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stampPhotoImage: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
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
