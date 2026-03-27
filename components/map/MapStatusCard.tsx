import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getOverlayBorderColor, mapOverlayTokens } from './overlayTokens';

type OverlayState = 'no-filter-results' | 'no-notes' | 'no-area-results';

interface MapStatusCardProps {
  overlayState: OverlayState;
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
  const fallbackFill = isDark ? 'rgba(26,26,32,0.95)' : 'rgba(248,247,243,0.88)';
  const statusGlassScrimColor = isDark ? 'rgba(12,12,18,0.10)' : 'rgba(255,255,255,0.04)';
  const iconColor = isIOS ? secondaryTextColor : primaryColor;

  return (
    <View key={overlayState} testID="map-status-card" style={styles.wrap}>
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
            style={StyleSheet.absoluteFillObject}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.scrim,
            isIOS ? styles.scrimIOS : styles.scrimAndroid,
            {
              backgroundColor: shouldUseGlass ? statusGlassScrimColor : fallbackFill,
            },
          ]}
        />
        <View style={[styles.content, isIOS ? styles.contentIOS : styles.contentAndroid]}>
          <Ionicons
            name={isFiltered ? 'filter-outline' : 'map-outline'}
            size={isIOS ? (isFiltered ? 26 : 28) : isFiltered ? 32 : 34}
            color={iconColor}
            style={styles.icon}
          />
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    overflow: 'hidden',
  },
  cardIOS: {
    maxWidth: 292,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    borderCurve: 'continuous',
  },
  cardAndroid: {
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 0,
    ...mapOverlayTokens.overlayShadow,
  },
  content: {
    alignItems: 'center',
  },
  contentIOS: {
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  contentAndroid: {
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  scrim: {
    borderRadius: 24,
  },
  scrimIOS: {
    borderRadius: 20,
  },
  scrimAndroid: {
    borderRadius: 22,
  },
  icon: {
    marginBottom: 10,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'System',
  },
  titleIOS: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  titleAndroid: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: 'System',
  },
  subtitleIOS: {
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 220,
  },
  subtitleAndroid: {
    fontSize: 14,
    lineHeight: 20,
  },
  clearFiltersBtn: {
    marginTop: 12,
    borderRadius: 999,
  },
  clearFiltersBtnIOS: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  clearFiltersBtnAndroid: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearFiltersText: {
    fontFamily: 'System',
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
