import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  hydrateStickerPlacements,
  type NoteStickerPlacement,
} from '../services/noteStickers';

interface NoteStickerCanvasProps {
  placements: NoteStickerPlacement[];
  editable?: boolean;
  onChangePlacements?: (nextPlacements: NoteStickerPlacement[]) => void;
  selectedPlacementId?: string | null;
  onChangeSelectedPlacementId?: (placementId: string | null) => void;
  style?: StyleProp<ViewStyle>;
  remoteBucket?: string;
  sharedCache?: boolean;
  sizeMultiplier?: number;
  minimumBaseSize?: number;
}

interface CanvasLayout {
  width: number;
  height: number;
}

const STICKER_OUTLINE_COLOR = 'rgba(255,255,255,0.98)';
const STICKER_OUTLINE_OFFSETS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -0.8, y: -0.8 },
  { x: -0.8, y: 0.8 },
  { x: 0.8, y: -0.8 },
  { x: 0.8, y: 0.8 },
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampScale(value: number) {
  return Math.max(0.35, Math.min(value, 3));
}

function sortPlacements(placements: NoteStickerPlacement[]) {
  return [...placements].sort((left, right) => left.zIndex - right.zIndex);
}

function normalizePlacements(placements: NoteStickerPlacement[]) {
  return sortPlacements(placements).map((placement, index) => ({
    ...placement,
    zIndex: index + 1,
  }));
}

function getStickerDimensions(
  placement: NoteStickerPlacement,
  layout: CanvasLayout,
  sizeMultiplier: number,
  minimumBaseSize: number
) {
  const longestEdge = Math.max(placement.asset.width, placement.asset.height, 1);
  const baseSize = Math.max(minimumBaseSize, Math.min(layout.width, layout.height) * 0.3) * sizeMultiplier;
  const baseScale = baseSize / longestEdge;
  const scaledWidth = placement.asset.width * baseScale * clampScale(placement.scale);
  const scaledHeight = placement.asset.height * baseScale * clampScale(placement.scale);

  return {
    width: scaledWidth,
    height: scaledHeight,
  };
}

function getStickerOutlineSize(width: number, height: number) {
  return Math.max(3, Math.min(8, Math.min(width, height) * 0.045));
}

function EditableSticker({
  placement,
  layout,
  selected,
  editable,
  onSelect,
  onCommit,
  sizeMultiplier,
  minimumBaseSize,
}: {
  placement: NoteStickerPlacement;
  layout: CanvasLayout;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onCommit: (nextPlacement: NoteStickerPlacement) => void;
  sizeMultiplier: number;
  minimumBaseSize: number;
}) {
  const panStartRef = useRef<{ x: number; y: number }>({ x: placement.x, y: placement.y });
  const pinchStartScaleRef = useRef(placement.scale);
  const rotationStartRef = useRef(placement.rotation);
  const livePlacementRef = useRef(placement);
  const activeGestureCountRef = useRef(0);
  const [dragPlacement, setDragPlacement] = useState(placement);

  useEffect(() => {
    livePlacementRef.current = placement;
    panStartRef.current = { x: placement.x, y: placement.y };
    pinchStartScaleRef.current = placement.scale;
    rotationStartRef.current = placement.rotation;
    setDragPlacement(placement);
  }, [placement]);

  const updateLivePlacement = useCallback((patch: Partial<NoteStickerPlacement>) => {
    const nextPlacement = {
      ...livePlacementRef.current,
      ...patch,
    };
    livePlacementRef.current = nextPlacement;
    setDragPlacement(nextPlacement);
  }, []);

  const beginGesture = useCallback(
    (type: 'pan' | 'pinch' | 'rotation') => {
      activeGestureCountRef.current += 1;
      const currentPlacement = livePlacementRef.current;
      if (type === 'pan') {
        panStartRef.current = { x: currentPlacement.x, y: currentPlacement.y };
      } else if (type === 'pinch') {
        pinchStartScaleRef.current = currentPlacement.scale;
      } else {
        rotationStartRef.current = currentPlacement.rotation;
      }
      onSelect();
    },
    [onSelect]
  );

  const finalizeGesture = useCallback(() => {
    activeGestureCountRef.current = Math.max(0, activeGestureCountRef.current - 1);
    if (activeGestureCountRef.current === 0) {
      onCommit(livePlacementRef.current);
    }
  }, [onCommit]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(editable)
        .maxPointers(1)
        .minDistance(1)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (!editable || layout.width <= 0 || layout.height <= 0) {
            return;
          }
          beginGesture('pan');
        })
        .onUpdate((event) => {
          if (!editable || layout.width <= 0 || layout.height <= 0) {
            return;
          }
          updateLivePlacement({
            x: clamp01(panStartRef.current.x + event.translationX / layout.width),
            y: clamp01(panStartRef.current.y + event.translationY / layout.height),
          });
        })
        .onFinalize(() => {
          if (!editable) {
            return;
          }
          finalizeGesture();
        }),
    [beginGesture, editable, finalizeGesture, layout.height, layout.width, updateLivePlacement]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .enabled(editable)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (!editable) {
            return;
          }
          beginGesture('pinch');
        })
        .onUpdate((event) => {
          if (!editable) {
            return;
          }
          updateLivePlacement({
            scale: clampScale(pinchStartScaleRef.current * event.scale),
          });
        })
        .onFinalize(() => {
          if (!editable) {
            return;
          }
          finalizeGesture();
        }),
    [beginGesture, editable, finalizeGesture, updateLivePlacement]
  );

  const rotationGesture = useMemo(
    () =>
      Gesture.Rotation()
        .runOnJS(true)
        .enabled(editable)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (!editable) {
            return;
          }
          beginGesture('rotation');
        })
        .onUpdate((event) => {
          if (!editable) {
            return;
          }
          updateLivePlacement({
            rotation: rotationStartRef.current + (event.rotation * 180) / Math.PI,
          });
        })
        .onFinalize(() => {
          if (!editable) {
            return;
          }
          finalizeGesture();
        }),
    [beginGesture, editable, finalizeGesture, updateLivePlacement]
  );

  const activePlacement = editable ? dragPlacement : placement;
  const dimensions = getStickerDimensions(activePlacement, layout, sizeMultiplier, minimumBaseSize);
  const outlineSize = getStickerOutlineSize(dimensions.width, dimensions.height);
  const frameWidth = dimensions.width + outlineSize * 2;
  const frameHeight = dimensions.height + outlineSize * 2;
  const stickerFrameStyle = {
    width: dimensions.width,
    height: dimensions.height,
    top: outlineSize,
    left: outlineSize,
  } as const;

  return (
    <GestureDetector gesture={Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture)}>
      <View
        style={[
          styles.stickerWrap,
          {
            width: frameWidth,
            height: frameHeight,
            left: activePlacement.x * layout.width - frameWidth / 2,
            top: activePlacement.y * layout.height - frameHeight / 2,
            zIndex: activePlacement.zIndex,
            opacity: activePlacement.opacity,
            transform: [{ rotate: `${activePlacement.rotation}deg` }],
          },
        ]}
      >
        {editable && selected ? <View pointerEvents="none" style={styles.selectionRing} /> : null}
        <Pressable
          accessibilityRole={editable ? 'button' : undefined}
          onPress={editable ? onSelect : undefined}
          style={styles.stickerPressable}
        >
          <View style={styles.stickerArtwork}>
            <View
              pointerEvents="none"
              testID={`note-sticker-outline-${placement.id}`}
              style={styles.stickerOutlineLayer}
            >
              {STICKER_OUTLINE_OFFSETS.map((offset, index) => (
                <Image
                  key={`${placement.id}-outline-${index}`}
                  source={{ uri: activePlacement.asset.localUri }}
                  style={[
                    styles.stickerLayerImage,
                    stickerFrameStyle,
                    {
                      tintColor: STICKER_OUTLINE_COLOR,
                      opacity: 0.92,
                      transform: [
                        { translateX: offset.x * outlineSize },
                        { translateY: offset.y * outlineSize },
                      ],
                    },
                  ]}
                  contentFit="contain"
                  transition={0}
                />
              ))}
            </View>
            <Image
              source={{ uri: activePlacement.asset.localUri }}
              style={[styles.stickerLayerImage, stickerFrameStyle]}
              contentFit="contain"
              transition={120}
            />
          </View>
        </Pressable>
      </View>
    </GestureDetector>
  );
}

