import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Radii, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import type { StickerCutoutPreviewDraft } from '../../../hooks/ui/useStickerCreationFlow';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import StickerCreationOverlay from './StickerCreationOverlay';
import type {
  StickerCreationAnimatedStyle,
} from './StickerCreationOverlay';
import type { WindowRect } from './stickerCreationTypes';

const PREVIEW_HORIZONTAL_PADDING = 48;
const PREVIEW_MAX_WIDTH = 380;
const PREVIEW_MAX_HEIGHT_RATIO = 0.5;
const CHECKER_TILE_SIZE = 22;
const STICKER_PREVIEW_OUTLINE_OFFSETS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -0.72, y: -0.72 },
  { x: 0.72, y: -0.72 },
  { x: -0.72, y: 0.72 },
  { x: 0.72, y: 0.72 },
] as const;
const STICKER_PREVIEW_GLOW_OFFSETS = [
  { x: -0.5, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0, y: -0.5 },
  { x: 0, y: 0.5 },
  { x: -0.36, y: -0.36 },
  { x: 0.36, y: -0.36 },
  { x: -0.36, y: 0.36 },
  { x: 0.36, y: 0.36 },
] as const;

type MeasurableView = View & {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

interface StickerCutoutPreviewEditorProps {
  visible: boolean;
  draft: StickerCutoutPreviewDraft | null;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  outlineOnLabel: string;
  outlineOffLabel: string;
  onClose: () => void;
  onCompletePlacement: (payload: {
    placement: NoteStickerPlacement;
    sourceRect: WindowRect;
  }) => void;
  onConfirm: (payload: {
    outlineEnabled: boolean;
  }) => NoteStickerPlacement | null | Promise<NoteStickerPlacement | null>;
}

function measureWindowRect(node: MeasurableView | null): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (rect: WindowRect | null) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(rect);
    };
    const fallbackTimeout = setTimeout(() => {
      finish(null);
    }, 32);

    node.measureInWindow((x, y, width, height) => {
      clearTimeout(fallbackTimeout);

      if (width <= 0 || height <= 0) {
        finish(null);
        return;
      }

      finish({ x, y, width, height });
    });
  });
}

