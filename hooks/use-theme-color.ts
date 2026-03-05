/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '../hooks/useTheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme as keyof typeof props];
  if (colorFromProps) {
    return colorFromProps as string;
  } else {
    return theme === 'light' ? Colors.light[colorName as keyof typeof Colors.light] as string : Colors.dark[colorName as keyof typeof Colors.dark] as string;
  }
}
