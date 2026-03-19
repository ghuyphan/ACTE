import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayoutAndroid() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.tabBarBg}
      tintColor={colors.primary}
      iconColor={{ default: colors.secondaryText, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.secondaryText },
        selected: { color: colors.primary },
      }}
      backBehavior="history"
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon md="home" />
        <NativeTabs.Trigger.Label>{t('tabs.home', 'Home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon md="map" />
        <NativeTabs.Trigger.Label>{t('tabs.map', 'Map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon md="settings" />
        <NativeTabs.Trigger.Label>{t('tabs.settings', 'Settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {Platform.OS === 'android' ? null : (
        <NativeTabs.Trigger name="search" />
      )}
    </NativeTabs>
  );
}
