import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassView } from '../ui/GlassView';
import { getOverlayBorderColor, mapOverlayTokens } from './overlayTokens';

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
  const fallbackFill = isDark ? 'rgba(26,26,32,0.95)' : 'rgba(248,247,243,0.88)';
  const statusGlassScrimColor = isDark ? 'rgba(12,12,18,0.10)' : 'rgba(255,255,255,0.04)';
  const iconColor = isIOS ? secondaryTextColor : primaryColor;
  const isPill = variant === 'pill';

  if (isPill && actionLabel && onAction) {
    return (
      <View testID="map-status-card" style={styles.wrap}>
        <Pressable
          testID={actionTestID}
          style={({ pressed }) => [
            styles.pill,
            isIOS ? styles.pillIOS : styles.pillAndroid,
            {
              opacity: pressed ? 0.94 : 1,
              borderColor: isIOS ? getOverlayBorderColor(isDark) : 'transparent',
              backgroundColor: shouldUseGlass ? 'transparent' : fallbackFill,
            },
          ]}
          onPress={onAction}
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
                backgroundColor: shouldUseGlass ? statusGlassScrimColor : fallbackFill,
              },
            ]}
          />
          <Ionicons name="albums-outline" size={15} color={primaryColor} />
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
      </View>
    );
  }

  return (
    <View testID="map-status-card" style={styles.wrap}>
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
          <Ionicons
            name={isFiltered ? 'filter-outline' : 'map-outline'}
            size={isIOS ? (isFiltered ? 26 : 28) : isFiltered ? 32 : 34}
            color={iconColor}
            style={styles.icon}
          />
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
    </View>
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
    gap: 8,
    overflow: 'hidden',
  },
  pillIOS: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillAndroid: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...mapOverlayTokens.overlayShadow,
  },
  pillScrim: {
    borderRadius: 20,
  },
  pillLabel: {
    fontFamily: 'Noto Sans',
  },
  pillLabelIOS: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillLabelAndroid: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    overflow: 'hidden',
  },
  cardIOS: {
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    borderCurve: 'continuous',
  },
  cardAndroid: {
    maxWidth: 368,
    borderRadius: 22,
    borderWidth: 0,
    ...mapOverlayTokens.overlayShadow,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    borderRadius: 24,
  },
  scrimIOS: {
    borderRadius: 20,
  },
  scrimAndroid: {
    borderRadius: 22,
  },
  icon: {
    marginTop: 2,
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
