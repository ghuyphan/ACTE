import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GlassView } from '../ui/GlassView';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import MapPreviewSheet from './MapPreviewSheet';
import {
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
  actionTestID?: string;
  onAction?: () => void;
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
}

const PREVIEW_HORIZONTAL_INSET = 14;

function getNoShadowBorderColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? 'rgba(255,255,255,0.16)' : 'rgba(113,86,26,0.24)';
  }

  return isDark ? 'rgba(255,255,255,0.2)' : 'rgba(17,24,39,0.12)';
}

export default function MapStatusCard({
  visible,
  bottomOffset,
  title,
  subtitle,
  icon = 'albums-outline',
  actionLabel,
  actionTestID,
  onAction,
  onInteraction,
  reduceMotionEnabled,
}: MapStatusCardProps) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  const isPassivePill = Boolean(title) && !subtitle && !actionLabel;
  const isActionOnly = !title && !subtitle && Boolean(actionLabel);
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const compactWidth = Math.min(fullSurfaceWidth, 168);
  const shellWidth = isPassivePill
    ? compactWidth
    : isActionOnly
      ? Math.min(fullSurfaceWidth, 196)
      : fullSurfaceWidth;

  const shellStyle = useMemo(
    () => [
      styles.surface,
      {
        width: shellWidth,
        borderColor: getNoShadowBorderColor(isDark),
        backgroundColor: getOverlayFallbackColor(isDark),
      },
    ],
    [isDark, shellWidth]
  );

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
      allowDismiss={false}
      allowDragDismiss={false}
      allowExpand={false}
      handleVisible={false}
    >
      <View style={styles.surfaceHost} pointerEvents="box-none">
        <View testID="map-status-surface" style={[shellStyle, styles.surfaceNoShadow]}>
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
            fallbackColor="transparent"
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: getOverlayScrimColor(isDark),
              },
            ]}
          />
          {isOlderIOS ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: getOverlayFallbackColor(isDark),
                },
              ]}
            />
          ) : null}

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
              <Ionicons name={icon} size={14} color={colors.primary} />
              <Text style={[styles.pillLabel, { color: colors.primary }]} numberOfLines={1}>
                {actionLabel}
              </Text>
              <Ionicons name="chevron-up" size={13} color={colors.primary} />
            </Pressable>
          ) : (
            <View style={styles.content}>
              <View style={styles.headerRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
                  <Ionicons name={icon} size={15} color={colors.primary} />
                </View>
                <View style={styles.copyWrap}>
                  {title ? (
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>

              {actionLabel ? (
                <Pressable
                  testID={actionTestID}
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
                  <Text style={[styles.actionText, { color: colors.primary }]} numberOfLines={1}>
                    {actionLabel}
                  </Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  surfaceHost: {
    alignItems: 'center',
  },
  surface: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingVertical: 16,
    ...mapOverlayTokens.overlayShadow,
  },
  surfaceNoShadow: {
    borderWidth: 1,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  content: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  actionButton: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  actionOnlyPill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
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
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
});
