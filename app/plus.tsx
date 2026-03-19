import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../components/ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../constants/theme';
import { useSubscription } from '../hooks/useSubscription';
import { useTheme } from '../hooks/useTheme';

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIconContainer, { backgroundColor: colors.primary + '14' }]}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: colors.secondaryText }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function PlusScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { 
    tier, 
    isPurchaseAvailable, 
    isPurchaseInFlight, 
    plusPriceLabel, 
    purchasePlus, 
    restorePurchases 
  } = useSubscription();

  const gradientColors: [string, string, string] = isDark
    ? [colors.background, colors.card, '#1A1A1A']
    : [colors.background, colors.surface, '#ECE2D7'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.heroSection}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="heart" size={64} color={colors.primary} />
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('auth.title', 'Noto')}
            </Text>
            <Text style={[styles.plusBadge, { color: colors.primary }]}>Plus</Text>
          </View>
          <Text style={[styles.brandAccent, { color: colors.secondaryText }]}>ノート</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('plus.subtitle', 'Elevate your memory journal')}
          </Text>
        </View>

        <View style={styles.featuresList}>
          <FeatureRow
            icon="infinite"
            title={t('plus.features.unlimitedTitle', 'Unlimited Memories')}
            description={t('plus.features.unlimitedDesc', 'Save every photo memory without limits.')}
          />
          <FeatureRow
            icon="images"
            title={t('plus.features.libraryTitle', 'Photos Import')}
            description={t('plus.features.libraryDesc', 'Import existing photos from your gallery.')}
          />
          <FeatureRow
            icon="cloud-upload"
            title={t('plus.features.syncTitle', 'Cloud Backup')}
            description={t('plus.features.syncDesc', 'Sync across all your devices automatically.')}
          />
          <FeatureRow
            icon="options"
            title={t('plus.features.radiusTitle', 'Custom Radius')}
            description={t('plus.features.radiusDesc', 'Fine-tune your reminder geofences.')}
          />
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.footerActions}>
          <PrimaryButton
            label={
              tier === 'plus'
                ? t('settings.plusActive', 'Plus Active')
                : !isPurchaseAvailable
                ? t('settings.plusUnavailable', 'Coming Soon')
                : plusPriceLabel
                ? t('plus.upgradeCtaWithPrice', 'Upgrade to Plus · {{price}}', { price: plusPriceLabel })
                : t('plus.cta', 'Upgrade to Noto Plus')
            }
            onPress={() => {
                if (tier === 'plus' || !isPurchaseAvailable || isPurchaseInFlight) return;
                void purchasePlus();
            }}
            loading={isPurchaseInFlight}
            variant="neutral"
            disabled={tier === 'plus' || !isPurchaseAvailable}
          />

          <PrimaryButton
            label={t('plus.restore', 'Restore purchases')}
            onPress={() => {
              if (isPurchaseInFlight) return;
              void restorePurchases();
            }}
            variant="secondary"
            disabled={isPurchaseInFlight}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding + 12,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: Layout.cardRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    ...Shadows.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    ...Typography.heroTitle,
    fontSize: 42,
    letterSpacing: -1,
  },
  plusBadge: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: Typography.screenTitle.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  brandAccent: {
    ...Typography.pill,
    letterSpacing: 4,
    marginBottom: 12,
    opacity: 0.78,
  },
  subtitle: {
    ...Typography.heroSubtitle,
    textAlign: 'center',
    opacity: 0.8,
  },
  featuresList: {
    gap: 16,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Typography.screenTitle.fontFamily,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 15,
    fontFamily: Typography.screenTitle.fontFamily,
    lineHeight: 20,
  },
  footerActions: {
    gap: 12,
  },
});
