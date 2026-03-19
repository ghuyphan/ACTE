import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapStatusCard from '../map/MapStatusCard';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useNotesStore } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';

export default function MapScreenAndroid() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { loading } = useNotesStore();
  const reduceMotionEnabled = useReducedMotion();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.center, styles.screen, { backgroundColor: colors.background }]}>
      <View testID="map-android-fallback" style={styles.cardWrap}>
        <MapStatusCard
          overlayState="no-notes"
          isDark={isDark}
          primaryColor={colors.primary}
          textColor={colors.text}
          secondaryTextColor={colors.secondaryText}
          onClearFilters={() => undefined}
          reduceMotionEnabled={reduceMotionEnabled}
          title={t('map.androidUnavailableTitle', 'Map is temporarily unavailable on Android')}
          subtitle={t(
            'map.androidUnavailableSubtitle',
            'This build skips Google Maps on Android until the API key is configured.'
          )}
          clearLabel={t('map.clearFilters', 'Clear filters')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screen: {
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 320,
  },
});
