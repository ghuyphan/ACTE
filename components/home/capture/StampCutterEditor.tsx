import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Layout, Radii, Shadows, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import {
  getStampCutterWindowRect,
  normalizeStampCutterTransform,
  STAMP_CUTTER_OVERLAY_ASPECT_RATIO,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../../services/stampCutter';
import PrimaryButton from '../../ui/PrimaryButton';
import { triggerCaptureCardHaptic } from './captureMotion';

const STAMP_CUTTER_OVERLAY_IMAGE = require('../../../assets/images/icon/stamp-cutter.png');
const SCREEN_HORIZONTAL_PADDING = 18;
const EDITOR_STAGE_MAX_WIDTH = 430;
const NUDGE_STEP = 20;
const ZOOM_STEP = 0.18;

interface StampCutterEditorProps {
  visible: boolean;
  draft: StampCutterDraft | null;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (payload: {
    cropSize: { width: number; height: number };
    transform: StampCutterTransform;
  }) => void | Promise<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function StampCutterEditor({
  visible,
  draft,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  onClose,
  onConfirm,
}: StampCutterEditorProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [transform, setTransform] = useState<StampCutterTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [cutAnimating, setCutAnimating] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const zoomStartRef = useRef(1);
  const cutProgress = useSharedValue(0);

  useEffect(() => {
    setTransform({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
    cutProgress.value = 0;
    setCutAnimating(false);
  }, [cutProgress, draft?.source.uri, visible]);

  const overlayWidth = Math.min(windowWidth - SCREEN_HORIZONTAL_PADDING * 2, EDITOR_STAGE_MAX_WIDTH);
  const overlayHeight = overlayWidth / STAMP_CUTTER_OVERLAY_ASPECT_RATIO;
  const cropRect = useMemo(
    () => getStampCutterWindowRect({ width: overlayWidth, height: overlayHeight }),
    [overlayHeight, overlayWidth]
  );
  const sourceSize = useMemo(
    () => ({
      width: Math.max(1, draft?.width ?? 1),
      height: Math.max(1, draft?.height ?? 1),
    }),
    [draft?.height, draft?.width]
  );
  const normalized = useMemo(
    () => normalizeStampCutterTransform(sourceSize, cropRect, transform),
    [cropRect, sourceSize, transform]
  );
  const busy = loading || cutAnimating;

  const updateTransform = useCallback(
    (updater: (current: StampCutterTransform) => Partial<StampCutterTransform>) => {
      setTransform((current) =>
        normalizeStampCutterTransform(sourceSize, cropRect, {
          ...current,
          ...updater(current),
        })
      );
    },
    [cropRect, sourceSize]
  );

  const handleNudge = useCallback(
    (deltaX: number, deltaY: number) => {
      if (busy) {
        return;
      }

      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Light);
      updateTransform((current) => ({
        offsetX: current.offsetX + deltaX,
        offsetY: current.offsetY + deltaY,
      }));
    },
    [busy, updateTransform]
  );

  const handleZoom = useCallback(
    (delta: number) => {
      if (busy) {
        return;
      }

      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Light);
      updateTransform((current) => ({
        zoom: current.zoom + delta,
      }));
    },
    [busy, updateTransform]
  );

  const handleReset = useCallback(() => {
    if (busy) {
      return;
    }

    triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Light);
    setTransform({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  }, [busy]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!busy)
        .runOnJS(true)
        .onBegin(() => {
          panStartRef.current = {
            x: normalized.offsetX,
            y: normalized.offsetY,
          };
        })
        .onUpdate((event) => {
          setTransform((current) =>
            normalizeStampCutterTransform(sourceSize, cropRect, {
              ...current,
              offsetX: panStartRef.current.x + event.translationX,
              offsetY: panStartRef.current.y + event.translationY,
            })
          );
        }),
    [busy, cropRect, normalized.offsetX, normalized.offsetY, sourceSize]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(!busy)
        .runOnJS(true)
        .onBegin(() => {
          zoomStartRef.current = normalized.zoom;
        })
        .onUpdate((event) => {
          setTransform((current) =>
            normalizeStampCutterTransform(sourceSize, cropRect, {
              ...current,
              zoom: zoomStartRef.current * event.scale,
            })
          );
        }),
    [busy, cropRect, normalized.zoom, sourceSize]
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  const runConfirm = useCallback(async () => {
    if (busy) {
      return;
    }

    const payload = {
      cropSize: {
        width: cropRect.width,
        height: cropRect.height,
      },
      transform: {
        zoom: normalized.zoom,
        offsetX: normalized.offsetX,
        offsetY: normalized.offsetY,
      },
    };

    setCutAnimating(true);

    try {
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Medium);
      cutProgress.value = withTiming(1, {
        duration: reduceMotionEnabled ? 80 : 180,
        easing: Easing.out(Easing.cubic),
      });

      await delay(reduceMotionEnabled ? 70 : 120);
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(reduceMotionEnabled ? 40 : 110);
      await onConfirm(payload);
    } finally {
      cutProgress.value = withTiming(0, {
        duration: reduceMotionEnabled ? 90 : 220,
        easing: Easing.out(Easing.cubic),
      });
      setCutAnimating(false);
    }
  }, [
    busy,
    cropRect.height,
    cropRect.width,
    cutProgress,
    normalized.offsetX,
    normalized.offsetY,
    normalized.zoom,
    onConfirm,
    reduceMotionEnabled,
  ]);

  const previewLeft = (cropRect.width - normalized.imageWidth) / 2 + normalized.offsetX;
  const previewTop = (cropRect.height - normalized.imageHeight) / 2 + normalized.offsetY;

  const stageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.985]) },
      { translateY: interpolate(cutProgress.value, [0, 1], [0, 4]) },
    ],
  }));

  const cutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(cutProgress.value, [0, 1], [0, 26]) },
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.992]) },
    ],
  }));

  const previewAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.97]) },
    ],
  }));

  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cutProgress.value, [0, 0.8, 1], [0, isDark ? 0.08 : 0.14, 0]),
  }));

  if (!visible || !draft) {
    return null;
  }

  const textColor = colors.text ?? '#1C1C1E';
  const secondaryTextColor = colors.secondaryText ?? '#8E8E93';
  const borderColor = colors.border ?? 'rgba(255,255,255,0.12)';
  const stageBackground = isDark ? 'rgba(31,25,21,0.84)' : 'rgba(255,249,242,0.9)';
  const stageInnerBackground = isDark ? 'rgba(12,10,9,0.42)' : 'rgba(209,152,85,0.08)';
  const panelBackground = isDark ? 'rgba(31,25,21,0.78)' : 'rgba(255,250,244,0.92)';
  const topInset = Math.max(24, Math.min(windowHeight * 0.06, 44));
  const zoomPercent = `${Math.round(normalized.zoom * 100)}%`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          isDark
            ? ['#050506', '#101114', '#1C1A18']
            : ['#F7F1E8', '#EFE0C8', '#DEC59A']
        }
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="none"
        style={[
          styles.backgroundGlow,
          styles.backgroundGlowTop,
          { backgroundColor: isDark ? 'rgba(224,177,91,0.08)' : 'rgba(224,177,91,0.18)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.backgroundGlow,
          styles.backgroundGlowBottom,
          { backgroundColor: isDark ? 'rgba(255,159,10,0.08)' : 'rgba(184,119,69,0.14)' },
        ]}
      />

      <View style={[styles.header, { paddingTop: topInset }]}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onClose}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: isDark ? 'rgba(28,28,32,0.54)' : 'rgba(255,252,246,0.62)',
              borderColor,
              opacity: busy ? 0.5 : 1,
            },
            pressed && !busy ? styles.headerButtonPressed : null,
          ]}
          testID="stamp-cutter-cancel"
        >
          <Ionicons name="close" size={18} color={textColor} />
        </Pressable>

        <View style={[styles.headerTitleWrap, { borderColor, backgroundColor: panelBackground }]}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
          <Text style={[styles.headerSubtitle, { color: secondaryTextColor }]} numberOfLines={2}>
            {subtitle}
          </Text>
          <View style={[styles.headerHint, { borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(224,177,91,0.08)' }]}>
            <Ionicons name="finger-print-outline" size={12} color={secondaryTextColor} />
            <Text style={[styles.headerHintText, { color: secondaryTextColor }]}>Drag or pinch</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleReset}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: isDark ? 'rgba(28,28,32,0.54)' : 'rgba(255,252,246,0.62)',
              borderColor,
              opacity: busy ? 0.5 : 1,
            },
            pressed && !busy ? styles.headerButtonPressed : null,
          ]}
          testID="stamp-cutter-reset"
        >
          <Ionicons name="refresh" size={18} color={textColor} />
        </Pressable>
      </View>

      <View style={styles.stageArea}>
        <Reanimated.View
          style={[
            styles.stageShell,
            stageAnimatedStyle,
            {
              width: overlayWidth + 22,
              padding: 11,
              borderColor,
              backgroundColor: stageBackground,
            },
          ]}
        >
          <View
            style={[
              styles.stageInner,
              {
                backgroundColor: stageInnerBackground,
              },
            ]}
          >
            <View
              style={[
                styles.overlayFrame,
                {
                  width: overlayWidth,
                  height: overlayHeight,
                },
              ]}
            >
              <GestureDetector gesture={gesture}>
                <View
                  collapsable={false}
                  pointerEvents={busy ? 'none' : 'auto'}
                  style={[
                    styles.cropWindow,
                    {
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    },
                  ]}
                >
                  <Reanimated.View style={[styles.cropGestureSurface, previewAnimatedStyle]}>
                    <Image
                      source={{ uri: draft.source.uri }}
                      style={[
                        styles.previewImage,
                        {
                          width: normalized.imageWidth,
                          height: normalized.imageHeight,
                          left: previewLeft,
                          top: previewTop,
                        },
                      ]}
                      resizeMode="cover"
                    />
                  </Reanimated.View>
                </View>
              </GestureDetector>

              <Reanimated.View pointerEvents="none" style={[styles.overlayImageWrap, cutterAnimatedStyle]}>
                <Image
                  source={STAMP_CUTTER_OVERLAY_IMAGE}
                  style={styles.overlayImage}
                  resizeMode="contain"
                />
              </Reanimated.View>

              <Reanimated.View pointerEvents="none" style={[styles.flashOverlay, flashAnimatedStyle]} />

              {busy ? (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color={textColor} />
                </View>
              ) : null}
            </View>
          </View>
        </Reanimated.View>
      </View>

      <View style={styles.controlsArea}>
        <View style={[styles.controlPanel, { borderColor, backgroundColor: panelBackground }]}>
          <View style={styles.panelSection}>
            <Text style={[styles.panelLabel, { color: secondaryTextColor }]}>Zoom</Text>
            <View style={styles.controlRow}>
              <ControlIconButton
                icon="remove"
                label="Zoom out"
                disabled={busy}
                onPress={() => handleZoom(-ZOOM_STEP)}
                textColor={textColor}
                borderColor={borderColor}
              />
              <View style={[styles.zoomBadge, { borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(224,177,91,0.08)' }]}>
                <Text style={[styles.zoomLabel, { color: textColor }]}>{zoomPercent}</Text>
              </View>
              <ControlIconButton
                icon="add"
                label="Zoom in"
                disabled={busy}
                onPress={() => handleZoom(ZOOM_STEP)}
                textColor={textColor}
                borderColor={borderColor}
              />
            </View>
          </View>

          <View style={[styles.panelDivider, { backgroundColor: borderColor }]} />

          <View style={styles.panelSection}>
            <Text style={[styles.panelLabel, { color: secondaryTextColor }]}>Position</Text>
            <View style={styles.dpad}>
              <View style={styles.dpadRow}>
                <View style={styles.dpadSpacer} />
                <ControlIconButton
                  icon="arrow-up"
                  label="Move up"
                  disabled={busy}
                  onPress={() => handleNudge(0, -NUDGE_STEP)}
                  textColor={textColor}
                  borderColor={borderColor}
                />
                <View style={styles.dpadSpacer} />
              </View>
              <View style={styles.dpadRow}>
                <ControlIconButton
                  icon="arrow-back"
                  label="Move left"
                  disabled={busy}
                  onPress={() => handleNudge(-NUDGE_STEP, 0)}
                  textColor={textColor}
                  borderColor={borderColor}
                />
                <View style={[styles.dpadCenter, { borderColor }]}>
                  <Text style={[styles.dpadCenterLabel, { color: secondaryTextColor }]}>Drag</Text>
                </View>
                <ControlIconButton
                  icon="arrow-forward"
                  label="Move right"
                  disabled={busy}
                  onPress={() => handleNudge(NUDGE_STEP, 0)}
                  textColor={textColor}
                  borderColor={borderColor}
                />
              </View>
              <View style={styles.dpadRow}>
                <View style={styles.dpadSpacer} />
                <ControlIconButton
                  icon="arrow-down"
                  label="Move down"
                  disabled={busy}
                  onPress={() => handleNudge(0, NUDGE_STEP)}
                  textColor={textColor}
                  borderColor={borderColor}
                />
                <View style={styles.dpadSpacer} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor,
                backgroundColor: stageBackground,
                opacity: busy ? 0.5 : 1,
              },
              pressed && !busy ? styles.headerButtonPressed : null,
            ]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: textColor }]}>{cancelLabel}</Text>
          </Pressable>
          <PrimaryButton
            label={confirmLabel}
            onPress={() => {
              void runConfirm();
            }}
            loading={busy}
            style={styles.confirmButton}
            testID="stamp-cutter-confirm"
          />
        </View>
      </View>
    </View>
  );
}

