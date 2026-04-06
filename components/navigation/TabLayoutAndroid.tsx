import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayoutAndroid() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const barBackground = colors.tabBarBg;
  const indicatorColor = isDark ? 'rgba(255, 247, 232, 0.12)' : 'rgba(255, 252, 247, 0.96)';
  const activeColor = isDark ? colors.primary : colors.accent;
  const inactiveColor = colors.secondaryText;
  const shadowColor = isDark ? 'rgba(0,0,0,0)' : 'rgba(108, 84, 36, 0.08)';

  return (
    <NativeTabs
      backgroundColor={barBackground}
      indicatorColor={indicatorColor}
      shadowColor={shadowColor}
      iconColor={{ default: inactiveColor, selected: activeColor }}
      labelStyle={{
        default: { color: inactiveColor, fontSize: 11, fontWeight: '600' },
        selected: { color: activeColor, fontSize: 11, fontWeight: '700' },
      }}
      rippleColor={isDark ? 'rgba(255, 247, 232, 0.16)' : `${colors.primary}12`}
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
