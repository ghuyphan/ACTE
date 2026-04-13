import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { DynamicColorIOS, Platform } from 'react-native';
import { Colors, useTheme } from '../../hooks/useTheme';
import { isIOS26OrNewer, isOlderIOS } from '../../utils/platform';
import { getAppTabDefinitions } from './tabConfig';

export default function TabLayoutIOS() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tabs = getAppTabDefinitions(t);
  const homeTab = tabs.find((tab) => tab.key === 'index');
  const mapTab = tabs.find((tab) => tab.key === 'map');
  const settingsTab = tabs.find((tab) => tab.key === 'settings');
  const searchTab = tabs.find((tab) => tab.key === 'search');

  const dynamicPrimary =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: Colors.light.primary, dark: Colors.dark.primary })
      : colors.primary;

  const dynamicSecondaryText =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          light: Colors.light.secondaryText,
          dark: Colors.dark.secondaryText,
        })
      : colors.secondaryText;

  const dynamicTabBarBg =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: Colors.light.tabBarBg, dark: Colors.dark.tabBarBg })
      : colors.tabBarBg;

  return (
    <NativeTabs
      blurEffect={
        Platform.OS === 'ios'
          ? isOlderIOS
            ? colors === Colors.dark
              ? 'dark'
              : 'light'
            : 'systemChromeMaterial'
          : undefined
      }
      backgroundColor={dynamicTabBarBg}
      tintColor={dynamicPrimary}
      iconColor={{ default: dynamicSecondaryText, selected: dynamicPrimary }}
      labelStyle={{
        default: { color: dynamicSecondaryText },
        selected: { color: dynamicPrimary },
      }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={homeTab?.ios.icon ?? { default: 'house', selected: 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>{homeTab?.label ?? t('tabs.home', 'Home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="map"
        disableAutomaticContentInsets
        disableTransparentOnScrollEdge
        unstable_nativeProps={{
          overrideScrollViewContentInsetAdjustmentBehavior: false,
          scrollEdgeEffects: {
            top: 'hidden',
            right: 'hidden',
            bottom: 'hidden',
            left: 'hidden',
          },
        }}
      >
        <NativeTabs.Trigger.Icon
          sf={mapTab?.ios.icon ?? { default: 'map', selected: 'map.fill' }}
        />
        <NativeTabs.Trigger.Label>{mapTab?.label ?? t('tabs.map', 'Map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={settingsTab?.ios.icon ?? { default: 'gearshape', selected: 'gearshape.fill' }}
        />
        <NativeTabs.Trigger.Label>
          {settingsTab?.label ?? t('tabs.settings', 'Settings')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Keep the search route registered so NativeTabs rehydration sees a stable route list. */}
      <NativeTabs.Trigger
        name="search"
        hidden={!isIOS26OrNewer}
        role={isIOS26OrNewer ? searchTab?.ios.role : undefined}
        disableAutomaticContentInsets
      />
    </NativeTabs>
  );
}