const MemoEditableSticker = memo(EditableSticker);

export default function NoteStickerCanvas({
  placements,
  editable = false,
  onChangePlacements,
  selectedPlacementId = null,
  onChangeSelectedPlacementId,
  style,
  remoteBucket,
  sharedCache = false,
  sizeMultiplier = 1,
  minimumBaseSize = 68,
}: NoteStickerCanvasProps) {
  const [layout, setLayout] = useState<CanvasLayout>({ width: 1, height: 1 });
  const [hydratedPlacements, setHydratedPlacements] = useState(placements);

  useEffect(() => {
    if (editable || !remoteBucket) {
      setHydratedPlacements(placements);
      return;
    }

    let cancelled = false;

    void hydrateStickerPlacements(placements, remoteBucket, { sharedCache }).then((nextPlacements) => {
      if (!cancelled) {
        setHydratedPlacements(nextPlacements);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editable, placements, remoteBucket, sharedCache]);

  const renderedPlacements = editable ? placements : hydratedPlacements;
  const sortedPlacements = useMemo(() => sortPlacements(renderedPlacements), [renderedPlacements]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    });
  };

  const commitPlacement = (nextPlacement: NoteStickerPlacement) => {
    if (!onChangePlacements) {
      return;
    }

    const nextPlacements = normalizePlacements(
      placements.map((placement) =>
        placement.id === nextPlacement.id ? nextPlacement : placement
      )
    );
    onChangePlacements(nextPlacements);
  };

  return (
    <View pointerEvents={editable ? 'box-none' : 'none'} style={[styles.canvas, style]} onLayout={handleLayout}>
      {sortedPlacements.map((placement) => (
        <MemoEditableSticker
          key={placement.id}
          placement={placement}
          layout={layout}
          selected={selectedPlacementId === placement.id}
          editable={editable}
          onSelect={() => onChangeSelectedPlacementId?.(placement.id)}
          onCommit={commitPlacement}
          sizeMultiplier={sizeMultiplier}
          minimumBaseSize={minimumBaseSize}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  stickerWrap: {
    position: 'absolute',
  },
  stickerPressable: {
    width: '100%',
    height: '100%',
  },
  stickerArtwork: {
    width: '100%',
    height: '100%',
  },
  stickerOutlineLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  selectionRing: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.88)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stickerLayerImage: {
    position: 'absolute',
  },
});
