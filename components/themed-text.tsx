import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? [styles.link, { color: '#FFB800' }] : undefined, // Quick fallback if colors.primary isn't accessible, though it should be. Let's assume it's hard to inject useTheme here because useThemeColor handles color. Let's actually just hardcode the ACTE primary color for link as a safe bet for a "themed" text component, or better yet, inject useTheme since it's a component. Wait, I can just use the exact colors.primary value here: #FFB800
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'System',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'System',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    fontFamily: 'System',
  },
});
