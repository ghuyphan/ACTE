import { Ionicons } from '@expo/vector-icons';
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
  photoPreviewUris?: string[];
  photoCount?: number;
  textCount?: number;
  disabled?: boolean;
  isToday?: boolean;
  accessibilityLabel?: string;
}

interface RecapCalendarGridProps {
  days: RecapCalendarDay[];
  weekDayLabels?: string[];
  selectedDayKeys?: string[];
  onSelectDay?: (dayKey: string) => void;
  compact?: boolean;
}

const DEFAULT_WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const COMPACT_COLUMN_WIDTH = 56;
const PHOTO_FRAME_BORDER_COLOR = '#FFFFFF';
const PHOTO_BACKING_COLOR = '#FFF7EA';

const mergeStyles = (...styles: any[]) => styles;

function formatOverflowCount(count: number) {
  if (count <= 0) {
    return null;
  }

  return count > 99 ? '99+' : `+${count}`;
}

type CalendarPalette = {
  accent: string;
  card: string;
  border: string;
  primary: string;
  primarySoft: string;
  secondaryText: string;
  surface: string;
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

  const photoPreviewUris = day.photoPreviewUris?.filter(Boolean) ?? [];
  const primaryPhotoUri = photoPreviewUris[0] ?? day.photoPreviewUri;
  const photoCount = day.photoCount ?? (primaryPhotoUri ? 1 : 0);
  const textCount = day.textCount ?? Math.max(day.count - photoCount, 0);
  const hasPhotoPreview = Boolean(primaryPhotoUri);
  const hasTextContent = textCount > 0;
  const isTextOnlyDay = !hasPhotoPreview && hasTextContent;
  const isEmptyDay = day.count === 0;
  const isInteractive = Boolean(day.dateKey && day.count > 0 && !day.disabled);
  const visiblePhotoPreviewCount = Math.min(photoPreviewUris.length || (primaryPhotoUri ? 1 : 0), 2);
  const visibleContentCount = hasPhotoPreview
    ? visiblePhotoPreviewCount
    : hasTextContent
      ? 1
      : Math.min(day.markers.length, 1);
  const overflowCount = Math.max(day.count - visibleContentCount, 0);
  const overflowLabel = formatOverflowCount(overflowCount);
  const contentMode = isEmptyDay
    ? 'empty'
    : hasPhotoPreview
      ? 'photo'
      : isTextOnlyDay
        ? 'text'
        : 'marker';
  const isPhotoMode = contentMode === 'photo';
  const floatingOverflowBadge =
    overflowLabel ? (
      <View
        pointerEvents="none"
        style={mergeStyles(
          styles.dayOverflowBadge,
          compact ? styles.dayOverflowBadgeCompact : null,
          {
            backgroundColor: palette.primary,
            borderColor: palette.card,
          }
        )}
      >
        <Text
          style={mergeStyles(
            styles.dayOverflowBadgeText,
            compact ? styles.dayOverflowBadgeTextCompact : null
          )}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={1}
        >
          {overflowLabel}
        </Text>
      </View>
    ) : null;
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
          scale: withSpring(isSelected ? 1.04 : 1, {
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

  if (day.dayNumber === null) {
    return (
      <View
        style={mergeStyles(
          styles.dayPressable,
          compact ? styles.dayPressableCompact : null,
          columnWidth ? { width: columnWidth } : null
        )}
      >
        <View style={styles.emptySlot} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={isInteractive ? 'button' : undefined}
      accessibilityLabel={day.accessibilityLabel}
      disabled={!isInteractive}
      onPress={isInteractive ? handlePress : undefined}
      testID={day.dateKey ? `notes-recap-day-${day.dateKey}` : undefined}
      style={({ pressed }) =>
        mergeStyles(
        styles.dayPressable,
        compact ? styles.dayPressableCompact : null,
        columnWidth ? { width: columnWidth } : null,
        pressed && isInteractive ? styles.dayPressed : null
      )}
    >
      <View style={styles.dayFrame}>
        <Animated.View style={cardAnimatedStyle}>
          <View style={styles.dayTileWrap}>
            <View style={styles.dayTileFrame}>
              <Animated.View
                pointerEvents="none"
                style={mergeStyles(
                  styles.daySelectionHalo,
                  compact ? styles.daySelectionHaloCompact : null,
                  { borderColor: palette.primary },
                  haloAnimatedStyle
                )}
              />
              <View
                style={mergeStyles(
                  styles.dayTile,
                  compact ? styles.dayTileCompact : null,
                  isPhotoMode ? styles.dayTilePhoto : null,
                  isTextOnlyDay ? styles.dayTileText : null,
                  !isPhotoMode && !isTextOnlyDay && !isEmptyDay ? styles.dayTileMarker : null,
                  isEmptyDay ? styles.dayTileEmpty : null,
                  {
                    backgroundColor: isEmptyDay ? palette.surface : palette.card,
                    borderColor: isSelected ? 'transparent' : `${palette.border}B8`,
                  }
                )}
              >
                {isPhotoMode ? (
                  <>
                    {photoPreviewUris[1] ? (
                      <View
                        style={mergeStyles(
                          styles.photoStackWrap,
                          compact ? styles.photoStackWrapCompact : null
                        )}
                      >
                        <View
                          style={mergeStyles(
                            styles.photoStackBackFrame,
                            compact ? styles.photoStackBackFrameCompact : null,
                            {
                              borderColor: PHOTO_FRAME_BORDER_COLOR,
                              backgroundColor: PHOTO_BACKING_COLOR,
                              transform: [{ rotate: '8deg' }],
                            }
                          )}
                        />
                        <View
                          testID={day.dateKey ? `notes-recap-day-secondary-photo-${day.dateKey}` : undefined}
                          style={mergeStyles(
                            styles.photoStackFrontFrame,
                            compact ? styles.photoStackFrontFrameCompact : null,
                            {
                              borderColor: PHOTO_FRAME_BORDER_COLOR,
                              backgroundColor: PHOTO_FRAME_BORDER_COLOR,
                              transform: [{ rotate: '-10deg' }],
                            }
                          )}
                        >
                          <Image
                            source={{ uri: primaryPhotoUri }}
                            style={styles.photoStackImage}
                            contentFit="cover"
                          />
                        </View>
                        {overflowLabel ? (
                          <View
                            pointerEvents="none"
                            style={mergeStyles(
                              styles.photoStackCountBadge,
                              compact ? styles.photoStackCountBadgeCompact : null,
                              {
                                backgroundColor: palette.primary,
                                borderColor: palette.card,
                              }
                            )}
                          >
                            <Text
                              style={mergeStyles(
                                styles.photoStackCountText,
                                compact ? styles.photoStackCountTextCompact : null
                              )}
                            >
                              {overflowLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View
                        style={mergeStyles(
                          styles.photoSingleFrame,
                          compact ? styles.photoSingleFrameCompact : null,
                          {
                            borderColor: PHOTO_FRAME_BORDER_COLOR,
                            backgroundColor: PHOTO_FRAME_BORDER_COLOR,
                          }
                        )}
                      >
                        <Image
                          source={{ uri: primaryPhotoUri }}
                          style={styles.photoStackImage}
                          contentFit="cover"
                        />
                        {overflowLabel ? floatingOverflowBadge : null}
                      </View>
                    )}
                  </>
                ) : contentMode === 'text' ? (
                  <>
                    {floatingOverflowBadge}
                    <View
                      style={mergeStyles(
                        styles.textDaySheet,
                        compact ? styles.textDaySheetCompact : null,
                        styles.textDaySheetContentOnly,
                        compact ? styles.textDaySheetContentOnlyCompact : null,
                        {
                          backgroundColor: palette.primarySoft,
                          borderColor: `${palette.border}D0`,
                        }
                      )}
                      testID={day.dateKey ? `notes-recap-day-text-body-${day.dateKey}` : undefined}
                    >
                      <View style={styles.textDayIconWrap}>
                        <Ionicons
                          name="document-text"
                          size={compact ? 16 : 18}
                          color={isSelected ? palette.primary : palette.text}
                        />
                      </View>
                    </View>
                  </>
                ) : contentMode === 'marker' ? (
                  <View
                    style={mergeStyles(
                      styles.markerBoard,
                      compact ? styles.markerBoardCompact : null,
                      {
                        backgroundColor: palette.surface,
                        borderColor: `${palette.border}88`,
                      }
                    )}
                  >
                    <View
                      style={mergeStyles(
                        styles.markerRow,
                        compact ? styles.markerRowCompact : null
                      )}
                    >
                      {day.markers.slice(0, 3).map((marker) =>
                        marker.type === 'polaroid' && marker.previewUri ? (
                          <View
                            key={marker.key}
                            style={mergeStyles(
                              styles.photoMarker,
                              compact ? styles.photoMarkerCompact : null,
                              {
                                borderColor: isSelected ? palette.primary : `${palette.border}AA`,
                                backgroundColor: palette.card,
                              }
                            )}
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
                            style={mergeStyles(
                              styles.marker,
                              compact ? styles.markerCompact : null,
                              {
                                backgroundColor: marker.color,
                                borderColor: marker.color,
                              }
                            )}
                          />
                        )
                      )}
                    </View>
                    {overflowLabel ? (
                      <View
                        style={mergeStyles(
                          styles.overflowBadge,
                          compact ? styles.overflowBadgeCompact : null,
                          {
                            backgroundColor: palette.primarySoft,
                            borderColor: 'transparent',
                          }
                        )}
                      >
                        <Text
                          style={mergeStyles(
                            styles.overflowText,
                            compact ? styles.overflowTextCompact : null,
                            { color: palette.primary }
                          )}
                        >
                          {overflowLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={mergeStyles(
                      styles.emptyDayPill,
                      compact ? styles.emptyDayPillCompact : null,
                      {
                        backgroundColor: day.isToday ? `${palette.primary}18` : `${palette.surface}DD`,
                      }
                    )}
                  />
                )}
              </View>
            </View>

            <View style={styles.dayMeta}>
              <Text
                style={mergeStyles(
                  styles.dayMetaNumber,
                  compact ? styles.dayMetaNumberCompact : null,
                  {
                    color: isSelected
                      ? palette.primary
                      : day.isToday
                        ? palette.primary
                        : isEmptyDay
                          ? palette.secondaryText
                          : palette.text,
                  }
                )}
                numberOfLines={1}
              >
                {day.dayNumber}
              </Text>
              {day.isToday ? (
                <View
                  style={[
                    styles.todayIndicator,
                    compact ? styles.todayIndicatorCompact : null,
                    { backgroundColor: palette.primary },
                  ]}
                />
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
  selectedDayKeys = [],
  onSelectDay,
  compact = false,
}: RecapCalendarGridProps) {
  const { colors } = useTheme();
  const [calendarWidth, setCalendarWidth] = useState(0);
  const selectedDayKeySet = useMemo(() => new Set(selectedDayKeys), [selectedDayKeys]);
  const palette = useMemo<CalendarPalette>(
    () => ({
      accent: colors.accent,
      card: colors.card,
      border: colors.border,
      primary: colors.primary,
      primarySoft: colors.primarySoft,
      secondaryText: colors.secondaryText,
      surface: colors.surface,
      text: colors.text,
    }),
    [
      colors.accent,
      colors.border,
      colors.card,
      colors.primary,
      colors.primarySoft,
      colors.secondaryText,
      colors.surface,
      colors.text,
    ]
  );
  const measuredCompact = calendarWidth > 0 ? calendarWidth / 7 < COMPACT_COLUMN_WIDTH : false;
  const isCompact = compact || measuredCompact;
  const columnHorizontalInset = isCompact ? 1 : 2.5;
  const columnWidth =
    calendarWidth > 0
      ? Math.max((calendarWidth - columnHorizontalInset * 2 * 7) / 7, 0)
      : undefined;
  const handleCalendarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setCalendarWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  return (
    <View style={mergeStyles(styles.section, isCompact ? styles.sectionCompact : null)} onLayout={handleCalendarLayout}>
      <View style={styles.weekRow}>
        {weekDayLabels.map((label, index) => (
          <View
            key={`${label}:${index}`}
            style={mergeStyles(
              styles.weekCell,
              isCompact ? styles.weekCellCompact : null,
              columnWidth ? { width: columnWidth } : null
            )}
          >
            <Text
              style={mergeStyles(
                styles.weekLabel,
                isCompact ? styles.weekLabelCompact : null,
                { color: palette.secondaryText }
              )}
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
            isSelected={Boolean(day.dateKey && selectedDayKeySet.has(day.dateKey))}
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
    textAlign: 'center',
    includeFontPadding: false,
  },
  weekLabelCompact: {
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayPressable: {
    width: '14.2857%',
    paddingHorizontal: 2.5,
    marginBottom: 10,
  },
  dayPressableCompact: {
    paddingHorizontal: 1,
    marginBottom: 6,
  },
  dayPressed: {
    transform: [{ scale: 0.975 }],
  },
  dayTileWrap: {
    alignItems: 'center',
    gap: 6,
  },
  dayTileFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTile: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayTileCompact: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  dayTilePhoto: {
    overflow: 'visible',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  dayTileText: {
    padding: 0,
  },
  dayTileMarker: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  dayTileEmpty: {
    overflow: 'hidden',
  },
  dayFrame: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
  },
  daySelectionHalo: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 22,
    borderWidth: 2,
  },
  daySelectionHaloCompact: {
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  emptySlot: {
    minHeight: 76,
  },
  photoSingleFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 1,
    overflow: 'hidden',
  },
  photoSingleFrameCompact: {
    borderRadius: 16,
  },
  photoStackWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStackWrapCompact: {
  },
  photoStackBackFrame: {
    position: 'absolute',
    top: 3,
    right: -3,
    width: '78%',
    height: '78%',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 1,
    overflow: 'hidden',
    zIndex: 2,
  },
  photoStackBackFrameCompact: {
    borderRadius: 14,
  },
  photoStackFrontFrame: {
    position: 'absolute',
    top: 0,
    left: -2,
    width: '78%',
    height: '78%',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 1,
    overflow: 'hidden',
    zIndex: 1,
  },
  photoStackFrontFrameCompact: {
    borderRadius: 14,
  },
  photoStackImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  photoStackCountBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  photoStackCountBadgeCompact: {
    top: -2,
    right: -1,
    minWidth: 16,
    height: 16,
    borderRadius: 9,
    paddingHorizontal: 3,
  },
  photoStackCountText: {
    ...Typography.pill,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  photoStackCountTextCompact: {
    fontSize: 8,
    lineHeight: 9,
  },
  dayOverflowBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    maxWidth: 28,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 5,
  },
  dayOverflowBadgeCompact: {
    top: -3,
    right: -3,
    minWidth: 16,
    maxWidth: 24,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
  },
  dayOverflowBadgeText: {
    ...Typography.pill,
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
    maxWidth: '100%',
  },
  dayOverflowBadgeTextCompact: {
    fontSize: 7,
    lineHeight: 8,
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
  textDaySheet: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  textDaySheetCompact: {
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: 7,
  },
  textDaySheetContentOnly: {
    paddingTop: 9,
    paddingBottom: 9,
  },
  textDaySheetContentOnlyCompact: {
    paddingTop: 7,
    paddingBottom: 7,
  },
  textDayIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    includeFontPadding: false,
  },
  overflowTextCompact: {
    fontSize: 9,
    lineHeight: 10,
  },
  markerBoard: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  markerBoardCompact: {
    borderRadius: 14,
    paddingHorizontal: 5,
    paddingVertical: 5,
    gap: 3,
  },
  emptyDayPill: {
    width: 48,
    height: 48,
    borderRadius: 18,
  },
  emptyDayPillCompact: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  dayMeta: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  dayMetaNumber: {
    ...Typography.pill,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  dayMetaNumberCompact: {
    fontSize: 14,
    lineHeight: 16,
  },
  todayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayIndicatorCompact: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
