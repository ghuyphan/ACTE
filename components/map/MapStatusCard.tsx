import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GlassView } from '../ui/GlassView';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';

interface MapStatusCardProps {
  visible: boolean;
  bottomOffset: number;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionTestID?: string;
  onAction?: () => void;
  sideActionIcon?: keyof typeof Ionicons.glyphMap;
  sideActionAccessibilityLabel?: string;
  sideActionAccessibilityHint?: string;
  sideActionTestID?: string;
  onSideAction?: () => void;
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
  skipExitAnimation?: boolean;
}

const PREVIEW_HORIZONTAL_INSET = 14;
const STATUS_CARD_MAX_WIDTH = 328;
const STATUS_SIDE_ACTION_GAP = 8;

export default function MapStatusCard({
  visible,
  bottomOffset,
  title,
  subtitle,
  icon = 'albums-outline',
  actionLabel,
  actionIcon = 'arrow-forward-circle-outline',
  actionTestID,
  onAction,
  sideActionIcon,
  sideActionAccessibilityLabel,
  sideActionAccessibilityHint,
  sideActionTestID,
  onSideAction,
  onInteraction,
  reduceMotionEnabled,
  skipExitAnimation = false,
}: MapStatusCardProps) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [isMounted, setIsMounted] = useState(visible);
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  const isPassivePill = Boolean(title) && !subtitle && !actionLabel;
  const isActionOnly = !title && !subtitle && Boolean(actionLabel);
  const isPill = isActionOnly || isPassivePill;
  const hasSideAction = Boolean(sideActionIcon && onSideAction);
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const shellMaxWidth = Math.min(
    hasSideAction
      ? Math.max(0, fullSurfaceWidth - mapOverlayTokens.floatingButtonSize - STATUS_SIDE_ACTION_GAP)
      : fullSurfaceWidth,
    STATUS_CARD_MAX_WIDTH
  );
  const contentMotionProgress = useSharedValue(reduceMotionEnabled ? 1 : 0);
  const contentSignature = `${title ?? ''}|${subtitle ?? ''}|${actionLabel ?? ''}|${icon}|${actionIcon}`;

  const shellStyle = useMemo(
    () => [
      styles.surface,
      isPill ? styles.pillSurface : null,
      {
        maxWidth: shellMaxWidth,
        width: isPill ? undefined : shellMaxWidth,
        borderColor: getOverlayBorderColor(isDark, colors),
        backgroundColor: isAndroid
          ? colors.androidTabShellBackground
          : getOverlayFallbackColor(isDark, colors),
        shadowColor: isAndroid ? colors.androidTabShellShadow : undefined,
      },
    ],
    [colors, isAndroid, isDark, isPill, shellMaxWidth]
  );

  useEffect(() => {
    contentMotionProgress.value = reduceMotionEnabled ? 1 : 0;
    if (!reduceMotionEnabled) {
      contentMotionProgress.value = withTiming(1, { duration: 180 });
    }
  }, [contentMotionProgress, contentSignature, reduceMotionEnabled]);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentMotionProgress.value, [0, 1], [0.72, 1]),
    transform: [
      {
        translateY: interpolate(contentMotionProgress.value, [0, 1], [3, 0]),
      },
    ],
  }));

  if ((!isMounted && !visible) || (!title && !actionLabel)) {
    return null;
  }

  return (
    <MapPreviewSheet
      isVisible={visible}
      onFullyClosed={() => setIsMounted(false)}
      shellTestID="map-preview-shell"
      dismissTestID="map-status-dismiss"
      bottomOffset={bottomOffset}
      onDismiss={() => {}}
      reduceMotionEnabled={reduceMotionEnabled}
      skipExitAnimation={skipExitAnimation}
      allowDismiss={false}
      allowDragDismiss={false}
      allowExpand={false}
      handleVisible={false}
    >
      <View style={styles.surfaceHost} pointerEvents="box-none">
        <View style={styles.surfaceRow} pointerEvents="box-none">
          <View testID="map-status-surface" style={shellStyle}>
            <GlassView
              pointerEvents="none"
              glassEffectStyle="regular"
              colorScheme={isDark ? 'dark' : 'light'}
              fallbackColor="transparent"
              tintColor={colors.glassOverlaySurface}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: getOverlayScrimColor(isDark, colors),
                },
              ]}
            />
            {isOlderIOS ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: getOverlayFallbackColor(isDark, colors),
                  },
                ]}
              />
            ) : null}

            <Reanimated.View style={contentAnimatedStyle}>
              {isPassivePill && title ? (
                <View style={styles.pillContent}>
                  <View style={[styles.pillDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.pillLabel, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                </View>
              ) : isActionOnly && actionLabel ? (
                <Pressable
                  testID={actionTestID}
                  accessibilityRole="button"
                  onPress={() => {
                    onInteraction?.();
                    onAction?.();
                  }}
                  style={({ pressed }) => [
                    styles.actionOnlyPill,
                    {
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <Ionicons name={actionIcon} size={14} color={colors.primary} />
                  <Text style={[styles.pillLabel, { color: colors.primary }]} numberOfLines={1}>
                    {actionLabel}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.contentRow}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={icon} size={17} color={colors.primary} />
                  </View>
                  <View style={styles.copyWrap}>
                    {title ? (
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {title}
                      </Text>
                    ) : null}
                    {subtitle ? (
                      <Text style={[styles.subtitle, { color: colors.secondaryText }]} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>

                  {actionLabel ? (
                    <Pressable
                      testID={actionTestID}
                      accessibilityLabel={actionLabel}
                      accessibilityRole="button"
                      onPress={() => {
                        onInteraction?.();
                        onAction?.();
                      }}
                      style={({ pressed }) => [
                        styles.actionButton,
                        {
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <Ionicons name={actionIcon} size={14} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              )}
            </Reanimated.View>
          </View>
          {sideActionIcon && onSideAction ? (
            <Pressable
              testID={sideActionTestID}
              accessibilityHint={sideActionAccessibilityHint}
              accessibilityLabel={sideActionAccessibilityLabel}
              accessibilityRole="button"
              onPress={() => {
                onInteraction?.();
                onSideAction();
              }}
              style={({ pressed }) => [
                styles.sideActionButton,
                {
                  borderColor: getOverlayBorderColor(isDark, colors),
                  backgroundColor: isAndroid
                    ? colors.androidTabShellBackground
                    : getOverlayFallbackColor(isDark, colors),
                  opacity: pressed ? 0.72 : 1,
                  shadowColor: isAndroid ? colors.androidTabShellShadow : undefined,
                },
              ]}
            >
              <GlassView
                pointerEvents="none"
                glassEffectStyle="regular"
                colorScheme={isDark ? 'dark' : 'light'}
                fallbackColor="transparent"
                tintColor={colors.glassOverlaySurface}
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: getOverlayScrimColor(isDark, colors),
                  },
                ]}
              />
              {isOlderIOS ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: getOverlayFallbackColor(isDark, colors),
                    },
                  ]}
                />
              ) : null}
              <Ionicons name={sideActionIcon} size={20} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  surfaceHost: {
    width: '100%',
    alignItems: 'center',
  },
  surfaceRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: STATUS_SIDE_ACTION_GAP,
  },
  surface: {
    borderWidth: 1,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0.16 : 0,
    shadowRadius: 22,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  pillSurface: {
    borderRadius: mapOverlayTokens.overlayRadius,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  sideActionButton: {
    width: mapOverlayTokens.floatingButtonSize,
    height: mapOverlayTokens.floatingButtonSize,
    borderRadius: mapOverlayTokens.overlayRadius,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0.16 : 0,
    shadowRadius: 22,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Noto Sans',
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionOnlyPill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  pillContent: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
});
