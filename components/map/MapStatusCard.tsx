import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GlassView } from '../ui/GlassView';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import MapPreviewSheet from './MapPreviewSheet';
import {
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
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
}

const PREVIEW_HORIZONTAL_INSET = 14;
const STATUS_CARD_MAX_WIDTH = 356;

function getNoShadowBorderColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? 'rgba(255,255,255,0.16)' : 'rgba(113,86,26,0.24)';
  }

  return isDark ? 'rgba(255,255,255,0.2)' : 'rgba(17,24,39,0.12)';
}

function getStatusSurfaceColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? 'rgba(24,20,18,0.9)' : 'rgba(255,251,246,0.96)';
  }

  return isDark ? 'rgba(16,18,24,0.9)' : 'rgba(255,253,249,0.94)';
}

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
      : Math.min(fullSurfaceWidth, STATUS_CARD_MAX_WIDTH);

  const shellStyle = useMemo(
    () => [
      styles.surface,
      {
        width: shellWidth,
        borderColor: getNoShadowBorderColor(isDark),
        backgroundColor: getStatusSurfaceColor(isDark),
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
                  backgroundColor: getStatusSurfaceColor(isDark),
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
            <View style={styles.contentRow}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
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
                  accessibilityRole="button"
                  onPress={() => {
                    onInteraction?.();
                    onAction?.();
                  }}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: `${colors.primary}14`,
                      borderColor: `${colors.primary}2E`,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <Ionicons name={actionIcon} size={14} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]} numberOfLines={1}>
                    {actionLabel}
                  </Text>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'Noto Sans',
  },
  actionButton: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
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
