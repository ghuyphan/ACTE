import * as Haptics from 'expo-haptics';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import type { RecapCalendarDay } from '../../components/notes/recap/RecapCalendarGrid';
import RecapStickerPile from '../../components/notes/recap/RecapStickerPile';
import { Layout } from '../../constants/theme';
import { useTheme } from '../useTheme';
import {
  getCachedMonthlyRecaps,
  refreshCachedMonthlyRecapForMonthKey,
  type Note,
} from '../../services/database';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import {
  buildMonthlyRecapDigest,
  buildMonthlyRecapFromScopedNotes,
  buildRecapMonthEntries,
  getMonthStickerUsage,
  type CachedMonthlyRecapEntry,
  type MonthlyRecap,
  type MonthlyRecapDay,
  type MonthlyRecapStickerUsage,
} from '../../services/monthlyRecap';
import { getNotePhotoUri } from '../../services/photoStorage';

interface NotesRecapCalendarModel {
  calendarDays: RecapCalendarDay[];
  dayByKey: Map<string, MonthlyRecapDay>;
  dayNotesByKey: Map<string, Note[]>;
}

interface NotesRecapPileModel {
  title: string;
  items: ComponentProps<typeof RecapStickerPile>['items'];
}

export interface UseNotesRecapViewModelOptions {
  notes: Note[];
}

export interface UseNotesRecapViewModelResult {
  activeMonthLabel: string | null;
  activeRecap: MonthlyRecap | null;
  calendarDays: RecapCalendarDay[];
  isCompactRecap: boolean;
  nextMonthDisabled: boolean;
  pileItems: ComponentProps<typeof RecapStickerPile>['items'];
  pileTitle?: string;
  previousMonthDisabled: boolean;
  recapHorizontalPadding: number;
  selectedDayKey: string | null;
  selectDay: (dayKey: string) => void;
  switchMonth: (direction: 'previous' | 'next') => void;
  weekDayLabels: string[];
}

function getRecapLocale(language: string) {
  if (language === 'vi') {
    return 'vi-VN';
  }

  if (language === 'en') {
    return 'en-US';
  }

  return language;
}

function formatRecapMonthLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatRecapDayLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function buildWeekdayLabels(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const sunday = new Date(2026, 2, 1);

  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + index))
  );
}

function buildPhotoPileItemsFromNotes(notes: Note[], keyPrefix: string) {
  return notes
    .filter((note) => note.type === 'photo')
    .map((note) => {
      const previewUri = getNotePhotoUri(note);
      return previewUri
        ? {
            key: `${keyPrefix}:photo:${note.id}`,
            kind: 'photo' as const,
            previewUri,
            count: 1,
            isLivePhoto: Boolean(note.isLivePhoto),
            pairedVideoUri: note.isLivePhoto ? getNotePairedVideoUri(note) : null,
          }
        : null;
    })
    .filter((item): item is {
      key: string;
      kind: 'photo';
      previewUri: string;
      count: number;
      isLivePhoto: boolean;
      pairedVideoUri: string | null;
    } => Boolean(item));
}

function buildStickerPileItemsFromUsage(
  stickerUsage: MonthlyRecapStickerUsage[],
  keyPrefix: string
) {
  return stickerUsage.map((sticker) => ({
    key: `${keyPrefix}:sticker:${sticker.assetId}`,
    kind: 'sticker' as const,
    previewUri: sticker.previewUri,
    count: sticker.count,
    assetWidth: sticker.assetWidth,
    assetHeight: sticker.assetHeight,
    outlineEnabled: sticker.outlineEnabled,
  }));
}

function areCachedMonthlyRecapMapsEqual(
  current: Map<string, CachedMonthlyRecapEntry>,
  next: Map<string, CachedMonthlyRecapEntry>
) {
  if (current.size !== next.size) {
    return false;
  }

  for (const [monthKey, nextEntry] of next) {
    const currentEntry = current.get(monthKey);
    if (!currentEntry || currentEntry.digest !== nextEntry.digest) {
      return false;
    }
  }

  return true;
}

