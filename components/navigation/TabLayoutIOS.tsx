import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isIOS26OrNewer, isOlderIOS } from '../../utils/platform';
import { getAppTabDefinitions } from './tabConfig';

export default function TabLayoutIOS() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const tabs = getAppTabDefinitions(t);
  const homeTab = tabs.find((tab) => tab.key === 'index');
  const mapTab = tabs.find((tab) => tab.key === 'map');
  const settingsTab = tabs.find((tab) => tab.key === 'settings');
  const searchTab = tabs.find((tab) => tab.key === 'search');

  return (
    <NativeTabs
      blurEffect={
        Platform.OS === 'ios'
          ? isOlderIOS
            ? isDark
              ? 'dark'
              : 'light'
            : 'systemChromeMaterial'
          : undefined
      }
      backgroundColor={colors.tabBarBg}
      tintColor={colors.primary}
      iconColor={{ default: colors.secondaryText, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.secondaryText },
        selected: { color: colors.primary },
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