function ControlIconButton({
  icon,
  label,
  disabled,
  onPress,
  textColor,
  borderColor,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  disabled: boolean;
  onPress: () => void;
  textColor: string;
  borderColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        {
          borderColor,
          opacity: disabled ? 0.48 : 1,
        },
        pressed && !disabled ? styles.headerButtonPressed : null,
      ]}
    >
      <Ionicons name={icon} size={18} color={textColor} />
    </Pressable>
  );
}

export default memo(StampCutterEditor);

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  header: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.md + 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  headerTitleWrap: {
    flex: 1,
    borderRadius: Radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerTitle: {
    ...Typography.button,
  },
  headerSubtitle: {
    ...Typography.pill,
    textAlign: 'center',
    lineHeight: 18,
  },
  headerHint: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerHintText: {
    ...Typography.pill,
    fontSize: 12,
    lineHeight: 16,
  },
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  stageShell: {
    borderRadius: 34,
    borderWidth: 1,
    ...Shadows.card,
  },
  stageInner: {
    borderRadius: Radii.card,
    overflow: 'hidden',
    paddingVertical: 10,
    alignItems: 'center',
  },
  overlayFrame: {
    position: 'relative',
  },
  cropWindow: {
    position: 'absolute',
    overflow: 'hidden',
  },
  cropGestureSurface: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    position: 'absolute',
  },
  overlayImageWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF8ED',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsArea: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 18,
    gap: 12,
  },
  controlPanel: {
    borderRadius: Radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  panelSection: {
    gap: 10,
  },
  panelLabel: {
    ...Typography.pill,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
  dpad: {
    gap: 10,
  },
  dpadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dpadSpacer: {
    width: 44,
    height: 44,
  },
  dpadCenter: {
    minWidth: 92,
    height: 44,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dpadCenterLabel: {
    ...Typography.pill,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  zoomBadge: {
    minWidth: 86,
    height: 44,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  zoomLabel: {
    ...Typography.button,
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: Layout.buttonHeight,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    ...Typography.button,
  },
  confirmButton: {
    flex: 1.25,
  },
  backgroundGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    opacity: 0.9,
  },
  backgroundGlowTop: {
    top: -40,
    right: -70,
  },
  backgroundGlowBottom: {
    left: -80,
    bottom: 160,
  },
});
