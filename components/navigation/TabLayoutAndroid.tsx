import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AndroidFloatingTabBar from './AndroidFloatingTabBar';
import { getAppTabDefinitions } from './tabConfig';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayoutAndroid() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tabs = getAppTabDefinitions(t);

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
            tabBarButtonTestID:
              'variant' in tab.android && tab.android.variant === 'search'
                ? 'android-tab-search-button'
                : undefined,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                color={color}
                name={focused ? tab.android.icon.selected : tab.android.icon.default}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
