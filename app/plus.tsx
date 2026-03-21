import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OfflineNotice from '../components/ui/OfflineNotice';
import PrimaryButton from '../components/ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../constants/theme';
import { useConnectivity } from '../hooks/useConnectivity';
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
  const { isOnline } = useConnectivity();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const {
    annualPackage,
    isPurchaseAvailable,
    isPurchaseInFlight,
    lifetimePackage,
    monthlyPackage,
    plusPriceLabel,
    presentCustomerCenter,
    presentPaywall,
    purchasePackage,
    restorePurchases,
    tier,
  } = useSubscription();

  const gradientColors: [string, string, string] = isDark
    ? [colors.background, colors.card, '#1A1A1A']
    : [colors.background, colors.surface, '#ECE2D7'];

  const handlePurchase = async (
    pkg: typeof monthlyPackage,
    successMessage: string
  ) => {
    if (!pkg || isPurchaseInFlight) {
      return;
    }

    const result = await purchasePackage(pkg);
    if (result.status === 'success') {
      Alert.alert(t('plus.upgradeSuccessTitle', 'Plus unlocked'), successMessage);
      return;
    }

    if (result.status === 'cancelled') {
      return;
    }

    Alert.alert(
      t('plus.upgradeUnavailableTitle', 'Plus unavailable'),
      result.message ??
        t(
          'plus.upgradeUnavailableMessage',
          'We could not complete the purchase right now. Please try again in a moment.'
        )
    );
  };

  const handlePresentPaywall = async () => {
    const result = await presentPaywall();
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      Alert.alert(
        t('plus.upgradeSuccessTitle', 'Plus unlocked'),
        t(
          'plus.upgradeSuccessMessage',
          'You can now save more photo notes and import images from your library.'
        )
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (isPurchaseInFlight) {
      return;
    }

    const result = await restorePurchases();
    if (result.status === 'success') {
      Alert.alert(
        t('plus.restoreSuccessTitle', 'Restored'),
        t('plus.restoreSuccessMessage', 'Plus is active on this device.')
      );
      return;
    }

    Alert.alert(
      t('plus.restoreFailedTitle', 'Restore failed'),
      result.message ??
        t('plus.restoreFailedMessage', "Couldn't restore purchases right now.")
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={[
          styles.content,
          {
            paddingTop: headerHeight + 12,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        contentContainerStyle={styles.contentContainer}
      >
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
          {!isOnline ? (
            <OfflineNotice
              title={t('plus.offlineTitle', 'Offline right now')}
              body={t('plus.offlineBody', 'Your last known plan is still visible, but purchases and restores need a connection.')}
            />
          ) : null}
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
              void handlePresentPaywall();
            }}
            loading={isPurchaseInFlight}
            variant="neutral"
            disabled={tier === 'plus' || !isPurchaseAvailable || !isOnline}
          />

          {monthlyPackage ? (
            <PrimaryButton
              label={`${t('plus.monthly', 'Monthly')} · ${monthlyPackage.product.priceString ?? monthlyPackage.identifier}`}
              onPress={() =>
                void handlePurchase(
                  monthlyPackage,
                  t(
                    'plus.upgradeSuccessMessage',
                    'You can now save more photo notes and import images from your library.'
                  )
                )
              }
              variant="secondary"
              disabled={isPurchaseInFlight || !isOnline}
            />
          ) : null}

          {annualPackage ? (
            <PrimaryButton
              label={`${t('plus.yearly', 'Yearly')} · ${annualPackage.product.priceString ?? annualPackage.identifier}`}
              onPress={() =>
                void handlePurchase(
                  annualPackage,
                  t(
                    'plus.upgradeSuccessMessage',
                    'You can now save more photo notes and import images from your library.'
                  )
                )
              }
              variant="secondary"
              disabled={isPurchaseInFlight || !isOnline}
            />
          ) : null}

          {lifetimePackage ? (
            <PrimaryButton
              label={`${t('plus.lifetime', 'Lifetime')} · ${lifetimePackage.product.priceString ?? lifetimePackage.identifier}`}
              onPress={() =>
                void handlePurchase(
                  lifetimePackage,
                  t(
                    'plus.upgradeSuccessMessage',
                    'You can now save more photo notes and import images from your library.'
                  )
                )
              }
              variant="secondary"
              disabled={isPurchaseInFlight || !isOnline}
            />
          ) : null}

          <PrimaryButton
            label={t('plus.restore', 'Restore purchases')}
            onPress={() => {
              void handleRestorePurchases();
            }}
            variant="secondary"
            disabled={isPurchaseInFlight || !isOnline}
          />

          {tier === 'plus' ? (
            <PrimaryButton
              label={t('plus.customerCenter', 'Manage subscription')}
              onPress={() => {
                void presentCustomerCenter();
              }}
              variant="secondary"
              disabled={isPurchaseInFlight || !isOnline}
            />
          ) : null}
        </View>
      </ScrollView>
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
  contentContainer: {
    gap: 24,
  },
  heroSection: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: Layout.cardRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    ...(Platform.OS === 'ios' ? Shadows.card : {}),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingBottom: 12,
  },
});
