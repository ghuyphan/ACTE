import { Host, RNHostView } from '@expo/ui/swift-ui';
import { environment } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  const router = useRouter();
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

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.heroSection}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="sparkles" size={60} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('plus.title', 'Noto Plus')}
          </Text>
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

          <Pressable
            onPress={() => {
                if (isPurchaseInFlight) return;
                void restorePurchases();
            }}
            style={({ pressed }) => [styles.linkButton, pressed ? styles.linkButtonPressed : null]}
          >
            <Text style={[styles.linkButtonLabel, { color: colors.secondaryText }]}>
              {t('plus.restore', 'Restore purchases')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding + 12,
    paddingTop: 10,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: Layout.cardRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.card,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    fontFamily: Typography.screenTitle.fontFamily,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: Typography.screenTitle.fontFamily,
    textAlign: 'center',
    opacity: 0.8,
  },
  featuresList: {
    gap: 22,
    marginBottom: 32,
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
  linkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Typography.screenTitle.fontFamily,
  },
  linkButtonPressed: {
    opacity: 0.7,
  },
});
