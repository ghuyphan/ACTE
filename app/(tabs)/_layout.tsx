import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { DynamicColorIOS, Platform } from 'react-native';
import { ENABLE_SHARED_ROOMS } from '../../constants/features';
import { Colors, useTheme } from '../../hooks/useTheme';
import { isIOS26OrNewer, isOlderIOS } from '../../utils/platform';

export default function TabLayout() {
  const { t } = useTranslation();
  // isDark is no longer strictly needed for the tab bar styling here
  const { colors } = useTheme();

  const dynamicPrimary = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: Colors.light.primary, dark: Colors.dark.primary })
    : colors.primary;

  const dynamicSecondaryText = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: Colors.light.secondaryText, dark: Colors.dark.secondaryText })
    : colors.secondaryText;

  const dynamicTabBarBg = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: Colors.light.tabBarBg, dark: Colors.dark.tabBarBg })
    : colors.tabBarBg;

  return (
    <NativeTabs
      // 'systemChromeMaterial' natively adapts to light/dark mode automatically on iOS
      blurEffect={Platform.OS === 'ios' ? (isOlderIOS ? (colors === Colors.dark ? 'dark' : 'light') : 'systemChromeMaterial') : undefined}
      backgroundColor={dynamicTabBarBg}
      tintColor={dynamicPrimary}
      iconColor={{ default: dynamicSecondaryText, selected: dynamicPrimary }}
      labelStyle={{
        default: { color: dynamicSecondaryText },
        selected: { color: dynamicPrimary },
      }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.home', 'Home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {ENABLE_SHARED_ROOMS ? (
        <NativeTabs.Trigger name="rooms">
          <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} />
          <NativeTabs.Trigger.Label>{t('tabs.rooms', 'Rooms')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.map', 'Map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.settings', 'Settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {isIOS26OrNewer ? (
        <NativeTabs.Trigger name="search" role="search" disableAutomaticContentInsets />
      ) : null}
    </NativeTabs>
  );
}
