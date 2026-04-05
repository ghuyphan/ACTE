import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GlassView } from '../ui/GlassView';
import {
  getMapCardEnter,
  getMapCardExit,
  getMapLayoutTransition,
  mapMotionDurations,
  mapMotionEasing,
  mapMotionPressTiming,
} from './mapMotion';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayMutedFillColor,
  mapOverlayTokens,
} from './overlayTokens';

type OverlayState = 'no-filter-results' | 'no-notes' | 'no-area-results';
type MapStatusCardVariant = 'card' | 'pill';

interface MapStatusCardProps {
  overlayState: OverlayState;
  variant?: MapStatusCardVariant;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  secondaryTextColor: string;
  reduceMotionEnabled: boolean;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionTestID?: string;
  onAction?: () => void;
}

export default function MapStatusCard({
  overlayState,
  variant = 'card',
  isDark,
  primaryColor,
  textColor,
  secondaryTextColor,
  reduceMotionEnabled,
  title,
  subtitle,
  actionLabel,
  actionTestID,
  onAction,
}: MapStatusCardProps) {
  const isFiltered = overlayState === 'no-filter-results';
  const isIOS = Platform.OS === 'ios';
  const shouldUseGlass = isIOS;
  const fallbackFill = getOverlayFallbackColor(isDark);
  const statusGlassScrimColor = isDark ? 'rgba(12,12,18,0.10)' : 'rgba(255,255,255,0.04)';
  const iconColor = isIOS ? secondaryTextColor : primaryColor;
  const isPill = variant === 'pill';
  const pillEnterProgress = useSharedValue(reduceMotionEnabled ? 1 : 0);
  const pressScale = useSharedValue(1);
  const animatedPillEntranceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(pillEnterProgress.value, [0, 1], [10, 0]) },
      { scale: interpolate(pillEnterProgress.value, [0, 1], [0.985, 1]) },
    ],
  }));
  const animatedPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  useEffect(() => {
    if (!isPill) {
      return;
    }

    if (reduceMotionEnabled) {
      pillEnterProgress.value = 1;
      return;
    }

    pillEnterProgress.value = 0;
    pillEnterProgress.value = withTiming(1, {
      duration: mapMotionDurations.standard,
      easing: mapMotionEasing.standard,
    });
  }, [isPill, pillEnterProgress, reduceMotionEnabled]);

  const handlePressState = useCallback(
    (pressed: boolean) => {
      if (reduceMotionEnabled) {
        pressScale.value = 1;
        return;
      }

      pressScale.value = withTiming(pressed ? 0.975 : 1, mapMotionPressTiming);
    },
    [pressScale, reduceMotionEnabled]
  );

  if (isPill && actionLabel && onAction) {
    return (
      <Animated.View
        testID="map-status-card"
        style={styles.wrap}
        layout={getMapLayoutTransition(reduceMotionEnabled)}
      >
        <Animated.View style={animatedPillEntranceStyle}>
          <Animated.View style={animatedPressStyle}>
          <Pressable
            testID={actionTestID}
            style={({ pressed }) => [
              styles.pill,
              isIOS ? styles.pillIOS : styles.pillAndroid,
              {
                opacity: pressed ? 0.74 : 1,
                borderColor: isIOS ? getOverlayBorderColor(isDark) : 'transparent',
                backgroundColor: shouldUseGlass ? 'transparent' : getOverlayMutedFillColor(isDark),
              },
            ]}
            onPress={onAction}
            onPressIn={() => {
              handlePressState(true);
            }}
            onPressOut={() => {
              handlePressState(false);
            }}
            >
            {shouldUseGlass ? (
              <GlassView
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                glassEffectStyle="regular"
                colorScheme={isDark ? 'dark' : 'light'}
              />
            ) : null}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.pillScrim,
                {
                  backgroundColor: shouldUseGlass ? statusGlassScrimColor : getOverlayMutedFillColor(isDark),
                },
              ]}
            />
            <View style={[styles.pillIconWrap, { backgroundColor: `${primaryColor}16` }]}>
              <Ionicons name="add-circle-outline" size={16} color={primaryColor} />
            </View>
            <Text
              style={[
                styles.pillLabel,
                isIOS ? styles.pillLabelIOS : styles.pillLabelAndroid,
                { color: primaryColor },
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      testID="map-status-card"
      style={styles.wrap}
      entering={getMapCardEnter(reduceMotionEnabled)}
      exiting={getMapCardExit(reduceMotionEnabled)}
      layout={getMapLayoutTransition(reduceMotionEnabled)}
    >
      <View
        style={[
          styles.card,
          isIOS ? styles.cardIOS : styles.cardAndroid,
          {
            borderColor: isIOS ? getOverlayBorderColor(isDark) : 'transparent',
            backgroundColor: shouldUseGlass ? 'transparent' : fallbackFill,
          },
        ]}
      >
        {shouldUseGlass ? (
          <GlassView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.scrim,
            isIOS ? styles.scrimIOS : styles.scrimAndroid,
            {
              backgroundColor: shouldUseGlass ? statusGlassScrimColor : fallbackFill,
            },
          ]}
        />
        <View style={[styles.content, isIOS ? styles.contentIOS : styles.contentAndroid]}>
          <View style={[styles.iconWrap, { backgroundColor: `${primaryColor}14` }]}>
            <Ionicons
              name={isFiltered ? 'filter-outline' : 'map-outline'}
              size={isIOS ? (isFiltered ? 22 : 24) : isFiltered ? 26 : 28}
              color={iconColor}
            />
          </View>
          <View style={styles.copyBlock}>
            <Text style={[styles.title, isIOS ? styles.titleIOS : styles.titleAndroid, { color: textColor }]}>
              {title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                isIOS ? styles.subtitleIOS : styles.subtitleAndroid,
                { color: secondaryTextColor },
              ]}
            >
              {subtitle}
            </Text>
            {actionLabel && onAction ? (
              <Pressable
                testID={actionTestID}
                style={[
                  styles.clearFiltersBtn,
                  isIOS ? styles.clearFiltersBtnIOS : styles.clearFiltersBtnAndroid,
                  isIOS ? null : { backgroundColor: `${primaryColor}14` },
                ]}
                onPress={onAction}
              >
                <Text
                  style={[
                    styles.clearFiltersText,
                    isIOS ? styles.clearFiltersTextIOS : styles.clearFiltersTextAndroid,
                    { color: primaryColor },
                  ]}
                >
                  {actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  pillIOS: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillAndroid: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...mapOverlayTokens.overlayShadow,
  },
  pillScrim: {
    borderRadius: 21,
  },
  pillIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: 'Noto Sans',
  },
  pillLabelIOS: {
    fontSize: 15,
    fontWeight: '700',
  },
  pillLabelAndroid: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    overflow: 'hidden',
  },
  cardIOS: {
    maxWidth: 360,
    borderRadius: mapOverlayTokens.overlayRadius,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    borderCurve: 'continuous',
  },
  cardAndroid: {
    maxWidth: 368,
    borderRadius: mapOverlayTokens.overlayRadius,
    borderWidth: 0,
    ...mapOverlayTokens.overlayShadow,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contentIOS: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  contentAndroid: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  copyBlock: {
    flex: 1,
  },
  scrim: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  scrimIOS: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  scrimAndroid: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'Noto Sans',
  },
  titleIOS: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  titleAndroid: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Noto Sans',
  },
  subtitleIOS: {
    fontSize: 12,
    lineHeight: 17,
  },
  subtitleAndroid: {
    fontSize: 13,
    lineHeight: 18,
  },
  clearFiltersBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 999,
  },
  clearFiltersBtnIOS: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  clearFiltersBtnAndroid: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearFiltersText: {
    fontFamily: 'Noto Sans',
  },
  clearFiltersTextIOS: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearFiltersTextAndroid: {
    fontSize: 13,
    fontWeight: '700',
  },
});
