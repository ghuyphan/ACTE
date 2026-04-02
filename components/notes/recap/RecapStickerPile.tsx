import { Image } from 'expo-image';
import React, { memo, useMemo, useState } from 'react';
import {
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
import LivePhotoIcon from '../../ui/LivePhotoIcon';

export interface RecapStickerPileItem {
  key: string;
  kind: 'sticker' | 'photo';
  previewUri: string;
  count: number;
  isLivePhoto?: boolean;
  pairedVideoUri?: string | null;
}

interface RecapStickerPileProps {
  title?: string;
  items: RecapStickerPileItem[];
}

type PilePosition = {
  x: number;
  y: number;
  size: number;
  rotate: number;
};

const RECAP_MIN_PHYSICS_BASE = 52;

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

function buildPlacement(
  item: RecapStickerPileItem,
  position: PilePosition,
  width: number,
  height: number,
  collisionSize: number
): NoteStickerPlacement {
  const baseSize = Math.max(RECAP_MIN_PHYSICS_BASE, Math.min(width, height) * 0.3);
  const scale = collisionSize / Math.max(baseSize, 1);
  const centerX = Math.min(
    Math.max(position.x * width, collisionSize / 2),
    Math.max(collisionSize / 2, width - collisionSize / 2)
  );
  const centerY = Math.min(
    Math.max(position.y, collisionSize / 2),
    Math.max(collisionSize / 2, height - collisionSize / 2)
  );

  return {
    id: item.key,
    assetId: `${item.key}:asset`,
    x: centerX / Math.max(width, 1),
    y: centerY / Math.max(height, 1),
    scale,
    rotation: position.rotate,
    zIndex: 1,
    opacity: 1,
    outlineEnabled: false,
    motionLocked: false,
    asset: {
      id: `${item.key}:asset`,
      ownerUid: 'recap',
      localUri: item.previewUri,
      remotePath: null,
      uploadFingerprint: null,
      mimeType: item.kind === 'photo' ? 'image/jpeg' : 'image/png',
      width: 100,
      height: 100,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: null,
      source: 'import',
    },
  };
}

function getCollisionSize(item: RecapStickerPileItem, size: number) {
  if (item.kind === 'photo') {
    return size + Math.max(2, Math.round(size * 0.02));
  }

  return size + 10;
}

const RecapBubble = memo(function RecapBubble({
  item,
  size,
  collisionSize,
  physicsState,
}: {
  item: RecapStickerPileItem;
  size: number;
  collisionSize: number;
  physicsState: SharedValue<StickerPhysicsState[]>;
}) {
  const { colors } = useTheme();
  const inset = (collisionSize - size) / 2;
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
        { translateX: state.x - collisionSize / 2 },
        { translateY: state.y - collisionSize / 2 },
        { rotate: `${state.rotation}deg` },
        { scaleX: state.jellyScaleX },
        { scaleY: state.jellyScaleY },
      ],
    };
  }, [collisionSize, item.key, physicsState]);

  const shadowStyle = useAnimatedStyle(() => {
    const state = physicsState.value.find((candidate: StickerPhysicsState) => candidate.id === item.key);
    const shadowWidth = size * 0.58;

    if (!state) {
      return {
        opacity: 0,
      };
    }

    return {
      opacity: item.kind === 'photo' ? 0.16 : 0.12,
      transform: [
        { translateX: state.x - shadowWidth / 2 },
        { translateY: state.y + size * 0.34 },
        { scaleX: 0.92 + (state.jellyScaleX - 1) * 0.3 },
        { scaleY: 0.96 + (state.jellyScaleY - 1) * 0.12 },
      ],
    };
  }, [item.kind, item.key, physicsState, size]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadow,
          {
            width: size * 0.58,
          },
          shadowStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.bubbleWrap,
          {
            width: collisionSize,
            height: collisionSize,
          },
          bubbleStyle,
        ]}
      >
        {item.kind === 'photo' ? (
          <View
            style={[
              styles.photoBubble,
              {
                top: inset,
                left: inset,
                width: size,
                height: size,
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
                top: inset,
                left: inset,
                width: size,
                height: size,
                borderColor: `${colors.border}80`,
                backgroundColor: colors.card,
              },
            ]}
          >
            <View
              style={[
                styles.stickerInner,
                {
                  backgroundColor: colors.surface,
                },
              ]}
            >
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

function RecapStickerPile({
  title = 'Used this month',
  items,
}: RecapStickerPileProps) {
  const { colors } = useTheme();
  const displayItems = useMemo(() => items.slice(0, 8), [items]);
  const positions = useMemo(() => getPilePositions(displayItems.length), [displayItems.length]);
  const [layout, setLayout] = useState({ width: 1, height: 176 });

  const placements = useMemo(
    () =>
      displayItems.map((item, index) =>
        buildPlacement(
          item,
          positions[index] ?? positions[positions.length - 1],
          layout.width,
          layout.height,
          getCollisionSize(item, (positions[index] ?? positions[positions.length - 1]).size)
        )
      ),
    [displayItems, layout.height, layout.width, positions]
  );
  const physicsState = useStickerPhysics({
    placements,
    layout,
    isActive: displayItems.length > 0,
    motionVariant: 'physics',
    minimumBaseSize: 52,
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
        {displayItems.length === 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.emptyCanvasGlow,
              {
                backgroundColor: colors.surface,
                borderColor: `${colors.border}55`,
              },
            ]}
          />
        ) : null}
        {displayItems.map((item, index) => {
          const position = positions[index] ?? positions[positions.length - 1];
          return (
            <RecapBubble
              key={item.key}
              item={item}
              size={position.size}
              collisionSize={getCollisionSize(item, position.size)}
              physicsState={physicsState}
            />
          );
        })}
      </View>
    </View>
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
  emptyCanvasGlow: {
    position: 'absolute',
    left: '50%',
    top: 56,
    width: 124,
    height: 124,
    borderRadius: 36,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.48,
    transform: [{ translateX: -62 }],
  },
  shadow: {
    position: 'absolute',
    height: 16,
    borderRadius: 999,
    backgroundColor: '#000000',
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
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 8,
  },
  stickerInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
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
