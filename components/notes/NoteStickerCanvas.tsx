import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  hydrateStickerPlacements,
  type NoteStickerPlacement,
} from '../../services/noteStickers';
import {
  getStickerPinchScale,
  getStickerOutlineOffsets,
  sortStickerPlacements,
  type StickerCanvasLayout as CanvasLayout,
} from './stickerCanvasMetrics';
import StampStickerArtwork from './StampStickerArtwork';
import { getStickerPlacementFrame } from './stickerPlacementLayout';

interface NoteStickerCanvasProps {
  placements: NoteStickerPlacement[];
  editable?: boolean;
  stampShadowEnabled?: boolean;
  onChangePlacements?: (nextPlacements: NoteStickerPlacement[]) => void;
  selectedPlacementId?: string | null;
  onChangeSelectedPlacementId?: (placementId: string | null) => void;
  onPressCanvas?: () => void;
  style?: StyleProp<ViewStyle>;
  remoteBucket?: string;
  sharedCache?: boolean;
  sizeMultiplier?: number;
  minimumBaseSize?: number;
  onToggleSelectedPlacementMotionLock?: (placementId: string) => void;
  onToggleSelectedPlacementOutline?: (placementId: string) => void;
  onGestureActiveChange?: (active: boolean) => void;
}

const STICKER_OUTLINE_COLOR = 'rgba(255,255,255,0.98)';
const PREFER_CONTINUOUS_OUTLINE = Platform.OS === 'android';
function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizePlacements(placements: NoteStickerPlacement[]) {
  return sortStickerPlacements(placements).map((placement, index) => ({
    ...placement,
    zIndex: index + 1,
  }));
}

