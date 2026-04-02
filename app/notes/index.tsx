import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Href, Stack, useRouter } from 'expo-router';
import { memo, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Reanimated from 'react-native-reanimated';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../constants/theme';
import { DOODLE_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { useAuth } from '../../hooks/useAuth';
import { useFeedFocus } from '../../hooks/state/useFeedFocus';
import { useNotesStore } from '../../hooks/useNotes';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import DynamicStickerCanvas from '../../components/notes/DynamicStickerCanvas';
import NoteDoodleCanvas from '../../components/notes/NoteDoodleCanvas';
import RecapCalendarGrid, {
  type RecapCalendarDay,
} from '../../components/notes/recap/RecapCalendarGrid';
import RecapModeSwitch, {
  type RecapMode,
} from '../../components/notes/recap/RecapModeSwitch';
import RecapMonthPicker from '../../components/notes/recap/RecapMonthPicker';
import RecapStickerPile from '../../components/notes/recap/RecapStickerPile';
import {
  getGradientStickerMotionVariant,
  getNoteColorStickerMotion,
  getTextNoteCardGradient,
  type StickerMotionVariant,
} from '../../services/noteAppearance';
import { buildMonthlyRecap } from '../../services/monthlyRecap';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import { parseNoteDoodleStrokes } from '../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../services/noteStickers';
import { getNotePhotoUri } from '../../services/photoStorage';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from '../../services/remoteMedia';
import { Note } from '../../services/database';
import { SharedPost } from '../../services/sharedFeedService';

type NoteGridItem =
  | { id: string; kind: 'note'; createdAt: string; note: Note }
  | { id: string; kind: 'shared-post'; createdAt: string; post: SharedPost };

const GRID_DOODLE_STROKE_WIDTH = 4.5;
const GRID_STICKER_MIN_SIZE = 0;

const GridTile = memo(function GridTile({
  item,
  size,
  gap,
  colors,
  onPress,
  index,
  photoFallbackLabel,
}: {
  item: NoteGridItem;
  size: number;
  gap: number;
  colors: {
    card: string;
    border: string;
    primary: string;
    primarySoft: string;
  };
  onPress: () => void;
  index: number;
  photoFallbackLabel: string;
}) {
  const [sharedPhotoUri, setSharedPhotoUri] = useState(
    item.kind === 'shared-post' ? item.post.photoLocalUri ?? null : null
  );

  useEffect(() => {
    if (item.kind !== 'shared-post') {
      setSharedPhotoUri(null);
      return;
    }

    setSharedPhotoUri(item.post.photoLocalUri ?? null);
  }, [item]);

  useEffect(() => {
    if (item.kind !== 'shared-post' || item.post.type !== 'photo' || sharedPhotoUri || !item.post.photoPath) {
      return;
    }

    let cancelled = false;

    void downloadPhotoFromStorage(
      SHARED_POST_MEDIA_BUCKET,
      item.post.photoPath,
      `shared-grid-${item.post.id}`
    )
      .then((nextUri) => {
        if (!cancelled && nextUri) {
          setSharedPhotoUri(nextUri);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[notes-grid] Failed to hydrate shared photo:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item, sharedPhotoUri]);

  const imageUri =
    item.kind === 'note'
      ? getNotePhotoUri(item.note)
      : item.post.type === 'photo'
        ? sharedPhotoUri ?? ''
        : '';
  const isPhotoTile = (item.kind === 'note' ? item.note.type : item.post.type) === 'photo';
  const doodleStrokesJson =
    item.kind === 'note'
      ? item.note.doodleStrokesJson
      : item.post.doodleStrokesJson ?? null;
  const doodleStrokes = useMemo(
    () => parseNoteDoodleStrokes(doodleStrokesJson),
    [doodleStrokesJson]
  );
  const stickerPlacementsJson =
    item.kind === 'note'
      ? item.note.stickerPlacementsJson ?? null
      : item.post.stickerPlacementsJson ?? null;
  const stickerPlacements = useMemo(
    () => parseNoteStickerPlacements(stickerPlacementsJson),
    [stickerPlacementsJson]
  );
  const text =
    item.kind === 'note'
      ? item.note.content.trim()
      : (item.post.text || '').trim();
  const textGradient = useMemo(
    () =>
      getTextNoteCardGradient({
        text,
        noteId: item.kind === 'note' ? item.note.id : item.post.id,
        emoji: item.kind === 'note' ? item.note.moodEmoji : null,
        noteColor: item.kind === 'note' ? item.note.noteColor : item.post.noteColor,
      }),
    [item, text]
  );
  const stickerMotionVariant = useMemo<StickerMotionVariant>(() => {
    if (isPhotoTile) {
      return 'physics';
    }

    const noteColor = item.kind === 'note' ? item.note.noteColor : item.post.noteColor;
    return getNoteColorStickerMotion(noteColor) ?? getGradientStickerMotionVariant(textGradient);
  }, [isPhotoTile, item, textGradient]);
  const tileText = text || (isPhotoTile ? photoFallbackLabel : '');
  const showPhotoPlaceholder = item.kind === 'shared-post' && item.post.type === 'photo' && !imageUri;
  const sharedTransitionTag = item.kind === 'note' ? `feed-note-card-${item.note.id}` : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tilePressable,
        {
          width: size,
          height: size,
          marginRight: index % 3 === 2 ? 0 : gap,
          marginBottom: gap,
        },
      ]}
    >
      <Reanimated.View
        sharedTransitionTag={sharedTransitionTag}
        style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {imageUri ? (
          <View style={styles.tileMediaWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.tileImage}
              contentFit="cover"
              transition={120}
            />
            {stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <DynamicStickerCanvas
                  placements={stickerPlacements}
                  remoteBucket={item.kind === 'shared-post' ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={item.kind === 'shared-post'}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={stickerMotionVariant}
                />
              </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={GRID_DOODLE_STROKE_WIDTH} />
              </View>
            ) : null}
          </View>
        ) : showPhotoPlaceholder ? (
          <View
            testID="shared-photo-grid-placeholder"
            style={[
              styles.photoPlaceholder,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.photoPlaceholderBadge,
                {
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <Text style={[styles.photoPlaceholderIcon, { color: colors.primary }]}>+</Text>
            </View>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileTextFill}>
            {stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextStickerOverlay]}>
                <DynamicStickerCanvas
                  placements={stickerPlacements}
                  remoteBucket={item.kind === 'shared-post' ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={item.kind === 'shared-post'}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={stickerMotionVariant}
                />
              </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextDoodleOverlay]}>
                <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={GRID_DOODLE_STROKE_WIDTH} />
              </View>
            ) : null}
            {tileText ? (
              <Text style={styles.tileText} numberOfLines={4}>
                {tileText}
              </Text>
            ) : null}
          </LinearGradient>
        )}
      </Reanimated.View>
    </Pressable>
  );
}, (prevProps, nextProps) => (
  prevProps.index === nextProps.index &&
  prevProps.size === nextProps.size &&
  prevProps.gap === nextProps.gap &&
  prevProps.colors === nextProps.colors &&
  prevProps.photoFallbackLabel === nextProps.photoFallbackLabel &&
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.kind === nextProps.item.kind &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  (prevProps.item.kind === 'note' && nextProps.item.kind === 'note'
    ? prevProps.item.note === nextProps.item.note
    : prevProps.item.kind === 'shared-post' && nextProps.item.kind === 'shared-post'
      ? prevProps.item.post === nextProps.item.post
      : false)
));

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
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

