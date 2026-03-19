import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayoutAndroid() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const barBackground = isDark ? '#19130E' : '#EDE3D6';
  const indicatorColor = isDark ? 'rgba(255, 193, 7, 0.26)' : '#F4DEAE';
  const activeColor = isDark ? '#FFF7E8' : '#5F4300';
  const inactiveColor = isDark ? 'rgba(255, 247, 232, 0.68)' : '#817466';

  return (
    <NativeTabs
      backgroundColor={barBackground}
      indicatorColor={indicatorColor}
      iconColor={{ default: inactiveColor, selected: activeColor }}
      labelStyle={{
        default: { color: inactiveColor },
        selected: { color: activeColor },
      }}
      rippleColor={colors.primarySoft}
      labelVisibilityMode="labeled"
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
