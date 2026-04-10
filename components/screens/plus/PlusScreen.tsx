import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { showAppAlert } from '../../../utils/alert';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OfflineNotice from '../../ui/OfflineNotice';
import PrimaryButton from '../../ui/PrimaryButton';
import { Layout, Typography } from '../../../constants/theme';
import { useConnectivity } from '../../../hooks/useConnectivity';
import { useSubscription } from '../../../hooks/useSubscription';
import { useTheme } from '../../../hooks/useTheme';

const APP_ICON_LIGHT_SOURCE = require('../../../assets/images/icon/icon-default.png');
const APP_ICON_DARK_SOURCE = require('../../../assets/images/icon/icon-dark.png');

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
    isPurchaseAvailable,
    isPurchaseInFlight,
    presentCustomerCenter,
    presentPaywall,
    restorePurchases,
    tier,
  } = useSubscription();

  const gradientColors: [string, string, string] = isDark
    ? [colors.background, colors.card, '#1A1A1A']
    : [colors.background, colors.surface, '#ECE2D7'];
  const appIconSource = isDark ? APP_ICON_DARK_SOURCE : APP_ICON_LIGHT_SOURCE;

  const handlePresentPaywall = async () => {
    const result = await presentPaywall();
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      showAppAlert(
        t('plus.upgradeSuccessTitle', 'Plus unlocked'),
        t(
          'plus.upgradeSuccessMessage',
          'You can now use premium photo filters, save unlimited photo notes, and unlock the premium finishes too.'
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
      showAppAlert(
        t('plus.restoreSuccessTitle', 'Restored'),
        t('plus.restoreSuccessMessage', 'Plus is active on this device.')
      );
      return;
    }

    showAppAlert(
      t('plus.restoreFailedTitle', 'Restore failed'),
      result.message ??
        t('plus.restoreFailedMessage', "Couldn't restore purchases right now.")
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + 12,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Image source={appIconSource} style={styles.appIcon} />
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('auth.title', 'Noto')}
            </Text>
            <Text style={[styles.plusBadge, { color: colors.primary }]}>
              {t('plus.badge', 'Plus')}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('plus.subtitle', 'More room for your photo memories.')}
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
            title={t('plus.features.unlimitedTitle', 'Unlimited photo memories')}
            description={t(
              'plus.features.unlimitedDesc',
              'Free includes 10 photo notes. Plus removes the cap so your visual journal can keep growing.'
            )}
          />
          <FeatureRow
            icon="color-filter-outline"
            title={t('plus.features.filterTitle', 'Premium photo filters')}
            description={t(
              'plus.features.filterDesc',
              'Unlock warm, cool, mono, vivid, and vintage looks when you want the photo to carry more mood.'
            )}
          />
          <FeatureRow
            icon="sparkles"
            title={t('plus.features.colorTitle', 'Premium card styles')}
            description={t(
              'plus.features.colorDesc',
              'Unlock interactive hologram cards plus RGB and foil-inspired finishes for a more expressive journal.'
            )}
          />
        </View>

        <View style={styles.footerActions}>
          <PrimaryButton
            label={
              tier === 'plus'
                ? t('settings.plusActive', 'Plus Active')
                : !isPurchaseAvailable
                ? t('settings.plusUnavailable', 'Coming Soon')
                : t('plus.cta', 'Get Noto Plus')
            }
            onPress={() => {
              if (tier === 'plus' || !isPurchaseAvailable || isPurchaseInFlight) return;
              void handlePresentPaywall();
            }}
            loading={isPurchaseInFlight}
            variant="neutral"
            disabled={tier === 'plus' || !isPurchaseAvailable || !isOnline}
          />

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
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Layout.screenPadding + 12,
    gap: 24,
  },
  heroSection: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    overflow: 'hidden',
    marginBottom: 32,
  },
  appIcon: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