function buildStickerPileItemsFromNotes(notes: Note[], keyPrefix: string) {
  const stickerUsage = new Map<
    string,
    {
      assetId: string;
      previewUri: string;
      count: number;
    }
  >();

  for (const note of notes) {
    const placements = parseNoteStickerPlacements(note.stickerPlacementsJson ?? null);

    for (const placement of placements) {
      const previewUri = placement.asset.localUri;
      if (!previewUri) {
        continue;
      }

      const current = stickerUsage.get(placement.assetId);
      if (current) {
        current.count += 1;
        continue;
      }

      stickerUsage.set(placement.assetId, {
        assetId: placement.assetId,
        previewUri,
        count: 1,
      });
    }
  }

  return Array.from(stickerUsage.values()).map((sticker) => ({
    key: `${keyPrefix}:sticker:${sticker.assetId}`,
    kind: 'sticker' as const,
    previewUri: sticker.previewUri,
    count: sticker.count,
  }));
}

const NotesRecapView = memo(function NotesRecapView({
  notes,
  contentTopInset,
  bottomInset,
  onChangeMode,
}: {
  notes: Note[];
  contentTopInset: number;
  bottomInset: number;
  onChangeMode: (mode: RecapMode) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);
  const locale = useMemo(() => getRecapLocale(i18n.language), [i18n.language]);
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    []
  );
  const weekDayLabels = useMemo(() => buildWeekdayLabels(locale), [locale]);
  const todayKey = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);
  const monthEntries = useMemo(() => {
    let latestMonth: Date | null = null;
    let earliestMonth: Date | null = null;
    const notesByMonth = new Map<string, Note[]>();

    for (const note of notes) {
      const timestamp = new Date(note.createdAt);
      if (Number.isNaN(timestamp.getTime())) {
        continue;
      }

      const monthDate = startOfMonth(timestamp);
      const monthKey = getMonthKey(monthDate);
      const existingMonthNotes = notesByMonth.get(monthKey);

      if (existingMonthNotes) {
        existingMonthNotes.push(note);
      } else {
        notesByMonth.set(monthKey, [note]);
      }

      if (!latestMonth || !earliestMonth) {
        latestMonth = monthDate;
        earliestMonth = monthDate;
        continue;
      }

      if (monthDate.getTime() > latestMonth.getTime()) {
        latestMonth = monthDate;
      }

      if (monthDate.getTime() < earliestMonth.getTime()) {
        earliestMonth = monthDate;
      }
    }

    if (!latestMonth || !earliestMonth) {
      return [];
    }

    const minimumWindowStart = shiftMonth(latestMonth, -11);
    if (minimumWindowStart.getTime() < earliestMonth.getTime()) {
      earliestMonth = minimumWindowStart;
    }

    const months: Array<{
      monthDate: Date;
      monthKey: string;
      notes: Note[];
    }> = [];
    let cursor = startOfMonth(latestMonth);

    while (cursor.getTime() >= earliestMonth.getTime()) {
      const monthKey = getMonthKey(cursor);
      months.push({
        monthDate: cursor,
        monthKey,
        notes: notesByMonth.get(monthKey) ?? [],
      });
      cursor = shiftMonth(cursor, -1);
    }

    return months;
  }, [notes]);

  const noteById = useMemo(
    () => new Map(notes.map((note) => [note.id, note] as const)),
    [notes]
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

    return buildMonthlyRecap(activeMonthEntry.notes, {
      year: activeMonthEntry.monthDate.getFullYear(),
      month: activeMonthEntry.monthDate.getMonth(),
      timeZone,
    });
  }, [activeMonthEntry, timeZone]);

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
    const monthKeys = new Set(monthEntries.map((entry) => entry.monthKey));

    if (activeMonthKey && monthKeys.has(activeMonthKey)) {
      return;
    }

    if (firstMonthKey !== activeMonthKey) {
      setActiveMonthKey(firstMonthKey);
    }
  }, [activeMonthKey, monthEntries]);

  const handleChangeMonth = useCallback(
    (direction: 'previous' | 'next') => {
      if (activeMonthIndex < 0) {
        return;
      }

      const targetIndex = direction === 'previous' ? activeMonthIndex + 1 : activeMonthIndex - 1;
      const targetMonthEntry = monthEntries[targetIndex];

      if (!targetMonthEntry) {
        return;
      }

      startTransition(() => {
        setActiveMonthKey(targetMonthEntry.monthKey);
        setSelectedDayKey(null);
      });
    },
    [activeMonthIndex, monthEntries]
  );
  const handleSelectDay = useCallback((dayKey: string) => {
    startTransition(() => {
      setSelectedDayKey((current) => (current === dayKey ? null : dayKey));
    });
  }, []);
  const activeRecapCalendarModel = useMemo(() => {
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
    const monthNotes: Note[] = [];
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
      monthNotes.push(...dayNotes);

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
      monthNotes,
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
  const activeRecapPileModel = useMemo(() => {
    if (!activeRecap || !activeRecapCalendarModel) {
      return null;
    }

    const selectedRecapDay = selectedDayKey
      ? activeRecapCalendarModel.dayByKey.get(selectedDayKey) ?? null
      : null;
    const pileSourceNotes = selectedRecapDay
      ? activeRecapCalendarModel.dayNotesByKey.get(selectedRecapDay.dateKey) ?? []
      : activeRecapCalendarModel.monthNotes;
    const pileKeyPrefix = selectedRecapDay?.dateKey ?? activeRecap.month.monthKey;
    const photoPileItems = buildPhotoPileItemsFromNotes(pileSourceNotes, pileKeyPrefix).slice(0, 8);
    const stickerPileItems = buildStickerPileItemsFromNotes(pileSourceNotes, pileKeyPrefix);
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
  }, [activeRecap, activeRecapCalendarModel, locale, selectedDayKey, t]);

  return (
    <View
      testID="notes-recap-mode"
      style={[
        styles.recapScreen,
        {
        paddingTop: contentTopInset,
        paddingHorizontal: Layout.screenPadding,
        },
      ]}
    >
      <View style={styles.recapPinnedHeader}>
        <RecapModeSwitch
          value="recap"
          onChange={onChangeMode}
          allLabel={t('notes.recap.allLabel', 'All')}
          recapLabel={t('notes.recap.recapLabel', 'Calendar')}
        />
        {activeRecap ? (
          <View style={styles.recapMonthHeader}>
            <RecapMonthPicker
              label={formatRecapMonthLabel(activeRecap.month.start, locale)}
              onPrevious={() => handleChangeMonth('previous')}
              onNext={() => handleChangeMonth('next')}
              previousDisabled={activeMonthIndex >= monthEntries.length - 1}
              nextDisabled={activeMonthIndex <= 0}
              previousAccessibilityLabel={t('notes.recap.previousMonth', 'Previous month')}
              nextAccessibilityLabel={t('notes.recap.nextMonth', 'Next month')}
            />
          </View>
        ) : null}
      </View>

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
            <View
              key={activeRecap.month.monthKey}
              style={styles.recapMonthSection}
            >
              <RecapStickerPile
                title={activeRecapPileModel?.title}
                items={activeRecapPileModel?.items ?? []}
                deferUntilAfterInteractions
              />

              <View
                style={[
                  styles.recapCalendarShell,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <RecapCalendarGrid
                  days={activeRecapCalendarModel?.calendarDays ?? []}
                  weekDayLabels={weekDayLabels}
                  selectedDayKey={selectedDayKey}
                  onSelectDay={handleSelectDay}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

export default function NotesIndexScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { requestFeedFocus } = useFeedFocus();
  const { notes, loading } = useNotesStore();
  const { sharedPosts, loading: sharedLoading } = useSharedFeedStore();
  const [mode, setMode] = useState<RecapMode>('all');

  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== user?.uid),
    [sharedPosts, user?.uid]
  );
  const items = useMemo<NoteGridItem[]>(
    () =>
      [
        ...notes.map((note) => ({
          id: `note-${note.id}`,
          kind: 'note' as const,
          createdAt: note.createdAt,
          note,
        })),
        ...friendPosts.map((post) => ({
          id: `shared-${post.id}`,
          kind: 'shared-post' as const,
          createdAt: post.createdAt,
          post,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [friendPosts, notes]
  );

  const gridGap = 8;
  const gridSize = Math.floor((width - Layout.screenPadding * 2 - gridGap * 2) / 3);
  const contentTopInset = insets.top + 72;
  const isLoading = loading || (sharedLoading && items.length === 0);
  const hasRecapNotes = notes.length > 0;

  useEffect(() => {
    if (!hasRecapNotes && mode === 'recap') {
      setMode('all');
    }
  }, [hasRecapNotes, mode]);

  const openItem = useCallback(
    (item: NoteGridItem) => {
      if (item.kind === 'note') {
        requestFeedFocus({ kind: 'note', id: item.note.id });
        router.replace('/' as Href);
        return;
      }

      requestFeedFocus({ kind: 'shared-post', id: item.post.id });
      router.replace('/' as Href);
    },
    [requestFeedFocus, router]
  );
  const modeSwitch = hasRecapNotes ? (
    <View style={styles.modeSwitchWrap}>
      <RecapModeSwitch
        value={mode}
        onChange={setMode}
        allLabel={t('notes.recap.allLabel', 'All')}
        recapLabel={t('notes.recap.recapLabel', 'Calendar')}
      />
    </View>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: t('notes.viewAllTitle', 'All notes'),
          headerBackTitle: t('tabs.home', 'Home'),
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
        }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : mode === 'recap' && hasRecapNotes ? (
        <NotesRecapView
          notes={notes}
          contentTopInset={contentTopInset}
          bottomInset={insets.bottom}
          onChangeMode={setMode}
        />
      ) : items.length === 0 ? (
        <View
          testID="notes-empty-state"
          style={[
            styles.center,
            styles.emptyScreen,
            {
              paddingTop: contentTopInset,
              paddingBottom: insets.bottom + 28,
            },
          ]}
        >
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={44} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('home.emptyTitle', 'No notes yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              {t('home.emptySubtitle', 'Write down what she likes or dislikes\nat each restaurant — we\'ll remind you!')}
            </Text>
          </View>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          getItemType={(item) => `${item.kind}:${item.kind === 'note' ? item.note.type : item.post.type}`}
          drawDistance={gridSize * 4}
          ListHeaderComponent={modeSwitch}
          renderItem={({ item, index }) => (
            <GridTile
              item={item}
              index={index}
              size={gridSize}
              gap={gridGap}
              colors={colors}
              photoFallbackLabel={t('shared.photoMemory', 'Photo memory')}
              onPress={() => openItem(item)}
            />
          )}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: contentTopInset,
            paddingBottom: insets.bottom + 28,
            paddingHorizontal: Layout.screenPadding,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreen: {
    paddingHorizontal: Layout.screenPadding,
  },
  modeSwitchWrap: {
    paddingBottom: 18,
  },
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
  recapMonthTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  recapMonthMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
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
  tilePressable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  tile: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileMediaWrap: {
    flex: 1,
  },
  tileDoodleOverlay: {
    position: 'absolute',
    ...DOODLE_ARTBOARD_FRAME,
  },
  tileTextDoodleOverlay: {
    opacity: 0.48,
  },
  tileTextStickerOverlay: {
    opacity: 0.48,
    zIndex: 0,
  },
  photoPlaceholder: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoPlaceholderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
  },
  tileTextFill: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    zIndex: 1,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    marginTop: 8,
    maxWidth: 240,
  },
});
