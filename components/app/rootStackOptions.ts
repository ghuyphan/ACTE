import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ThemeColors } from '../../hooks/useTheme';

function createBackButtonOptions(colors: ThemeColors): NativeStackNavigationOptions {
  return {
    headerTintColor: colors.text,
    headerBackButtonDisplayMode: 'minimal',
    headerBackButtonMenuEnabled: false,
  };
}

export function createTransparentBackScreenOptions(
  colors: ThemeColors,
  options: {
    title?: string;
    backTitle: string;
  }
): NativeStackNavigationOptions {
  return {
    headerShown: true,
    headerTransparent: true,
    headerTitle: options.title ?? '',
    headerBackTitle: options.backTitle,
    ...createBackButtonOptions(colors),
  };
}

export function createSolidBackScreenOptions(
  colors: ThemeColors,
  options: {
    title: string;
    backTitle?: string;
  }
): NativeStackNavigationOptions {
  return {
    headerShown: true,
    headerTransparent: false,
    headerShadowVisible: false,
    title: options.title,
    headerStyle: {
      backgroundColor: colors.background,
    },
    ...(options.backTitle ? { headerBackTitle: options.backTitle } : null),
    ...createBackButtonOptions(colors),
  };
}
