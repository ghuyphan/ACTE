import React, { memo, useCallback, useMemo } from 'react';
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
  dateKey?: string;
  dayNumber: number | null;
  count: number;
  markers: RecapCalendarDayMarker[];
  photoPreviewUri?: string;
  disabled?: boolean;
  isToday?: boolean;
  accessibilityLabel?: string;
}

interface RecapCalendarGridProps {
  days: RecapCalendarDay[];
  weekDayLabels?: string[];
  selectedDayKey?: string | null;
  onSelectDay?: (dayKey: string) => void;
}

const DEFAULT_WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type CalendarPalette = {
  card: string;
  border: string;
  primary: string;
  primarySoft: string;
  secondaryText: string;
  text: string;
};

const RecapCalendarDayCell = memo(function RecapCalendarDayCell({
  day,
  isSelected,
  palette,
  onSelectDay,
}: {
  day: RecapCalendarDay;
  isSelected: boolean;
  palette: CalendarPalette;
  onSelectDay?: (dayKey: string) => void;
}) {
  const handlePress = useCallback(() => {
    if (day.dateKey) {
      onSelectDay?.(day.dateKey);
    }
  }, [day.dateKey, onSelectDay]);

  if (day.dayNumber === null) {
    return (
      <View style={styles.dayPressable}>
        <View style={styles.emptySlot} />
      </View>
    );
  }

  const hasPhotoPreview = Boolean(day.photoPreviewUri);
  const isInteractive = Boolean(day.dateKey && day.count > 0 && !day.disabled);

  return (
    <Pressable
      accessibilityRole={isInteractive ? 'button' : undefined}
      accessibilityLabel={day.accessibilityLabel}
      disabled={!isInteractive}
      onPress={isInteractive ? handlePress : undefined}
      style={({ pressed }) => [
        styles.dayPressable,
        pressed && isInteractive ? styles.dayPressed : null,
      ]}
    >
      <View
        style={[
          styles.dayCard,
          {
            backgroundColor: hasPhotoPreview ? palette.card : isSelected ? palette.primarySoft : palette.card,
            borderColor: isSelected ? `${palette.primary}22` : `${palette.border}88`,
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
                  backgroundColor: isSelected
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
                : isSelected
                  ? palette.primary
                  : palette.text,
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
                        borderColor: isSelected ? palette.primary : `${palette.border}AA`,
                        backgroundColor: palette.card,
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
                  backgroundColor: hasPhotoPreview ? 'rgba(255,255,255,0.9)' : palette.primarySoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.overflowText,
                  { color: hasPhotoPreview ? palette.text : palette.primary },
                ]}
              >
                +{day.count - 1}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => (
  prevProps.day === nextProps.day &&
  prevProps.isSelected === nextProps.isSelected &&
  prevProps.palette === nextProps.palette &&
  prevProps.onSelectDay === nextProps.onSelectDay
));

function RecapCalendarGrid({
  days,
  weekDayLabels = DEFAULT_WEEKDAY_LABELS,
  selectedDayKey = null,
  onSelectDay,
}: RecapCalendarGridProps) {
  const { colors } = useTheme();
  const palette = useMemo<CalendarPalette>(
    () => ({
      card: colors.card,
      border: colors.border,
      primary: colors.primary,
      primarySoft: colors.primarySoft,
      secondaryText: colors.secondaryText,
      text: colors.text,
    }),
    [colors.border, colors.card, colors.primary, colors.primarySoft, colors.secondaryText, colors.text]
  );

  return (
    <View style={styles.section}>
      <View style={styles.weekRow}>
        {weekDayLabels.map((label, index) => (
          <Text key={`${label}:${index}`} style={[styles.weekLabel, { color: palette.secondaryText }]}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => (
          <RecapCalendarDayCell
            key={day.key}
            day={day}
            isSelected={Boolean(day.dateKey && day.dateKey === selectedDayKey)}
            palette={palette}
            onSelectDay={onSelectDay}
          />
        ))}
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
