import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Reanimated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import { useNotesRecapViewModel } from '../../../hooks/state/useNotesRecapViewModel';
import type { Note } from '../../../services/database';
import RecapCalendarGrid from './RecapCalendarGrid';
import RecapMonthPicker from './RecapMonthPicker';
import RecapStickerPile from './RecapStickerPile';

const RECAP_FIRST_REVEAL_PHYSICS_DELAY_MS = 280;

const NotesRecapView = memo(function NotesRecapView({
  notes,
  bottomInset,
  isVisible = false,
}: {
  notes: Note[];
  bottomInset: number;
  isVisible?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const {
    activeMonthLabel,
    activeRecap,
    calendarDays,
    isCompactRecap,
    nextMonthDisabled,
    pileItems,
    pileTitle,
    previousMonthDisabled,
    recapHorizontalPadding,
    selectedDayKey,
    selectDay,
    switchMonth,
    weekDayLabels,
  } = useNotesRecapViewModel({ notes });
  const [hasCompletedFirstReveal, setHasCompletedFirstReveal] = useState(false);

  useEffect(() => {
    if (!isVisible || hasCompletedFirstReveal) {
      return;
    }

    if (reduceMotionEnabled) {
      setHasCompletedFirstReveal(true);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setHasCompletedFirstReveal(true);
      }
    }, RECAP_FIRST_REVEAL_PHYSICS_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [hasCompletedFirstReveal, isVisible, reduceMotionEnabled]);

  const shouldEnablePilePhysics = isVisible && hasCompletedFirstReveal;

  return (
    <View
      testID="notes-recap-mode"
      style={[
        styles.recapScreen,
        {
          paddingHorizontal: recapHorizontalPadding,
        },
      ]}
    >
      <Reanimated.View entering={FadeInUp.duration(220)} style={styles.recapPinnedHeader}>
        {activeRecap && activeMonthLabel ? (
          <View style={styles.recapMonthHeader}>
            <RecapMonthPicker
              label={activeMonthLabel}
              onPrevious={() => switchMonth('previous')}
              onNext={() => switchMonth('next')}
              previousDisabled={previousMonthDisabled}
              nextDisabled={nextMonthDisabled}
              previousAccessibilityLabel={t('notes.recap.previousMonth', 'Previous month')}
              nextAccessibilityLabel={t('notes.recap.nextMonth', 'Next month')}
            />
          </View>
        ) : null}
      </Reanimated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: bottomInset + 28,
        }}
      >
        <View style={styles.recapContent}>
          {!activeRecap ? (
            <View
              testID="notes-recap-empty-state"
              style={[styles.recapEmptyState, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Ionicons name="calendar-clear-outline" size={30} color={colors.secondaryText} />
              <Text style={[styles.recapEmptyTitle, { color: colors.text }]}>
                {t('notes.recap.emptyTitle', 'No memories this month')}
              </Text>
              <Text style={[styles.recapEmptyBody, { color: colors.secondaryText }]}>
                {t(
                  'notes.recap.emptyBody',
                  'Try another month or save a new note to start this recap.'
                )}
              </Text>
            </View>
          ) : (
            <Reanimated.View
              key={activeRecap.month.monthKey}
              entering={FadeInDown.duration(240)}
              style={styles.recapMonthSection}
            >
              <Reanimated.View entering={FadeIn.delay(70).duration(220)}>
                <RecapStickerPile
                  title={pileTitle}
                  items={pileItems}
                  deferUntilAfterInteractions
                  physicsEnabled={shouldEnablePilePhysics}
                />
              </Reanimated.View>

              <Reanimated.View
                entering={FadeInDown.delay(110).duration(220)}
                style={[
                  styles.recapCalendarShell,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    paddingHorizontal: isCompactRecap ? 10 : 14,
                    paddingTop: isCompactRecap ? 12 : 16,
                    paddingBottom: isCompactRecap ? 8 : 10,
                  },
                ]}
              >
                <RecapCalendarGrid
                  days={calendarDays}
                  weekDayLabels={weekDayLabels}
                  selectedDayKey={selectedDayKey}
                  onSelectDay={selectDay}
                  compact={isCompactRecap}
                />
              </Reanimated.View>
            </Reanimated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  recapScreen: {
    flex: 1,
  },
  recapPinnedHeader: {
    gap: 18,
    paddingBottom: 18,
  },
  recapContent: {
    gap: 18,
  },
  recapMonthSection: {
    gap: 14,
  },
  recapMonthHeader: {
    gap: 2,
  },
  recapCalendarShell: {
    borderRadius: 30,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 10,
  },
  recapEmptyState: {
    minHeight: 220,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  recapEmptyTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  recapEmptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    maxWidth: 260,
  },
});

export default NotesRecapView;
