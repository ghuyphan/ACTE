import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import InfoPill from '../../ui/InfoPill';
import { Layout, Radii, Shadows, Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

export interface RecapHeaderStat {
  label: string;
  value: string;
}

interface RecapHeaderCardProps {
  title: string;
  subtitle?: string;
  heroTitle: string;
  heroSubtitle?: string;
  stats: RecapHeaderStat[];
  accentGradient?: [string, string];
  badgeLabel?: string;
}

function RecapHeaderCard({
  title,
  subtitle,
  heroTitle,
  heroSubtitle,
  stats,
  accentGradient,
  badgeLabel,
}: RecapHeaderCardProps) {
  const { colors, isDark } = useTheme();
  const gradient = accentGradient ?? (isDark ? ['#2C2621', '#1F1B18'] : [colors.card, colors.surface]);

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={[styles.glow, { backgroundColor: colors.primarySoft }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.secondaryText }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {badgeLabel ? (
            <InfoPill style={styles.chip}>
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {badgeLabel}
              </Text>
            </InfoPill>
          ) : null}
        </View>

        <View style={styles.heroArea}>
          <View style={[styles.postcardBack, { backgroundColor: colors.card, borderColor: colors.border }]} />
          <View style={[styles.postcardMid, { backgroundColor: colors.card, borderColor: colors.border }]} />
          <View style={[styles.postcardFront, { backgroundColor: colors.primarySoft, borderColor: colors.border }]} />
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
              {heroTitle}
            </Text>
            {heroSubtitle ? (
              <Text style={[styles.heroSubtitle, { color: colors.secondaryText }]} numberOfLines={2}>
                {heroSubtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {stats.length > 0 ? (
          <View style={styles.statsRow}>
            {stats.slice(0, 3).map((stat) => (
              <View key={`${stat.label}:${stat.value}`} style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondaryText }]} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export default memo(RecapHeaderCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.xl,
    overflow: 'hidden',
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    ...Shadows.card,
  },
  glow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.45,
  },
  content: {
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.screenTitle,
    fontSize: 18,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    ...Typography.pill,
    fontSize: 13,
  },
  heroArea: {
    minHeight: 126,
    justifyContent: 'center',
  },
  postcardBack: {
    position: 'absolute',
    width: '82%',
    height: 112,
    borderRadius: Layout.cardRadius - 10,
    borderWidth: StyleSheet.hairlineWidth,
    left: 14,
    top: 8,
    opacity: 0.45,
  },
  postcardMid: {
    position: 'absolute',
    width: '88%',
    height: 116,
    borderRadius: Layout.cardRadius - 8,
    borderWidth: StyleSheet.hairlineWidth,
    left: 8,
    top: 4,
    opacity: 0.72,
  },
  postcardFront: {
    width: '94%',
    height: 120,
    borderRadius: Layout.cardRadius - 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
  heroTextWrap: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 22,
    bottom: 22,
    justifyContent: 'center',
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  heroSubtitle: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 240,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 66,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  statLabel: {
    ...Typography.pill,
    fontSize: 12,
    marginTop: 2,
  },
});
