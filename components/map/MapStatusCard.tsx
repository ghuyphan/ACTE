import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
}

const PREVIEW_HORIZONTAL_INSET = 14;
const STATUS_CARD_MAX_WIDTH = 328;

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
  const isPill = isActionOnly || isPassivePill;
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const shellMaxWidth = Math.min(fullSurfaceWidth, STATUS_CARD_MAX_WIDTH);

  const shellStyle = useMemo(
    () => [
      styles.surface,
      isPill ? styles.pillSurface : null,
      {
        maxWidth: shellMaxWidth,
        width: isPill ? undefined : shellMaxWidth,
        borderColor: getOverlayBorderColor(isDark, colors),
        backgroundColor: getOverlayFallbackColor(isDark, colors),
      },
    ],
    [colors, isDark, isPill, shellMaxWidth]
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
                  backgroundColor: getOverlayFallbackColor(isDark, colors),
                  opacity: pressed ? 0.72 : 1,
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
  },
  surface: {
    borderWidth: 1,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  pillSurface: {
    borderRadius: mapOverlayTokens.overlayRadius,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  sideActionButton: {
    position: 'absolute',
    right: 0,
    width: mapOverlayTokens.floatingButtonSize,
    height: mapOverlayTokens.floatingButtonSize,
    borderRadius: mapOverlayTokens.overlayRadius,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
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
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
});
