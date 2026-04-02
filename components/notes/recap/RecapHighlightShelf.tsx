import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Radii, Shadows, Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

export type RecapHighlightKind = 'postcard' | 'polaroid';

export interface RecapHighlightItem {
  key: string;
  kind: RecapHighlightKind;
  title: string;
  subtitle?: string;
  accentColor?: string;
  countLabel?: string;
  onPress?: () => void;
}

interface RecapHighlightShelfProps {
  title?: string;
  items: RecapHighlightItem[];
  postcardLabel?: string;
  polaroidLabel?: string;
}

function RecapHighlightShelf({
  title = 'Highlights',
  items,
  postcardLabel = 'Postcard',
  polaroidLabel = 'Polaroid',
}: RecapHighlightShelfProps) {
  const { colors, isDark } = useTheme();
  const baseGradient: [string, string] = isDark ? ['#2A2522', '#1F1B19'] : [colors.card, colors.surface];

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole={item.onPress ? 'button' : undefined}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.cardWrap,
              pressed && item.onPress ? styles.cardPressed : null,
            ]}
          >
            <LinearGradient
              colors={item.accentColor ? [item.accentColor, baseGradient[1]] : baseGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                {
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.kindBadge,
                    { backgroundColor: item.kind === 'postcard' ? colors.primarySoft : 'rgba(255,255,255,0.18)' },
                  ]}
                >
                  <Text style={[styles.kindText, { color: colors.primary }]} numberOfLines={1}>
                    {item.kind === 'postcard' ? postcardLabel : polaroidLabel}
                  </Text>
                </View>
                {item.countLabel ? (
                  <Text style={[styles.countLabel, { color: colors.secondaryText }]} numberOfLines={1}>
                    {item.countLabel}
                  </Text>
                ) : null}
              </View>

              <View style={styles.textBlock}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.secondaryText }]} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              <View style={styles.footer} pointerEvents="none">
                <View style={[styles.footerStamp, { backgroundColor: colors.primarySoft }]} />
                <View style={[styles.footerStampSmall, { backgroundColor: item.accentColor ?? colors.primary }]} />
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(RecapHighlightShelf);

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...Typography.screenTitle,
    fontSize: 18,
  },
  row: {
    gap: 12,
    paddingRight: 2,
  },
  cardWrap: {
    width: 158,
    minWidth: 150,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  card: {
    minHeight: 176,
    borderRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindText: {
    ...Typography.pill,
    fontSize: 12,
  },
  countLabel: {
    ...Typography.pill,
    fontSize: 12,
  },
  textBlock: {
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Typography.body,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  subtitle: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerStamp: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  footerStampSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
