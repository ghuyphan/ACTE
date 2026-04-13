import type { TFunction } from 'i18next';

export type AppTabKey = 'index' | 'search' | 'map' | 'settings';

export function getAppTabDefinitions(t: TFunction) {
  return [
    {
      key: 'index',
      label: t('tabs.home', 'Home'),
      title: t('tabs.home', 'Home'),
      accessibilityLabel: t('tabs.home', 'Home'),
      android: {
        icon: {
          default: 'home-outline',
          selected: 'home',
        },
      },
      ios: {
        icon: {
          default: 'house',
          selected: 'house.fill',
        },
      },
    },
    {
      key: 'search',
      label: t('tabs.search', 'Search'),
      title: t('tabs.search', 'Search'),
      accessibilityLabel: t('tabs.search', 'Search'),
      android: {
        variant: 'search',
        icon: {
          default: 'search-outline',
          selected: 'search',
        },
      },
      ios: {
        role: 'search',
      },
    },
    {
      key: 'map',
      label: t('tabs.map', 'Map'),
      title: t('tabs.map', 'Map'),
      accessibilityLabel: t('tabs.map', 'Map'),
      android: {
        icon: {
          default: 'map-outline',
          selected: 'map',
        },
      },
      ios: {
        icon: {
          default: 'map',
          selected: 'map.fill',
        },
      },
    },
    {
      key: 'settings',
      label: t('tabs.settings', 'Settings'),
      title: t('tabs.settings', 'Settings'),
      accessibilityLabel: t('tabs.settings', 'Settings'),
      android: {
        icon: {
          default: 'settings-outline',
          selected: 'settings',
        },
      },
      ios: {
        icon: {
          default: 'gearshape',
          selected: 'gearshape.fill',
        },
      },
    },
  ] as const;
}

export type AppTabDefinition = ReturnType<typeof getAppTabDefinitions>[number];
