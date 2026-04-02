import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

export interface RecapCalendarDayMarker {
  key: string;
  color: string;
  type?: 'stamp' | 'polaroid';
  previewUri?: string;
}

export interface RecapCalendarDay {
  key: string;
  dayNumber: number | null;
  count: number;
  markers: RecapCalendarDayMarker[];
  photoPreviewUri?: string;
  disabled?: boolean;
  isToday?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

interface RecapCalendarGridProps {
  days: RecapCalendarDay[];
  weekDayLabels?: string[];
}

const DEFAULT_WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function RecapCalendarGrid({ days, weekDayLabels = DEFAULT_WEEKDAY_LABELS }: RecapCalendarGridProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.weekRow}>
        {weekDayLabels.map((label, index) => (
          <Text key={`${label}:${index}`} style={[styles.weekLabel, { color: colors.secondaryText }]}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          if (day.dayNumber === null) {
            return (
              <View key={day.key} style={styles.dayPressable}>
                <View style={styles.emptySlot} />
              </View>
            );
          }

          const hasPhotoPreview = Boolean(day.photoPreviewUri);
          const content = (
            <View
              style={[
                styles.dayCard,
                {
                  backgroundColor: hasPhotoPreview ? colors.card : day.isSelected ? colors.primarySoft : colors.card,
                  borderColor: day.isSelected ? `${colors.primary}22` : `${colors.border}88`,
                },
              ]}
            >
              {hasPhotoPreview ? (
                <>
                  <Image
                    source={{ uri: day.photoPreviewUri }}
                    style={styles.dayPhotoFill}
                    contentFit="cover"
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.dayPhotoOverlay,
                      {
                        backgroundColor: day.isSelected
                          ? 'rgba(255, 243, 205, 0.28)'
                          : 'rgba(24, 18, 14, 0.22)',
                      },
                    ]}
                  />
                </>
              ) : null}
              <Text
                style={[
                  styles.dayNumber,
                  {
                    color: hasPhotoPreview
                      ? '#FFFFFF'
                      : day.isSelected
                        ? colors.primary
                        : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {day.dayNumber}
              </Text>
              <View style={styles.markerRow}>
                {!hasPhotoPreview
                  ? day.markers.slice(0, 1).map((marker) => (
                      marker.type === 'polaroid' && marker.previewUri ? (
                        <View
                          key={marker.key}
                          style={[
                            styles.photoMarker,
                            {
                              borderColor: day.isSelected ? colors.primary : `${colors.border}AA`,
                              backgroundColor: colors.card,
                            },
                          ]}
                        >
                          <Image
                            source={{ uri: marker.previewUri }}
                            style={styles.photoMarkerImage}
                            contentFit="cover"
                          />
                        </View>
                      ) : (
                        <View
                          key={marker.key}
                          style={[
                            styles.marker,
                            {
                              backgroundColor: marker.color,
                              borderColor: marker.color,
                            },
                          ]}
                        />
                      )
                    ))
                  : null}
                {day.count > 1 ? (
                  <View
                    style={[
                      styles.overflowBadge,
                      {
                        backgroundColor: hasPhotoPreview ? 'rgba(255,255,255,0.9)' : colors.primarySoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.overflowText,
                        { color: hasPhotoPreview ? colors.text : colors.primary },
                      ]}
                    >
                      +{day.count - 1}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );

          return (
            <Pressable
              key={day.key}
              accessibilityRole={day.onPress ? 'button' : undefined}
              accessibilityLabel={day.accessibilityLabel}
              disabled={day.disabled || !day.onPress}
              onPress={day.onPress}
              style={({ pressed }) => [
                styles.dayPressable,
                pressed && day.onPress && !day.disabled ? styles.dayPressed : null,
              ]}
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default memo(RecapCalendarGrid);

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  weekLabel: {
    ...Typography.pill,
    fontSize: 12,
    width: '14.2857%',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayPressable: {
    width: '14.2857%',
    paddingHorizontal: 2.5,
    marginBottom: 8,
  },
  dayPressed: {
    transform: [{ scale: 0.975 }],
  },
  dayCard: {
    minHeight: 56,
    borderRadius: 21,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 6,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  emptySlot: {
    minHeight: 56,
  },
  dayPhotoFill: {
    ...StyleSheet.absoluteFillObject,
  },
  dayPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    zIndex: 1,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 12,
    zIndex: 1,
  },
  marker: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoMarker: {
    width: 18,
    height: 18,
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 1,
  },
  photoMarkerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  overflowBadge: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  overflowText: {
    ...Typography.pill,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
});
