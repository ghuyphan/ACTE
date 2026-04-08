import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AndroidFloatingTabBar from './AndroidFloatingTabBar';
import { useTheme } from '../../hooks/useTheme';

type AndroidTabRouteKey = 'index' | 'search' | 'map' | 'settings';

type AndroidTabConfig = {
  key: AndroidTabRouteKey;
  label: string;
  title: string;
  accessibilityLabel: string;
  variant?: 'pill' | 'search';
  icon: {
    default: keyof typeof Ionicons.glyphMap;
    selected: keyof typeof Ionicons.glyphMap;
  };
};

export default function TabLayoutAndroid() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const tabs: AndroidTabConfig[] = [
    {
      key: 'index',
      label: t('tabs.home', 'Home'),
      title: t('tabs.home', 'Home'),
      accessibilityLabel: t('tabs.home', 'Home'),
      icon: {
        default: 'home-outline',
        selected: 'home',
      },
    },
    {
      key: 'search',
      label: t('tabs.search', 'Search'),
      title: t('tabs.search', 'Search'),
      accessibilityLabel: t('tabs.search', 'Search'),
      variant: 'search',
      icon: {
        default: 'search-outline',
        selected: 'search',
      },
    },
    {
      key: 'map',
      label: t('tabs.map', 'Map'),
      title: t('tabs.map', 'Map'),
      accessibilityLabel: t('tabs.map', 'Map'),
      icon: {
        default: 'map-outline',
        selected: 'map',
      },
    },
    {
      key: 'settings',
      label: t('tabs.settings', 'Settings'),
      title: t('tabs.settings', 'Settings'),
      accessibilityLabel: t('tabs.settings', 'Settings'),
      icon: {
        default: 'settings-outline',
        selected: 'settings',
      },
    },
  ];

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
      tabBar={(props) => <AndroidFloatingTabBar {...props} />}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.key}
          options={{
            title: tab.title,
            tabBarLabel: tab.label,
            tabBarAccessibilityLabel: tab.accessibilityLabel,
            tabBarButtonTestID: tab.variant === 'search' ? 'android-tab-search-button' : undefined,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                color={color}
                name={focused ? tab.icon.selected : tab.icon.default}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
