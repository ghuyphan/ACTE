import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <NativeTabs
      blurEffect={isDark ? 'systemMaterialDark' : 'systemMaterialLight'}
      backgroundColor={colors.tabBarBg}
      tintColor={colors.primary}
      iconColor={{ default: colors.secondaryText, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.secondaryText },
        selected: { color: colors.primary },
      }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.home', 'Home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.map', 'Map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.settings', 'Settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