const StickerSelectionControls = memo(function StickerSelectionControls({
  placementId,
  motionLocked,
  outlineEnabled,
  showOutlineToggle,
  onToggleSelectedPlacementMotionLock,
  onToggleSelectedPlacementOutline,
}: {
  placementId: string;
  motionLocked: boolean;
  outlineEnabled: boolean;
  showOutlineToggle: boolean;
  onToggleSelectedPlacementMotionLock?: (placementId: string) => void;
  onToggleSelectedPlacementOutline?: (placementId: string) => void;
}) {
  return (
    <View style={styles.selectionControls}>
      <Pressable
        testID={`note-sticker-lock-toggle-${placementId}`}
        accessibilityRole="button"
        accessibilityLabel={motionLocked ? 'Unlock sticker motion' : 'Lock sticker motion'}
        onPress={() => onToggleSelectedPlacementMotionLock?.(placementId)}
        style={[
          styles.selectionControlButton,
          motionLocked ? styles.selectionControlButtonActive : null,
        ]}
      >
        <Ionicons
          name={motionLocked ? 'lock-closed' : 'lock-open-outline'}
          size={14}
          color={motionLocked ? '#1C1C1E' : '#FFFFFF'}
        />
      </Pressable>
      {showOutlineToggle ? (
        <Pressable
          testID={`note-sticker-outline-toggle-${placementId}`}
          accessibilityRole="button"
          accessibilityLabel={outlineEnabled ? 'Turn off outline' : 'Turn on outline'}
          onPress={() => onToggleSelectedPlacementOutline?.(placementId)}
          style={[
            styles.selectionControlButton,
            outlineEnabled ? styles.selectionControlButtonActive : null,
          ]}
        >
          <Ionicons
            name={outlineEnabled ? 'ellipse' : 'ellipse-outline'}
            size={14}
            color={outlineEnabled ? '#1C1C1E' : '#FFFFFF'}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

function EditableSticker({
  placement,
  layout,
  showSelection,
  interactiveRef,
  stampShadowEnabled,
  onChangeSelectedPlacementId,
  onCommit,
  sizeMultiplier,
  minimumBaseSize,
  onToggleSelectedPlacementMotionLock,
  onToggleSelectedPlacementOutline,
  onGestureActiveChange,
}: {
  placement: NoteStickerPlacement;
  layout: CanvasLayout;
  showSelection: boolean;
  interactiveRef: { current: boolean };
  stampShadowEnabled: boolean;
  onChangeSelectedPlacementId?: (placementId: string | null) => void;
  onCommit: (nextPlacement: NoteStickerPlacement) => void;
  sizeMultiplier: number;
  minimumBaseSize: number;
  onToggleSelectedPlacementMotionLock?: (placementId: string) => void;
  onToggleSelectedPlacementOutline?: (placementId: string) => void;
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const panStartRef = useRef<{ x: number; y: number }>({ x: placement.x, y: placement.y });
  const pinchStartScaleRef = useRef(placement.scale);
  const rotationStartRef = useRef(placement.rotation);
  const livePlacementRef = useRef(placement);
  const activeGestureCountRef = useRef(0);
  const [dragPlacement, setDragPlacement] = useState(placement);
  const activePlacement = dragPlacement;
  const placementFrame = getStickerPlacementFrame(
    activePlacement,
    layout,
    sizeMultiplier,
    minimumBaseSize
  );
  const {
    baseWidth,
    baseHeight,
    frameWidth,
    frameHeight,
    normalizedScale,
    outlineSize,
    stampMetrics,
  } = placementFrame;
  const showOutline = activePlacement.renderMode !== 'stamp' && activePlacement.outlineEnabled !== false;
  const showOutlineToggle = activePlacement.renderMode !== 'stamp' && Boolean(onToggleSelectedPlacementOutline);

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
  const handleSelect = useCallback(() => {
    if (!interactiveRef.current) {
      return;
    }
    onChangeSelectedPlacementId?.(placement.id);
  }, [interactiveRef, onChangeSelectedPlacementId, placement.id]);

  const beginGesture = useCallback(
    (type: 'pan' | 'pinch' | 'rotation') => {
      if (activeGestureCountRef.current === 0) {
        onGestureActiveChange?.(true);
      }
      activeGestureCountRef.current += 1;
      const currentPlacement = livePlacementRef.current;
      if (type === 'pan') {
        panStartRef.current = { x: currentPlacement.x, y: currentPlacement.y };
      } else if (type === 'pinch') {
        pinchStartScaleRef.current = currentPlacement.scale;
      } else {
        rotationStartRef.current = currentPlacement.rotation;
      }
      handleSelect();
    },
    [handleSelect, onGestureActiveChange]
  );

  const finalizeGesture = useCallback(() => {
    activeGestureCountRef.current = Math.max(0, activeGestureCountRef.current - 1);
    if (activeGestureCountRef.current === 0) {
      onGestureActiveChange?.(false);
      onCommit(livePlacementRef.current);
    }
  }, [onCommit, onGestureActiveChange]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .maxPointers(1)
        .minDistance(1)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (!interactiveRef.current || layout.width <= 0 || layout.height <= 0) {
            return;
          }
          beginGesture('pan');
        })
        .onUpdate((event) => {
          if (!interactiveRef.current || layout.width <= 0 || layout.height <= 0) {
            return;
          }
          updateLivePlacement({
            x: clamp01(panStartRef.current.x + event.translationX / layout.width),
            y: clamp01(panStartRef.current.y + event.translationY / layout.height),
          });
        })
        .onFinalize(() => {
          if (!interactiveRef.current) {
            return;
          }
          finalizeGesture();
        }),
    [beginGesture, finalizeGesture, interactiveRef, layout.height, layout.width, updateLivePlacement]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (!interactiveRef.current) {
            return;
          }
          beginGesture('pinch');
        })
        .onUpdate((event) => {
          if (!interactiveRef.current) {
            return;
          }
          updateLivePlacement({
            scale: getStickerPinchScale(pinchStartScaleRef.current, event.scale),
          });
        })
        .onFinalize(() => {
          if (!interactiveRef.current) {
            return;
          }
          finalizeGesture();
        }),
    [beginGesture, finalizeGesture, interactiveRef, updateLivePlacement]
  );

  const rotationGesture = useMemo(
    () =>
      Gesture.Rotation()
        .runOnJS(true)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (!interactiveRef.current) {
            return;
          }
          beginGesture('rotation');
        })
        .onUpdate((event) => {
          if (!interactiveRef.current) {
            return;
          }
          updateLivePlacement({
            rotation: rotationStartRef.current + (event.rotation * 180) / Math.PI,
          });
        })
        .onFinalize(() => {
          if (!interactiveRef.current) {
            return;
          }
          finalizeGesture();
        }),
    [beginGesture, finalizeGesture, interactiveRef, updateLivePlacement]
  );
  const combinedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture),
    [panGesture, pinchGesture, rotationGesture]
  );
  const outlineOffsets = useMemo(
    () =>
      getStickerOutlineOffsets(outlineSize, {
        preferContinuous: PREFER_CONTINUOUS_OUTLINE,
      }),
    [outlineSize]
  );
  const stickerFrameStyle = useMemo(
    () =>
      ({
        width: baseWidth,
        height: baseHeight,
        top: outlineSize,
        left: outlineSize,
      }) as const,
    [baseHeight, baseWidth, outlineSize]
  );
  const stickerWrapStyle = useMemo(
    () => ({
      width: frameWidth,
      height: frameHeight,
      left: activePlacement.x * layout.width - frameWidth / 2,
      top: activePlacement.y * layout.height - frameHeight / 2,
      zIndex: activePlacement.zIndex,
      opacity: activePlacement.opacity,
      transform: [
        { scale: normalizedScale },
        { rotate: `${activePlacement.rotation}deg` },
      ],
    }),
    [
      activePlacement.opacity,
      activePlacement.rotation,
      activePlacement.x,
      activePlacement.y,
      activePlacement.zIndex,
      frameHeight,
      frameWidth,
      layout.height,
      layout.width,
      normalizedScale,
    ]
  );

  const stickerArtwork = (
    <View style={styles.stickerArtwork}>
      {showOutline ? (
        <View
          pointerEvents="none"
          testID={`note-sticker-outline-${placement.id}`}
          style={styles.stickerOutlineLayer}
        >
          {outlineOffsets.map((offset, index) => (
            <ExpoImage
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
      ) : null}
      {stampMetrics ? (
        <StampStickerArtwork
          localUri={activePlacement.asset.localUri}
          metrics={stampMetrics}
          shadowEnabled={stampShadowEnabled}
          width={baseWidth}
          height={baseHeight}
          paperTestID={`note-sticker-stamp-paper-${placement.id}`}
          artworkTestID={`note-sticker-stamp-${placement.id}`}
        />
      ) : (
        <ExpoImage
          testID={`note-sticker-image-${placement.id}`}
          source={{ uri: activePlacement.asset.localUri }}
          style={[styles.stickerLayerImage, stickerFrameStyle]}
          contentFit="contain"
          transition={interactiveRef.current ? 0 : 120}
        />
      )}
    </View>
  );

  const stickerNode = (
    <View
      pointerEvents="auto"
      testID={`note-sticker-wrap-${placement.id}`}
      style={[
        styles.stickerWrap,
        stickerWrapStyle,
      ]}
    >
      {showSelection ? <View pointerEvents="none" style={styles.selectionRing} /> : null}
      {showSelection ? (
        <StickerSelectionControls
          placementId={placement.id}
          motionLocked={activePlacement.motionLocked === true}
          outlineEnabled={activePlacement.outlineEnabled !== false}
          showOutlineToggle={showOutlineToggle}
          onToggleSelectedPlacementMotionLock={onToggleSelectedPlacementMotionLock}
          onToggleSelectedPlacementOutline={onToggleSelectedPlacementOutline}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={handleSelect}
        style={styles.stickerPressable}
      >
        {stickerArtwork}
      </Pressable>
    </View>
  );

  return (
    <GestureDetector gesture={combinedGesture}>
      {stickerNode}
    </GestureDetector>
  );
}

const MemoEditableSticker = memo(EditableSticker);

function NoteStickerCanvas({
  placements,
  editable = false,
  stampShadowEnabled = true,
  onChangePlacements,
  selectedPlacementId = null,
  onChangeSelectedPlacementId,
  onPressCanvas,
  style,
  remoteBucket,
  sharedCache = false,
  sizeMultiplier = 1,
  minimumBaseSize = 68,
  onToggleSelectedPlacementMotionLock,
  onToggleSelectedPlacementOutline,
  onGestureActiveChange,
}: NoteStickerCanvasProps) {
  const [layout, setLayout] = useState<CanvasLayout>({ width: 1, height: 1 });
  const [hydratedPlacements, setHydratedPlacements] = useState(placements);
  const editableRef = useRef(editable);

  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

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
  const sortedPlacements = useMemo(() => sortStickerPlacements(renderedPlacements), [renderedPlacements]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const nextWidth = Math.max(width, 1);
    const nextHeight = Math.max(height, 1);

    setLayout((current) => {
      if (current.width === nextWidth && current.height === nextHeight) {
        return current;
      }

      return {
        width: nextWidth,
        height: nextHeight,
      };
    });
  }, []);

  const commitPlacement = useCallback((nextPlacement: NoteStickerPlacement) => {
    if (!onChangePlacements) {
      return;
    }

    const nextPlacements = normalizePlacements(
      placements.map((placement) =>
        placement.id === nextPlacement.id ? nextPlacement : placement
      )
    );
    onChangePlacements(nextPlacements);
  }, [onChangePlacements, placements]);

  return (
    <View pointerEvents={editable ? 'box-none' : 'none'} style={[styles.canvas, style]} onLayout={handleLayout}>
      {editable && onPressCanvas ? (
        <Pressable
          testID="note-sticker-canvas-empty"
          accessibilityRole="button"
          onPress={onPressCanvas}
          style={styles.canvasTapTarget}
        />
      ) : null}
      {sortedPlacements.map((placement) => (
        <MemoEditableSticker
          key={placement.id}
          placement={placement}
          layout={layout}
          showSelection={editable && selectedPlacementId === placement.id}
          interactiveRef={editableRef}
          stampShadowEnabled={stampShadowEnabled}
          onChangeSelectedPlacementId={onChangeSelectedPlacementId}
          onCommit={commitPlacement}
          sizeMultiplier={sizeMultiplier}
          minimumBaseSize={minimumBaseSize}
          onToggleSelectedPlacementMotionLock={onToggleSelectedPlacementMotionLock}
          onToggleSelectedPlacementOutline={onToggleSelectedPlacementOutline}
          onGestureActiveChange={onGestureActiveChange}
        />
      ))}
    </View>
  );
}

export default memo(NoteStickerCanvas);

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  canvasTapTarget: {
    ...StyleSheet.absoluteFillObject,
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
    overflow: 'visible',
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
  selectionControls: {
    position: 'absolute',
    top: -14,
    right: -14,
    gap: 8,
    zIndex: 2,
  },
  selectionControlButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(28,28,30,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionControlButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.9)',
  },
  stickerLayerImage: {
    position: 'absolute',
  },
});
