import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
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
  compact?: boolean;
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
  compact,
  columnWidth,
}: {
  day: RecapCalendarDay;
  isSelected: boolean;
  palette: CalendarPalette;
  onSelectDay?: (dayKey: string) => void;
  compact: boolean;
  columnWidth?: number;
}) {
  const handlePress = useCallback(() => {
    if (day.dateKey) {
      onSelectDay?.(day.dateKey);
    }
  }, [day.dateKey, onSelectDay]);

  if (day.dayNumber === null) {
    return (
      <View
        style={[
          styles.dayPressable,
          compact ? styles.dayPressableCompact : null,
          columnWidth ? { width: columnWidth } : null,
        ]}
      >
        <View style={styles.emptySlot} />
      </View>
    );
  }

  const hasPhotoPreview = Boolean(day.photoPreviewUri);
  const isInteractive = Boolean(day.dateKey && day.count > 0 && !day.disabled);
  const haloAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(isSelected ? 1 : 0, { duration: 180 }),
      transform: [
        {
          scale: withSpring(isSelected ? 1 : 0.96, {
            damping: 18,
            mass: 0.7,
            stiffness: 220,
          }),
        },
      ],
    }),
    [isSelected]
  );
  const cardAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          scale: withSpring(isSelected ? 1.03 : 1, {
            damping: 18,
            mass: 0.7,
            stiffness: 220,
          }),
        },
      ],
      opacity: withTiming(day.count > 0 ? 1 : 0.86, { duration: 180 }),
    }),
    [day.count, isSelected]
  );

  return (
    <Pressable
      accessibilityRole={isInteractive ? 'button' : undefined}
      accessibilityLabel={day.accessibilityLabel}
      disabled={!isInteractive}
      onPress={isInteractive ? handlePress : undefined}
      style={({ pressed }) => [
        styles.dayPressable,
        compact ? styles.dayPressableCompact : null,
        columnWidth ? { width: columnWidth } : null,
        pressed && isInteractive ? styles.dayPressed : null,
      ]}
    >
      <View
        style={[
          styles.dayFrame,
        ]}
      >
        <Animated.View style={cardAnimatedStyle}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.daySelectionHalo,
              compact ? styles.daySelectionHaloCompact : null,
              { borderColor: palette.primary },
              haloAnimatedStyle,
            ]}
          />
          <View
            style={[
              styles.dayCard,
              compact ? styles.dayCardCompact : null,
              {
                backgroundColor: palette.card,
                borderColor: isSelected ? 'transparent' : `${palette.border}88`,
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
                      backgroundColor: 'rgba(24, 18, 14, 0.18)',
                    },
                  ]}
                />
              </>
            ) : null}
            <Text
              style={[
                styles.dayNumber,
                compact ? styles.dayNumberCompact : null,
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
            <View
              style={[
                styles.markerRow,
                compact ? styles.markerRowCompact : null,
                hasPhotoPreview ? styles.markerRowPhoto : null,
                hasPhotoPreview && compact ? styles.markerRowPhotoCompact : null,
              ]}
            >
              {!hasPhotoPreview
                ? day.markers.slice(0, 1).map((marker) => (
                    marker.type === 'polaroid' && marker.previewUri ? (
                      <View
                        key={marker.key}
                        style={[
                          styles.photoMarker,
                          compact ? styles.photoMarkerCompact : null,
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
                          compact ? styles.markerCompact : null,
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
                    compact ? styles.overflowBadgeCompact : null,
                    {
                      backgroundColor: hasPhotoPreview ? palette.card : palette.primarySoft,
                      borderColor: hasPhotoPreview ? `${palette.border}88` : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.overflowText,
                      compact ? styles.overflowTextCompact : null,
                      { color: hasPhotoPreview ? palette.text : palette.primary },
                    ]}
                  >
                    +{day.count - 1}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => (
  prevProps.day === nextProps.day &&
  prevProps.isSelected === nextProps.isSelected &&
  prevProps.palette === nextProps.palette &&
  prevProps.onSelectDay === nextProps.onSelectDay &&
  prevProps.compact === nextProps.compact &&
  prevProps.columnWidth === nextProps.columnWidth
));

function RecapCalendarGrid({
  days,
  weekDayLabels = DEFAULT_WEEKDAY_LABELS,
  selectedDayKey = null,
  onSelectDay,
  compact = false,
}: RecapCalendarGridProps) {
  const { colors } = useTheme();
  const [calendarWidth, setCalendarWidth] = useState(0);
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
  const measuredCompact = calendarWidth > 0 ? calendarWidth / 7 < 48 : false;
  const isCompact = compact || measuredCompact;
  const columnWidth = calendarWidth > 0 ? calendarWidth / 7 : undefined;
  const handleCalendarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setCalendarWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  return (
    <View style={[styles.section, isCompact ? styles.sectionCompact : null]} onLayout={handleCalendarLayout}>
      <View style={styles.weekRow}>
        {weekDayLabels.map((label, index) => (
          <View
            key={`${label}:${index}`}
            style={[
              styles.weekCell,
              isCompact ? styles.weekCellCompact : null,
              columnWidth ? { width: columnWidth } : null,
            ]}
          >
            <Text
              style={[styles.weekLabel, isCompact ? styles.weekLabelCompact : null, { color: palette.secondaryText }]}
            >
              {label}
            </Text>
          </View>
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
            compact={isCompact}
            columnWidth={columnWidth}
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
  sectionCompact: {
    gap: 10,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    width: '14.2857%',
    paddingHorizontal: 2.5,
  },
  weekCellCompact: {
    paddingHorizontal: 1,
  },
  weekLabel: {
    ...Typography.pill,
    fontSize: 12,
    width: '100%',
    textAlign: 'left',
    paddingLeft: 8,
  },
  weekLabelCompact: {
    fontSize: 11,
    paddingLeft: 6,
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
  dayPressableCompact: {
    paddingHorizontal: 1,
    marginBottom: 4,
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
  dayCardCompact: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 4,
  },
  dayFrame: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  daySelectionHalo: {
    position: 'absolute',
    top: -2.5,
    right: -2.5,
    bottom: -2.5,
    left: -2.5,
    borderRadius: 23.5,
    borderWidth: 2.5,
  },
  daySelectionHaloCompact: {
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderRadius: 20,
    borderWidth: 2,
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
    width: '100%',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    textAlign: 'left',
    zIndex: 1,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dayNumberCompact: {
    fontSize: 14,
    lineHeight: 16,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 12,
    zIndex: 1,
  },
  markerRowCompact: {
    gap: 3,
    minHeight: 10,
  },
  markerRowPhoto: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    left: 6,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  markerRowPhotoCompact: {
    right: 4,
    bottom: 4,
    left: 4,
  },
  marker: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  markerCompact: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
  photoMarkerCompact: {
    width: 15,
    height: 15,
    borderRadius: 7,
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  overflowBadgeCompact: {
    minWidth: 20,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
  },
  overflowText: {
    ...Typography.pill,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  overflowTextCompact: {
    fontSize: 9,
    lineHeight: 10,
  },
});