function StickerCutoutPreviewEditor({
  visible,
  draft,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  outlineOnLabel,
  outlineOffLabel,
  onClose,
  onCompletePlacement,
  onConfirm,
}: StickerCutoutPreviewEditorProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const previewRef = useRef<View | null>(null);
  const [previewWindowRect, setPreviewWindowRect] = useState<WindowRect | null>(null);
  const [outlineEnabled, setOutlineEnabled] = useState(true);
  const highlightProgress = useSharedValue(0);
  const sourceUri = draft?.source.uri ?? null;
  const cutoutUri = draft?.cutoutSource.uri ?? null;
  const sourceSize = useMemo(
    () => ({
      width: Math.max(1, draft?.width ?? 1),
      height: Math.max(1, draft?.height ?? 1),
    }),
    [draft?.height, draft?.width]
  );
  const previewSize = useMemo(() => {
    const maxWidth = Math.min(windowWidth - PREVIEW_HORIZONTAL_PADDING, PREVIEW_MAX_WIDTH);
    const maxHeight = Math.max(190, windowHeight * PREVIEW_MAX_HEIGHT_RATIO);
    const sourceAspect = sourceSize.width / sourceSize.height;
    let width = Math.max(140, maxWidth);
    let height = width / sourceAspect;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * sourceAspect;
    }

    return {
      width: Math.max(140, width),
      height: Math.max(140, height),
    };
  }, [sourceSize.height, sourceSize.width, windowHeight, windowWidth]);
  const checkerTiles = useMemo(() => {
    const columns = Math.max(1, Math.ceil(previewSize.width / CHECKER_TILE_SIZE));
    const rows = Math.max(1, Math.ceil(previewSize.height / CHECKER_TILE_SIZE));

    return Array.from({ length: columns * rows }, (_, index) => ({
      key: `checker-${index}`,
      left: (index % columns) * CHECKER_TILE_SIZE,
      top: Math.floor(index / columns) * CHECKER_TILE_SIZE,
      dark: (index + Math.floor(index / columns)) % 2 === 0,
    }));
  }, [previewSize.height, previewSize.width]);
  const outlineSize = useMemo(
    () => Math.max(4, Math.min(8, Math.min(previewSize.width, previewSize.height) * 0.025)),
    [previewSize.height, previewSize.width]
  );
  const glowSize = useMemo(
    () => Math.max(1.6, outlineSize * 0.52),
    [outlineSize]
  );
  const stickerDisplaySize = useMemo(() => {
    const maxWidth = previewSize.width * (draft?.backgroundVisible ? 0.7 : 0.76);
    const maxHeight = previewSize.height * (draft?.backgroundVisible ? 0.62 : 0.72);
    const sourceAspect = sourceSize.width / sourceSize.height;
    let width = maxWidth;
    let height = width / sourceAspect;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * sourceAspect;
    }

    return {
      width: Math.max(96, width),
      height: Math.max(96, height),
    };
  }, [draft?.backgroundVisible, previewSize.height, previewSize.width, sourceSize.height, sourceSize.width]);

  const resolvePreviewFallbackRect = useCallback(() => ({
    x: (windowWidth - previewSize.width) / 2,
    y: (windowHeight - previewSize.height) / 2,
    width: previewSize.width,
    height: previewSize.height,
  }), [previewSize.height, previewSize.width, windowHeight, windowWidth]);

  const measurePreviewInWindow = useCallback(async () => {
    const nextRect = await measureWindowRect(previewRef.current as MeasurableView | null);
    if (!nextRect) {
      return null;
    }

    setPreviewWindowRect((current) => {
      if (
        current &&
        current.x === nextRect.x &&
        current.y === nextRect.y &&
        current.width === nextRect.width &&
        current.height === nextRect.height
      ) {
        return current;
      }

      return nextRect;
    });
    return nextRect;
  }, []);

  const schedulePreviewMeasurement = useCallback(() => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        void measurePreviewInWindow();
      });
      return;
    }

    setTimeout(() => {
      void measurePreviewInWindow();
    }, 0);
  }, [measurePreviewInWindow]);

  const handleConfirmCreation = useCallback(async () => {
    const placement = await onConfirm({ outlineEnabled });
    if (!placement) {
      return null;
    }

    const latestRect = await measurePreviewInWindow();
    return {
      placement,
      sourceRect: latestRect ?? previewWindowRect ?? resolvePreviewFallbackRect(),
    };
  }, [
    measurePreviewInWindow,
    onConfirm,
    outlineEnabled,
    previewWindowRect,
    resolvePreviewFallbackRect,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setOutlineEnabled(true);
    schedulePreviewMeasurement();
  }, [draft?.cutoutSource.uri, schedulePreviewMeasurement, visible]);

  useEffect(() => {
    if (!visible || reduceMotionEnabled) {
      cancelAnimation(highlightProgress);
      highlightProgress.value = 0;
      return;
    }

    highlightProgress.value = 0;
    highlightProgress.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(highlightProgress);
    };
  }, [highlightProgress, reduceMotionEnabled, visible]);

  const stickerFloatAnimatedStyle = useAnimatedStyle(() => {
    const angle = highlightProgress.value * Math.PI * 2;
    return {
      transform: [
        { translateY: reduceMotionEnabled ? -8 : -12 + Math.sin(angle) * 3 },
        { scale: reduceMotionEnabled ? 1 : 1.01 + Math.sin(angle) * 0.01 },
      ],
    };
  });

  const stickerShadowAnimatedStyle = useAnimatedStyle(() => {
    const angle = highlightProgress.value * Math.PI * 2;
    return {
      opacity: reduceMotionEnabled ? 0.22 : 0.18 + (1 - Math.sin(angle) * 0.5) * 0.14,
      transform: [
        { scaleX: reduceMotionEnabled ? 1 : 0.96 + Math.sin(angle) * 0.03 },
        { scaleY: reduceMotionEnabled ? 1 : 0.88 - Math.sin(angle) * 0.04 },
      ],
    };
  });

  const stickerHaloAnimatedStyle = useAnimatedStyle(() => {
    const angle = highlightProgress.value * Math.PI * 2 + Math.PI * 0.45;
    return {
      opacity: reduceMotionEnabled ? 0.24 : 0.22 + Math.cos(angle) * 0.06,
      transform: [
        { scale: reduceMotionEnabled ? 1 : 0.98 + Math.cos(angle) * 0.04 },
      ],
    };
  });

  const stickerGlowAnimatedStyle = useAnimatedStyle(() => {
    const angle = highlightProgress.value * Math.PI * 2 + Math.PI * 0.18;
    return {
      opacity: reduceMotionEnabled ? 0.16 : 0.12 + (Math.cos(angle) + 1) * 0.06,
      transform: [
        { scale: reduceMotionEnabled ? 1 : 0.996 + Math.cos(angle) * 0.01 },
      ],
    };
  });

  const sourcePhotoAnimatedStyle = useAnimatedStyle(() => {
    const angle = highlightProgress.value * Math.PI * 2;
    return {
      transform: [
        { scale: reduceMotionEnabled ? 1 : 1.01 + Math.cos(angle) * 0.006 },
      ],
    };
  });

  if (!draft || !sourceUri || !cutoutUri) {
    return null;
  }

  const renderStage = ({
    busy,
    contentAnimatedStyle,
    focusAnimatedStyle,
  }: {
    busy: boolean;
    contentAnimatedStyle: StickerCreationAnimatedStyle;
    focusAnimatedStyle: StickerCreationAnimatedStyle;
  }) => (
    <View style={styles.stageArea}>
      <Reanimated.View style={[styles.stageStack, contentAnimatedStyle]}>
        <View
          ref={previewRef}
          collapsable={false}
          onLayout={schedulePreviewMeasurement}
          style={[
            styles.previewFrame,
            {
              width: previewSize.width,
              height: previewSize.height,
              backgroundColor: isDark ? '#202124' : '#C7CCD1',
              borderColor: colors.border ?? 'rgba(255,255,255,0.12)',
              shadowColor: isDark ? '#000000' : 'rgba(34,28,18,0.34)',
            },
          ]}
          testID="sticker-cutout-preview-frame"
        >
          <View pointerEvents="none" style={styles.checkerboardLayer}>
            {checkerTiles.map((tile) => (
              <View
                key={tile.key}
                style={[
                  styles.checkerTile,
                  {
                    left: tile.left,
                    top: tile.top,
                    backgroundColor: tile.dark
                      ? (isDark ? '#2A2C31' : '#ABB2BA')
                      : (isDark ? '#3A3D43' : '#D7DCE1'),
                  },
                ]}
              />
            ))}
          </View>

          {draft.backgroundVisible ? (
            <>
              <Reanimated.View style={[styles.photoLayer, sourcePhotoAnimatedStyle]}>
                <ExpoImage
                  source={{ uri: sourceUri }}
                  style={styles.previewImage}
                  contentFit="contain"
                  transition={0}
                />
              </Reanimated.View>
              <View
                pointerEvents="none"
                style={[
                  styles.backgroundVeil,
                  {
                    backgroundColor: isDark ? 'rgba(0,0,0,0.24)' : 'rgba(0,0,0,0.2)',
                  },
                ]}
              />
            </>
          ) : null}

          <View pointerEvents="none" style={styles.previewCenterLayer}>
            <View
              pointerEvents="none"
              style={[
                styles.stageFloatField,
                {
                  width: stickerDisplaySize.width,
                  height: stickerDisplaySize.height,
                },
              ]}
            >
              <View pointerEvents="none" style={styles.stageCenteredContent}>
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.stickerHalo,
                    focusAnimatedStyle,
                    stickerHaloAnimatedStyle,
                    {
                      left: -19,
                      top: -19,
                      width: stickerDisplaySize.width + 38,
                      height: stickerDisplaySize.height + 38,
                    },
                  ]}
                />
                <Reanimated.View
                  pointerEvents="none"
                  style={[styles.stickerLiftStage, stickerFloatAnimatedStyle]}
                >
                  <View
                    style={[
                      styles.stickerLiftWrap,
                      {
                        width: stickerDisplaySize.width,
                        height: stickerDisplaySize.height,
                      },
                    ]}
                  >
                    <View
                      pointerEvents="none"
                      style={[
                        styles.stickerLiftBackdrop,
                        {
                          backgroundColor: draft.backgroundVisible
                            ? (isDark ? 'rgba(20,22,24,0.34)' : 'rgba(255,255,255,0.26)')
                            : 'transparent',
                        },
                      ]}
                    />
                    {outlineEnabled ? (
                      <View
                        pointerEvents="none"
                        style={styles.outlinePreviewLayer}
                        testID="sticker-cutout-preview-outline"
                      >
                        {STICKER_PREVIEW_OUTLINE_OFFSETS.map((offset, index) => (
                          <ExpoImage
                            key={`outline-${index}`}
                            source={{ uri: cutoutUri }}
                            style={[
                              styles.previewImage,
                              {
                                tintColor: '#FFFFFF',
                                opacity: 0.98,
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
                    <Reanimated.View
                      pointerEvents="none"
                      style={[styles.glowPreviewLayer, stickerGlowAnimatedStyle]}
                    >
                      {STICKER_PREVIEW_GLOW_OFFSETS.map((offset, index) => (
                        <ExpoImage
                          key={`glow-${index}`}
                          source={{ uri: cutoutUri }}
                          style={[
                            styles.previewImage,
                            {
                              tintColor: '#7EDCFF',
                              opacity: 0.92,
                              transform: [
                                { translateX: offset.x * glowSize },
                                { translateY: offset.y * glowSize },
                              ],
                            },
                          ]}
                          contentFit="contain"
                          transition={0}
                        />
                      ))}
                    </Reanimated.View>
                    <ExpoImage
                      source={{ uri: cutoutUri }}
                      style={styles.previewImage}
                      contentFit="contain"
                      transition={0}
                    />
                  </View>
                </Reanimated.View>
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.shadowRow,
                  {
                    top: stickerDisplaySize.height + 18,
                  },
                ]}
              >
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.stickerShadow,
                    stickerShadowAnimatedStyle,
                    {
                      width: stickerDisplaySize.width * 0.76,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: outlineEnabled, disabled: busy }}
          disabled={busy}
          onPress={() => setOutlineEnabled((current) => !current)}
          style={({ pressed }) => [
            styles.outlineToggle,
            {
              backgroundColor: colors.card ?? (isDark ? '#242424' : '#FFFFFF'),
              borderColor: outlineEnabled
                ? colors.primary ?? '#0A84FF'
                : colors.border ?? 'rgba(255,255,255,0.14)',
              opacity: busy ? 0.56 : 1,
            },
            pressed && !busy ? styles.outlineTogglePressed : null,
          ]}
          testID="sticker-cutout-preview-outline-toggle"
        >
          <View
            style={[
              styles.outlineIconWrap,
              {
                backgroundColor: outlineEnabled
                  ? colors.primary ?? '#0A84FF'
                  : (isDark ? '#343434' : '#EFEFEF'),
              },
            ]}
          >
            <Ionicons
              name={outlineEnabled ? 'ellipse' : 'ellipse-outline'}
              size={15}
              color={outlineEnabled ? '#FFFFFF' : colors.secondaryText ?? '#666666'}
            />
          </View>
          <Text style={[styles.outlineToggleLabel, { color: colors.text ?? '#1C1C1E' }]}>
            {outlineEnabled ? outlineOnLabel : outlineOffLabel}
          </Text>
        </Pressable>
      </Reanimated.View>
    </View>
  );

  return (
    <StickerCreationOverlay
      visible={visible}
      loading={loading}
      title={title}
      subtitle={subtitle}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      testIDPrefix="sticker-cutout-preview"
      resetKey={cutoutUri}
      onClose={onClose}
      onConfirm={handleConfirmCreation}
      onCompletePlacement={onCompletePlacement}
      renderStage={renderStage}
    />
  );
}

export default memo(StickerCutoutPreviewEditor);

const styles = StyleSheet.create({
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stageStack: {
    alignItems: 'center',
    gap: 16,
  },
  previewFrame: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  checkerboardLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  checkerTile: {
    position: 'absolute',
    width: CHECKER_TILE_SIZE,
    height: CHECKER_TILE_SIZE,
  },
  photoLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  previewCenterLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageFloatField: {
    position: 'relative',
    overflow: 'visible',
  },
  stageCenteredContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerLiftStage: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerLiftWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlinePreviewLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  glowPreviewLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  stickerLiftBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radii.md,
  },
  stickerShadow: {
    height: 26,
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderRadius: 999,
  },
  shadowRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  stickerHalo: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(121,224,255,0.18)',
  },
  outlineToggle: {
    minHeight: 42,
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outlineTogglePressed: {
    transform: [{ scale: 0.98 }],
  },
  outlineIconWrap: {
    width: 25,
    height: 25,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineToggleLabel: {
    ...Typography.pill,
    fontSize: 14,
    fontWeight: '700',
  },
});
