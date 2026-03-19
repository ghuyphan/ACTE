import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import Reanimated from 'react-native-reanimated';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMapLayoutTransition } from './mapMotion';
import { getOverlayBorderColor, mapOverlayTokens } from './overlayTokens';

type OverlayState = 'no-filter-results' | 'no-notes';

interface MapStatusCardProps {
  overlayState: OverlayState;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  secondaryTextColor: string;
  onClearFilters: () => void;
  reduceMotionEnabled: boolean;
  title: string;
  subtitle: string;
  clearLabel: string;
}

export default function MapStatusCard({
  overlayState,
  isDark,
  primaryColor,
  textColor,
  secondaryTextColor,
  onClearFilters,
  reduceMotionEnabled,
  title,
  subtitle,
  clearLabel,
}: MapStatusCardProps) {
  const isFiltered = overlayState === 'no-filter-results';
  const shouldUseGlass = Platform.OS === 'ios';
  const fallbackFill = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';
  const statusGlassTintColor = isDark ? 'rgba(18,18,24,0.34)' : 'rgba(255,255,255,0.42)';
  const statusGlassScrimColor = isDark ? 'rgba(12,12,18,0.18)' : 'rgba(255,255,255,0.20)';

  return (
    <Reanimated.View
      key={overlayState}
      testID="map-status-card"
      layout={getMapLayoutTransition(reduceMotionEnabled)}
      style={styles.wrap}
    >
      <View style={[styles.card, { borderColor: getOverlayBorderColor(isDark) }]}>
        {shouldUseGlass ? (
          <GlassView
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
            tintColor={statusGlassTintColor}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.scrim,
            {
              backgroundColor: shouldUseGlass ? statusGlassScrimColor : fallbackFill,
            },
          ]}
        />
        <View style={styles.content}>
          <Ionicons
            name={isFiltered ? 'filter-outline' : 'map-outline'}
            size={isFiltered ? 36 : 40}
            color={primaryColor}
            style={styles.icon}
          />
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>{subtitle}</Text>
          {isFiltered ? (
            <Pressable
              testID="map-clear-filters"
              style={[styles.clearFiltersBtn, { backgroundColor: `${primaryColor}20` }]}
              onPress={onClearFilters}
            >
              <Text style={[styles.clearFiltersText, { color: primaryColor }]}>{clearLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
  },
  scrim: {
    borderRadius: 24,
  },
  icon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'System',
  },
  clearFiltersBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