export function useNotesRecapViewModel({
  notes,
}: UseNotesRecapViewModelOptions): UseNotesRecapViewModelResult {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);
  const [cachedRecapsByKey, setCachedRecapsByKey] = useState<Map<string, CachedMonthlyRecapEntry>>(
    () => new Map()
  );
  const cachedRecapsRef = useRef(cachedRecapsByKey);

  useEffect(() => {
    cachedRecapsRef.current = cachedRecapsByKey;
  }, [cachedRecapsByKey]);

  const locale = useMemo(() => getRecapLocale(i18n.language), [i18n.language]);
  const isCompactRecap = width < 390;
  const recapHorizontalPadding = isCompactRecap ? 14 : Layout.screenPadding;
  const deferredNotes = useDeferredValue(notes);
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    []
  );
  const weekDayLabels = useMemo(() => buildWeekdayLabels(locale), [locale]);
  const todayKey = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  const monthEntries = useMemo(
    () => buildRecapMonthEntries(deferredNotes, { timeZone, monthWindow: 12 }),
    [deferredNotes, timeZone]
  );
  const noteById = useMemo(
    () => new Map(deferredNotes.map((note) => [note.id, note] as const)),
    [deferredNotes]
  );
  const monthKeys = useMemo(
    () => new Set(monthEntries.map((entry) => entry.monthKey)),
    [monthEntries]
  );
  const monthDigestsByKey = useMemo(
    () =>
      new Map(
        monthEntries.map((entry) => [entry.monthKey, buildMonthlyRecapDigest(entry.notes)] as const)
      ),
    [monthEntries]
  );
  const activeMonthIndex = useMemo(
    () => monthEntries.findIndex((entry) => entry.monthKey === activeMonthKey),
    [activeMonthKey, monthEntries]
  );
  const activeMonthEntry = useMemo(() => {
    if (activeMonthIndex >= 0) {
      return monthEntries[activeMonthIndex] ?? null;
    }

    return monthEntries[0] ?? null;
  }, [activeMonthIndex, monthEntries]);
  const activeRecap = useMemo(() => {
    if (!activeMonthEntry) {
      return null;
    }

    const cachedEntry = cachedRecapsByKey.get(activeMonthEntry.monthKey);
    const activeMonthDigest = monthDigestsByKey.get(activeMonthEntry.monthKey);
    if (cachedEntry && cachedEntry.digest === activeMonthDigest) {
      return cachedEntry.recap;
    }

    return buildMonthlyRecapFromScopedNotes(activeMonthEntry.notes, {
      year: activeMonthEntry.monthDate.getFullYear(),
      month: activeMonthEntry.monthDate.getMonth(),
      timeZone,
    });
  }, [activeMonthEntry, cachedRecapsByKey, monthDigestsByKey, timeZone]);

  useEffect(() => {
    let cancelled = false;
    const nextMonthKeys = monthEntries.map((entry) => entry.monthKey);

    if (nextMonthKeys.length === 0) {
      setCachedRecapsByKey(new Map());
      return () => {
        cancelled = true;
      };
    }

    void getCachedMonthlyRecaps(nextMonthKeys, { timeZone })
      .then((nextEntries) => {
        if (!cancelled && !areCachedMonthlyRecapMapsEqual(cachedRecapsRef.current, nextEntries)) {
          setCachedRecapsByKey(nextEntries);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[notes-recap] Failed to load cached month recaps:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [monthEntries, timeZone]);

  useEffect(() => {
    if (!activeMonthEntry) {
      return;
    }

    const activeMonthDigest = monthDigestsByKey.get(activeMonthEntry.monthKey);
    const cachedEntry = cachedRecapsByKey.get(activeMonthEntry.monthKey);
    if (cachedEntry && cachedEntry.digest === activeMonthDigest) {
      return;
    }

    let cancelled = false;

    void refreshCachedMonthlyRecapForMonthKey(activeMonthEntry.monthKey, { timeZone })
      .then((nextEntry) => {
        if (cancelled || !nextEntry) {
          return;
        }

        setCachedRecapsByKey((current) => {
          const existingEntry = current.get(activeMonthEntry.monthKey);
          if (existingEntry?.digest === nextEntry.digest) {
            return current;
          }

          const nextMap = new Map(current);
          nextMap.set(activeMonthEntry.monthKey, nextEntry);
          return nextMap;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[notes-recap] Failed to warm cached month recap:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeMonthEntry, cachedRecapsByKey, monthDigestsByKey, timeZone]);

  useEffect(() => {
    if (
      selectedDayKey &&
      (!activeRecap || !activeRecap.days.some((day) => day.dateKey === selectedDayKey && day.noteCount > 0))
    ) {
      setSelectedDayKey(null);
    }
  }, [activeRecap, selectedDayKey]);

  useEffect(() => {
    const firstMonthKey = monthEntries[0]?.monthKey ?? null;

    if (activeMonthKey && monthKeys.has(activeMonthKey)) {
      return;
    }

    if (firstMonthKey !== activeMonthKey) {
      setActiveMonthKey(firstMonthKey);
    }
  }, [activeMonthKey, monthEntries, monthKeys]);

  const switchMonth = useCallback(
    (direction: 'previous' | 'next') => {
      if (activeMonthIndex < 0) {
        return;
      }

      const targetIndex = direction === 'previous' ? activeMonthIndex + 1 : activeMonthIndex - 1;
      const targetMonthEntry = monthEntries[targetIndex];

      if (!targetMonthEntry) {
        return;
      }

      void Haptics.selectionAsync();
      startTransition(() => {
        setActiveMonthKey(targetMonthEntry.monthKey);
        setSelectedDayKey(null);
      });
    },
    [activeMonthIndex, monthEntries]
  );

  const selectDay = useCallback((dayKey: string) => {
    void Haptics.selectionAsync();
    startTransition(() => {
      setSelectedDayKey((current) => (current === dayKey ? null : dayKey));
    });
  }, []);

  const activeRecapCalendarModel = useMemo<NotesRecapCalendarModel | null>(() => {
    if (!activeRecap) {
      return null;
    }

    const placeholderDays: RecapCalendarDay[] = [];
    const firstWeekdayIndex = activeRecap.days[0]?.weekdayIndex ?? 0;

    for (let index = 0; index < firstWeekdayIndex; index += 1) {
      placeholderDays.push({
        key: `${activeRecap.month.monthKey}:empty-start:${index}`,
        dayNumber: null,
        count: 0,
        markers: [],
        disabled: true,
      });
    }

    const dayNotesByKey = new Map<string, Note[]>();
    const dayByKey = new Map(activeRecap.days.map((day) => [day.dateKey, day] as const));
    const calendarDays = activeRecap.days.map((day) => {
      const dayNotes = day.noteIds
        .map((noteId) => noteById.get(noteId) ?? null)
        .filter((note): note is Note => Boolean(note));
      const dayPhotoPreviewUri =
        dayNotes
          .filter((note) => note.type === 'photo')
          .map((note) => getNotePhotoUri(note))
          .find((uri): uri is string => Boolean(uri)) ?? undefined;

      dayNotesByKey.set(day.dateKey, dayNotes);

      return {
        key: day.dateKey,
        dateKey: day.dateKey,
        dayNumber: day.dayOfMonth,
        count: day.noteCount,
        photoPreviewUri: dayPhotoPreviewUri,
        markers: Array.from({ length: day.stampCount }, (_, index) => ({
          key: `${day.dateKey}:marker:${index}`,
          color:
            day.hasPhoto && index === 0
              ? colors.primary
              : day.hasDecorations
                ? colors.accent
                : colors.secondaryText,
          previewUri: day.hasPhoto && index === 0 ? dayPhotoPreviewUri : undefined,
          type: day.hasPhoto && index === 0 ? ('polaroid' as const) : ('stamp' as const),
        })),
        isToday: day.dateKey === todayKey,
        disabled: day.noteCount === 0,
        accessibilityLabel:
          day.noteCount > 0
            ? `${t('notes.recap.dayMemories', 'Day memories')} ${formatRecapMonthLabel(
                activeRecap.month.start,
                locale
              )} ${day.dayOfMonth}`
            : undefined,
      } satisfies RecapCalendarDay;
    });

    const totalSlots = placeholderDays.length + calendarDays.length;
    const trailingSlots = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
    const trailingDays = Array.from({ length: trailingSlots }, (_, index) => ({
      key: `${activeRecap.month.monthKey}:empty-end:${index}`,
      dayNumber: null,
      count: 0,
      markers: [],
      disabled: true,
    } satisfies RecapCalendarDay));

    return {
      calendarDays: [...placeholderDays, ...calendarDays, ...trailingDays],
      dayByKey,
      dayNotesByKey,
    };
  }, [
    activeRecap,
    colors.accent,
    colors.primary,
    colors.secondaryText,
    locale,
    noteById,
    t,
    todayKey,
  ]);

  const activeRecapPileModel = useMemo<NotesRecapPileModel | null>(() => {
    if (!activeRecap || !activeRecapCalendarModel || !activeMonthEntry) {
      return null;
    }

    const selectedRecapDay = selectedDayKey
      ? activeRecapCalendarModel.dayByKey.get(selectedDayKey) ?? null
      : null;
    const pileSourceNotes = selectedRecapDay
      ? activeRecapCalendarModel.dayNotesByKey.get(selectedRecapDay.dateKey) ?? []
      : activeMonthEntry.notes;
    const pileKeyPrefix = selectedRecapDay?.dateKey ?? activeRecap.month.monthKey;
    const photoPileItems = buildPhotoPileItemsFromNotes(pileSourceNotes, pileKeyPrefix).slice(0, 8);
    const stickerUsage = selectedRecapDay
      ? getMonthStickerUsage(pileSourceNotes)
      : activeRecap.stickerUsage;
    const stickerPileItems = buildStickerPileItemsFromUsage(stickerUsage, pileKeyPrefix);
    const prioritizedPhotoItems =
      stickerPileItems.length > 0 ? photoPileItems.slice(0, 5) : photoPileItems.slice(0, 8);
    const pileItems = [...prioritizedPhotoItems, ...stickerPileItems].slice(0, 8);
    const selectedDayLabel = selectedRecapDay
      ? formatRecapDayLabel(
          new Date(
            activeRecap.month.start.getFullYear(),
            activeRecap.month.start.getMonth(),
            selectedRecapDay.dayOfMonth
          ),
          locale
        )
      : null;

    return {
      title: selectedDayLabel
        ? selectedDayLabel
        : photoPileItems.length > 0
          ? t('notes.recap.photoPileTitle', 'Saved this month')
          : t('notes.recap.stickerTrayTitle', 'Used this month'),
      items: pileItems,
    };
  }, [activeMonthEntry, activeRecap, activeRecapCalendarModel, locale, selectedDayKey, t]);

  return {
    activeMonthLabel: activeRecap ? formatRecapMonthLabel(activeRecap.month.start, locale) : null,
    activeRecap,
    calendarDays: activeRecapCalendarModel?.calendarDays ?? [],
    isCompactRecap,
    nextMonthDisabled: activeMonthIndex <= 0,
    pileItems: activeRecapPileModel?.items ?? [],
    pileTitle: activeRecapPileModel?.title,
    previousMonthDisabled: activeMonthIndex >= monthEntries.length - 1,
    recapHorizontalPadding,
    selectedDayKey,
    selectDay,
    switchMonth,
    weekDayLabels,
  };
}
