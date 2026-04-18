import * as Location from 'expo-location';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';
import { getSupabaseUser } from '../utils/supabase';
import { formatDate } from '../utils/dateUtils';
import {
  getAllNotesForScope,
  getPersistedActiveNotesScope,
  LOCAL_NOTES_SCOPE,
  type Note,
} from './database';
import { getTextNoteCardGradient } from './noteAppearance';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { getCachedSharedFeedSnapshot } from './sharedFeedCache';
import {
  loadRecentWidgetCandidateKeys,
  saveRecentWidgetCandidateKeys,
} from './widget/history';
import {
  resolveWidgetAuthorAvatarProps,
  resolveWidgetPhotoProps,
  resolveWidgetStickerPlacementsJson,
} from './widget/media';
import {
  __resetWidgetPlatformForTests,
  getPlatformWidgetDeliverySignature,
  getWidgetWarningMessage,
  updatePlatformWidgetTimeline,
} from './widget/platform';
import {
  buildOrderedWidgetSelections,
  createPersonalWidgetCandidate,
  createSharedWidgetCandidate,
  createTextFallbackWidgetCandidate,
  isPhotoWidgetNote,
  isTextWidgetNote,
  type LocationCoords,
  type WidgetCandidate,
  type WidgetSelectionResult,
} from './widget/selection';
import {
  isStoredWidgetProps,
  sanitizeWidgetPropsForBridge,
  type WidgetProps,
  type WidgetSelectionMode,
  type WidgetTimelineEntry,
} from './widget/contract';
import {
  getSharedFeedErrorMessage,
  refreshSharedFeed,
  type SharedPost,
} from './sharedFeedService';

export type { WidgetProps, WidgetSelectionMode } from './widget/contract';
export { selectWidgetNote } from './widget/selection';

export interface UpdateWidgetDataOptions {
  notes?: Note[];
  includeLocationLookup?: boolean;
  referenceDate?: Date;
  includeSharedRefresh?: boolean;
  currentLocation?: LocationCoords | null;
  preferredNoteId?: string | null;
}

export interface ScheduleWidgetDataUpdateOptions {
  debounceMs?: number;
  throttleKey?: string;
  throttleMs?: number;
}

export interface WidgetUpdateResult {
  status:
    | 'updated'
    | 'updated_reused_last_payload'
    | 'skipped_duplicate_request'
    | 'skipped_unchanged'
    | 'queued'
    | 'skipped_platform'
    | 'failed';
  deliveredProps?: WidgetProps;
  errorMessage?: string;
}

interface WidgetSharedFeedSnapshot {
  sharedPosts: SharedPost[];
}

const WIDGET_URL_SCHEME = 'noto://';
const WIDGET_TIMELINE_ENTRY_COUNT = 4;
const WIDGET_SLOT_HOURS = 6;
const WIDGET_LAST_DELIVERED_PROPS_STORAGE_KEY = 'widget.timeline.lastDeliveredProps.v2';
const WIDGET_SHARED_REFRESH_TTL_MS = 2 * 60 * 1000;
const WIDGET_LOCATION_CACHE_TTL_MS = 60 * 1000;
const WIDGET_REQUEST_DEDUPE_WINDOW_MS = 3 * 1000;
const WIDGET_DEFAULT_REFRESH_DEBOUNCE_MS = 120;
let widgetUpdateInFlight: Promise<WidgetUpdateResult> | null = null;
let pendingWidgetUpdateOptions: UpdateWidgetDataOptions | null = null;
let lastWidgetRequestKey: string | null = null;
let lastWidgetRequestAt = 0;
let lastPlatformDeliverySignature: string | null = null;
let scheduledWidgetUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
let scheduledWidgetUpdateRequest:
  | {
      options: UpdateWidgetDataOptions;
      debounceMs: number;
      throttleKey: string | null;
      throttleMs: number;
    }
  | null = null;
let sharedWidgetFeedCache:
  | {
      userUid: string;
      refreshedAt: number;
      snapshot: WidgetSharedFeedSnapshot;
    }
  | null = null;
let widgetLocationCache:
  | {
      fetchedAt: number;
      currentLocation: LocationCoords | null;
    }
  | null = null;
const widgetRefreshThrottleTimestamps = new Map<string, number>();

function buildWidgetUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${WIDGET_URL_SCHEME}${normalizedPath}`;
}

function getWidgetPrimaryActionUrl(candidate: Pick<WidgetCandidate, 'id' | 'source'> | null, noteCount: number) {
    if (!candidate) {
        return noteCount > 0 ? buildWidgetUrl('/notes') : buildWidgetUrl('/');
    }

    if (candidate.source === 'shared') {
        return buildWidgetUrl(`/widget/shared-post/${encodeURIComponent(candidate.id)}`);
    }

    return buildWidgetUrl(`/widget/note/${encodeURIComponent(candidate.id)}`);
}

function buildWidgetNotesFingerprint(notes: Note[]) {
    return notes
        .map((note) =>
            [
                note.id,
                note.updatedAt ?? note.createdAt,
                note.type,
                note.locationName ?? '',
                note.isFavorite ? '1' : '0',
                note.hasDoodle ? '1' : '0',
                note.hasStickers ? '1' : '0',
            ].join(':')
        )
        .join('|');
}

function buildWidgetRequestKey(options: UpdateWidgetDataOptions) {
    return JSON.stringify({
        notes: options.notes ? buildWidgetNotesFingerprint(options.notes) : 'db',
        includeLocationLookup: options.includeLocationLookup !== false,
        includeSharedRefresh: options.includeSharedRefresh === true,
        referenceDate: options.referenceDate?.toISOString() ?? 'live',
        preferredNoteId: options.preferredNoteId ?? null,
        currentLocation:
            options.currentLocation === undefined
                ? 'auto'
                : options.currentLocation
                    ? [
                        options.currentLocation.latitude,
                        options.currentLocation.longitude,
                    ]
                    : null,
    });
}

function mergeWidgetUpdateOptions(
    current: UpdateWidgetDataOptions | null,
    incoming: UpdateWidgetDataOptions
): UpdateWidgetDataOptions {
    if (!current) {
        return { ...incoming };
    }

    return {
        ...current,
        ...incoming,
        notes: incoming.notes ?? current.notes,
        includeLocationLookup:
            current.includeLocationLookup === true || incoming.includeLocationLookup === true
                ? true
                : incoming.includeLocationLookup ?? current.includeLocationLookup,
        includeSharedRefresh:
            current.includeSharedRefresh === true || incoming.includeSharedRefresh === true
                ? true
                : incoming.includeSharedRefresh ?? current.includeSharedRefresh,
        referenceDate: incoming.referenceDate ?? current.referenceDate,
        currentLocation:
            incoming.currentLocation !== undefined
                ? incoming.currentLocation
                : current.currentLocation,
        preferredNoteId: incoming.preferredNoteId ?? current.preferredNoteId,
    };
}

function clearScheduledWidgetUpdateTimeout() {
    if (!scheduledWidgetUpdateTimeout) {
        return;
    }

    clearTimeout(scheduledWidgetUpdateTimeout);
    scheduledWidgetUpdateTimeout = null;
}

function schedulePendingWidgetUpdate() {
    if (!scheduledWidgetUpdateRequest) {
        return;
    }

    clearScheduledWidgetUpdateTimeout();

    scheduledWidgetUpdateTimeout = setTimeout(() => {
        const nextRequest = scheduledWidgetUpdateRequest;
        scheduledWidgetUpdateRequest = null;
        scheduledWidgetUpdateTimeout = null;

        if (!nextRequest) {
            return;
        }

        if (nextRequest.throttleKey && nextRequest.throttleMs > 0) {
            widgetRefreshThrottleTimestamps.set(nextRequest.throttleKey, Date.now());
        }

        void updateWidgetData(nextRequest.options).then((result) => {
            if (result.status === 'failed' && result.errorMessage) {
                console.warn('[widgetService] Failed scheduled widget update:', result.errorMessage);
            }
        });
    }, scheduledWidgetUpdateRequest.debounceMs);
}

function getModeLabelKey(selectionMode: WidgetSelectionMode) {
    if (selectionMode === 'nearest_memory') {
        return 'widget.modeNearest';
    }

    if (selectionMode === 'photo_memory') {
        return 'widget.modePhoto';
    }

    if (selectionMode === 'shared_memory') {
        return 'widget.modeShared';
    }

    return 'widget.memoryReminder';
}

function getSlotStart(referenceDate: Date) {
    const slotStart = new Date(referenceDate);
    slotStart.setMinutes(0, 0, 0);
    slotStart.setHours(Math.floor(slotStart.getHours() / WIDGET_SLOT_HOURS) * WIDGET_SLOT_HOURS);
    return slotStart;
}

function buildTimelineDates(referenceDate: Date, count = WIDGET_TIMELINE_ENTRY_COUNT) {
    const slotStart = getSlotStart(referenceDate);
    return Array.from({ length: count }, (_, index) => {
        const slotDate = new Date(slotStart);
        slotDate.setHours(slotDate.getHours() + index * WIDGET_SLOT_HOURS);
        return slotDate;
    });
}

function getTranslatedWidgetStrings(
    noteCount: number,
    nearbyPlacesCount = 0,
    selectionMode: WidgetSelectionMode = 'latest_memory'
) {
    const savedCountText = i18n.t(
        noteCount === 1 ? 'widget.countBadgeOne' : 'widget.countBadgeOther',
        { count: noteCount }
    );
    const nearbyPlacesLabelText = i18n.t(
        nearbyPlacesCount === 1 ? 'widget.nearbyPlaceOne' : 'widget.nearbyPlaceOther',
        { count: nearbyPlacesCount }
    );

    return {
        idleText: i18n.t('widget.idleText'),
        savedCountText,
        nearbyPlacesLabelText,
        memoryReminderText: i18n.t(getModeLabelKey(selectionMode)),
        accessorySaveMemoryText: i18n.t('widget.accessorySaveMemory'),
        accessoryAddFirstPlaceText: i18n.t('widget.accessoryAddFirstPlace'),
        accessoryMemoryNearbyText: i18n.t('widget.accessoryMemoryNearby'),
        accessoryOpenAppText: i18n.t('widget.accessoryOpenApp'),
        accessoryAddLabelText: i18n.t('widget.accessoryAddLabel'),
        accessorySavedLabelText: i18n.t('widget.accessorySavedLabel'),
        accessoryNearLabelText: i18n.t('widget.accessoryNearLabel'),
        livePhotoBadgeText: i18n.t('widget.livePhotoBadge'),
    };
}

function buildIdleWidgetProps(noteCount: number, selectionMode: WidgetSelectionMode = 'latest_memory'): WidgetProps {
    return {
        noteType: 'text',
        text: '',
        locationName: '',
        date: '',
        noteCount,
        nearbyPlacesCount: 0,
        isLivePhoto: false,
        isDualCapture: false,
        backgroundGradientStartColor: undefined,
        backgroundGradientEndColor: undefined,
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        isIdleState: true,
        isSharedContent: false,
        authorDisplayName: '',
        authorInitials: '',
        primaryActionUrl: getWidgetPrimaryActionUrl(null, noteCount),
        ...getTranslatedWidgetStrings(noteCount, 0, selectionMode),
    };
}

async function loadLastDeliveredWidgetProps() {
    try {
        const rawValue = await getPersistentItem(WIDGET_LAST_DELIVERED_PROPS_STORAGE_KEY);
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue);
        return isStoredWidgetProps(parsed) ? parsed : null;
    } catch (error) {
        console.warn('[widgetService] Failed to load last delivered widget props:', error);
        return null;
    }
}

async function saveLastDeliveredWidgetProps(props: WidgetProps) {
    try {
        await setPersistentItem(
            WIDGET_LAST_DELIVERED_PROPS_STORAGE_KEY,
            JSON.stringify(sanitizeWidgetPropsForBridge(props))
        );
    } catch (error) {
        console.warn('[widgetService] Failed to persist last delivered widget props:', error);
    }
}

function buildRepeatedWidgetTimeline(props: WidgetProps, referenceDate: Date): WidgetTimelineEntry[] {
    return buildTimelineDates(referenceDate).map((date) => ({
        date,
        props,
    }));
}

function getAuthorInitials(displayName: string | null | undefined) {
    const normalized = typeof displayName === 'string' ? displayName.trim() : '';
    if (!normalized) {
        return '';
    }

    const segments = normalized.split(/\s+/).filter(Boolean);
    if (segments.length === 0) {
        return '';
    }

    return segments
        .slice(0, 2)
        .map((segment) => segment[0]?.toUpperCase() ?? '')
        .join('');
}


async function getSharedWidgetFeedSnapshot(includeSharedRefresh = false): Promise<WidgetSharedFeedSnapshot> {
  const currentUser = await getSupabaseUser();
  if (!currentUser) {
    sharedWidgetFeedCache = null;
    return {
      sharedPosts: [],
    };
  }

  let cachedPosts: SharedPost[] = [];
  try {
    const cachedSnapshot = await getCachedSharedFeedSnapshot(currentUser.id);
    cachedPosts = cachedSnapshot.sharedPosts.filter((post) => post.authorUid !== currentUser.id);
  } catch {
    cachedPosts = [];
  }

  if (!includeSharedRefresh) {
    return {
      sharedPosts: cachedPosts,
    };
  }

  if (
    sharedWidgetFeedCache &&
    sharedWidgetFeedCache.userUid === currentUser.id &&
    Date.now() - sharedWidgetFeedCache.refreshedAt < WIDGET_SHARED_REFRESH_TTL_MS
  ) {
    return sharedWidgetFeedCache.snapshot;
  }

  try {
    const liveSnapshot = await refreshSharedFeed(currentUser);
    const nextSnapshot = {
      sharedPosts: liveSnapshot.sharedPosts.filter((post) => post.authorUid !== currentUser.id),
    };
    sharedWidgetFeedCache = {
      userUid: currentUser.id,
      refreshedAt: Date.now(),
      snapshot: nextSnapshot,
    };
    return nextSnapshot;
  } catch (error) {
    console.warn(
      '[widgetService] Failed to refresh shared widget feed, using cache:',
      getSharedFeedErrorMessage(error)
    );
    return {
      sharedPosts: cachedPosts,
    };
  }
}

async function getWidgetCurrentLocation(includeLocationLookup = true): Promise<LocationCoords | null> {
  if (!includeLocationLookup) {
    return null;
  }

  if (
    widgetLocationCache &&
    Date.now() - widgetLocationCache.fetchedAt < WIDGET_LOCATION_CACHE_TTL_MS
  ) {
    return widgetLocationCache.currentLocation;
  }

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      widgetLocationCache = {
        fetchedAt: Date.now(),
        currentLocation: null,
      };
      return null;
    }

    const lastKnownLocation = await Location.getLastKnownPositionAsync();
    const location =
      lastKnownLocation ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null));
    const currentLocation = location
      ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
      : null;
    widgetLocationCache = {
      fetchedAt: Date.now(),
      currentLocation,
    };
    return currentLocation;
  } catch (error) {
    console.warn('[widgetService] Location fetch failed:', error);
    return null;
  }
}

async function buildWidgetPropsFromSelection(
  noteCount: number,
  selection: WidgetSelectionResult,
  candidate: WidgetCandidate
): Promise<WidgetProps> {
  const resolvedNearbyPlacesCount =
    selection.selectionMode === 'nearest_memory'
      ? Math.max(selection.nearbyPlacesCount, 1)
      : 0;
  const translatedStrings = getTranslatedWidgetStrings(
    noteCount,
    resolvedNearbyPlacesCount,
    selection.selectionMode
  );
  const dateStr = formatDate(candidate.createdAt, 'short');
  const textNoteGradient =
    candidate.noteType === 'text'
      ? getTextNoteCardGradient({
          text: candidate.text.trim(),
          noteId: candidate.id,
          emoji: candidate.moodEmoji,
          noteColor: candidate.noteColor,
        })
      : null;
  const props: WidgetProps = {
    noteType: candidate.noteType,
    text:
      candidate.noteType === 'text'
        ? formatNoteTextWithEmoji(candidate.text.trim(), candidate.moodEmoji)
        : candidate.text.trim(),
    noteColorId: candidate.noteColor ?? undefined,
    locationName:
      selection.selectedLocationName ??
      candidate.locationName ??
      i18n.t('capture.unknownPlace'),
    date: dateStr,
    noteCount,
    nearbyPlacesCount: resolvedNearbyPlacesCount,
    isLivePhoto: candidate.isLivePhoto,
    isDualCapture: false,
    backgroundGradientStartColor: textNoteGradient?.[0],
    backgroundGradientEndColor: textNoteGradient?.[1],
    hasDoodle: candidate.hasDoodle,
    doodleStrokesJson: candidate.doodleStrokesJson ?? null,
    hasStickers: candidate.hasStickers,
    stickerPlacementsJson: null,
    isIdleState: false,
    isSharedContent: candidate.source === 'shared',
    authorDisplayName: candidate.authorDisplayName ?? '',
    authorInitials: getAuthorInitials(candidate.authorDisplayName),
    primaryActionUrl: getWidgetPrimaryActionUrl(candidate, noteCount),
    ...translatedStrings,
  };

  if (candidate.noteType === 'photo') {
    Object.assign(props, await resolveWidgetPhotoProps(candidate));
  }

  if (candidate.hasStickers && candidate.stickerPlacementsJson) {
    props.stickerPlacementsJson = await resolveWidgetStickerPlacementsJson(candidate);
    props.hasStickers = Boolean(props.stickerPlacementsJson);
  }

  Object.assign(props, await resolveWidgetAuthorAvatarProps(candidate));

  return props;
}

function isRenderableWidgetProps(props: WidgetProps) {
    if (props.isIdleState) {
        return true;
    }

    if (props.noteType === 'photo') {
        return Boolean(
            props.backgroundImageUrl?.trim() ||
            props.backgroundImageBase64?.trim()
        );
    }

    return Boolean(
        props.text.trim() ||
        (props.hasDoodle && props.doodleStrokesJson) ||
        (props.hasStickers && props.stickerPlacementsJson)
    );
}

async function buildWidgetTimeline(options: {
  notes: Note[];
  sharedPosts?: SharedPost[];
  currentLocation?: LocationCoords | null;
  referenceDate: Date;
  preferredNoteId?: string | null;
  nearbyRadiusMeters?: number;
}) {
  const {
    notes,
    sharedPosts = [],
    currentLocation = null,
    referenceDate,
    preferredNoteId = null,
    nearbyRadiusMeters,
  } = options;
  const personalCandidates = notes
    .map(createPersonalWidgetCandidate)
    .filter((candidate) => isPhotoWidgetNote(candidate) || isTextWidgetNote(candidate));
  const sharedCandidates = sharedPosts
    .map(createSharedWidgetCandidate)
    .filter((candidate) => isPhotoWidgetNote(candidate) || isTextWidgetNote(candidate));
  const orderedSelections = buildOrderedWidgetSelections({
    personalCandidates,
    sharedCandidates,
    currentLocation,
    nearbyRadiusMeters,
    preferredNoteId,
  });
  const recentCandidateKeys = await loadRecentWidgetCandidateKeys();
  const recentCandidateKeySet = new Set(recentCandidateKeys);
  const firstSelection = orderedSelections[0] ?? null;
  const timelineSelections = firstSelection
    ? [
        firstSelection,
        ...orderedSelections.slice(1).sort((left, right) => {
          const leftSeen = left.selectedCandidate
            ? recentCandidateKeySet.has(left.selectedCandidate.candidateKey)
            : false;
          const rightSeen = right.selectedCandidate
            ? recentCandidateKeySet.has(right.selectedCandidate.candidateKey)
            : false;
          return Number(leftSeen) - Number(rightSeen);
        }),
      ]
    : orderedSelections;
  const renderCache = new Map<string, WidgetProps>();
  const usedCandidateKeys = new Set<string>();
  const deliveredCandidateKeys: string[] = [];
  const entries: WidgetTimelineEntry[] = [];

  for (const date of buildTimelineDates(referenceDate)) {
    let resolvedProps: WidgetProps | null = null;
    let resolvedCandidateKey: string | null = null;

    for (const selection of timelineSelections) {
      const selectedCandidate = selection.selectedCandidate;
      if (selectedCandidate && usedCandidateKeys.has(selectedCandidate.candidateKey)) {
        continue;
      }

      if (!selectedCandidate || selection.isIdleState) {
        resolvedProps = buildIdleWidgetProps(notes.length, selection.selectionMode);
        break;
      }

      const attemptCandidates = [
        selectedCandidate,
        createTextFallbackWidgetCandidate(selectedCandidate),
      ].filter((candidate): candidate is WidgetCandidate => Boolean(candidate));

      for (const candidate of attemptCandidates) {
        const cacheKey = `${candidate.candidateKey}:${candidate.noteType}`;
        const cachedProps = renderCache.get(cacheKey);
        if (cachedProps) {
          resolvedProps = cachedProps;
          resolvedCandidateKey = candidate.candidateKey;
          break;
        }

        try {
          const props = await buildWidgetPropsFromSelection(notes.length, selection, candidate);
          if (isRenderableWidgetProps(props)) {
            renderCache.set(cacheKey, props);
            resolvedProps = props;
            resolvedCandidateKey = candidate.candidateKey;
            break;
          }

          console.warn(
            '[widgetService] Selected widget candidate could not render, trying next candidate:',
            candidate.candidateKey
          );
        } catch (error) {
          console.warn(
            '[widgetService] Failed to build widget props for selected candidate, trying next candidate:',
            getWidgetWarningMessage(error)
          );
        }
      }

      if (resolvedProps) {
        break;
      }
    }

    const nextProps =
      resolvedProps ??
      entries.at(-1)?.props ??
      buildIdleWidgetProps(
        notes.length,
        timelineSelections[0]?.selectionMode ?? 'latest_memory'
      );

    if (resolvedCandidateKey) {
      usedCandidateKeys.add(resolvedCandidateKey);
      deliveredCandidateKeys.push(resolvedCandidateKey);
    }

    entries.push({
      date,
      props: nextProps,
    });
  }

  return {
    entries,
    hasSourceContent: notes.length > 0 || sharedPosts.length > 0,
    deliveredCandidateKeys,
  };
}

async function runWidgetUpdate(options: UpdateWidgetDataOptions = {}): Promise<WidgetUpdateResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      status: 'skipped_platform',
    };
  }

  try {
    const referenceDate = options.referenceDate ?? new Date();
    const noteScope = (await getPersistedActiveNotesScope()) ?? LOCAL_NOTES_SCOPE;
    const notes = options.notes ?? (await getAllNotesForScope(noteScope));
    const sharedFeedSnapshot = await getSharedWidgetFeedSnapshot(
      options.includeSharedRefresh === true
    );
    const currentLocation =
      options.currentLocation !== undefined
        ? options.currentLocation
        : await getWidgetCurrentLocation(options.includeLocationLookup !== false);

    const { entries, hasSourceContent, deliveredCandidateKeys } = await buildWidgetTimeline({
      notes,
      sharedPosts: sharedFeedSnapshot.sharedPosts,
      currentLocation,
      referenceDate,
      preferredNoteId: options.preferredNoteId ?? null,
    });
    const nextProps = entries[0]?.props ?? buildIdleWidgetProps(notes.length);
    const lastDeliveredProps = await loadLastDeliveredWidgetProps();
    let deliveredProps = nextProps;
    let deliveredEntries = entries;
    let nextStatus: WidgetUpdateResult['status'] = 'updated';

    if (
      nextProps.isIdleState &&
      hasSourceContent &&
      lastDeliveredProps &&
      !lastDeliveredProps.isIdleState
    ) {
      console.warn(
        '[widgetService] Widget refresh produced only idle content despite available notes; reusing last delivered widget payload.'
      );
      deliveredProps = lastDeliveredProps;
      deliveredEntries = buildRepeatedWidgetTimeline(lastDeliveredProps, referenceDate);
      nextStatus = 'updated_reused_last_payload';
    }

    const deliverySignature = getPlatformWidgetDeliverySignature(deliveredEntries);
    if (!deliverySignature) {
      return {
        status: 'skipped_platform',
        deliveredProps,
      };
    }

    if (lastPlatformDeliverySignature === deliverySignature) {
      return {
        status: 'skipped_unchanged',
        deliveredProps,
      };
    }

    const deliveryStatus = updatePlatformWidgetTimeline(deliveredEntries);
    if (deliveryStatus !== 'updated') {
      return {
        status: 'skipped_platform',
        deliveredProps,
      };
    }

    lastPlatformDeliverySignature = deliverySignature;
    await saveLastDeliveredWidgetProps(deliveredProps);
    if (deliveredCandidateKeys.length > 0) {
      await saveRecentWidgetCandidateKeys(deliveredCandidateKeys);
    }

    return {
      status: nextStatus,
      deliveredProps,
    };
  } catch (error) {
    const errorMessage = getWidgetWarningMessage(error);
    console.warn('[widgetService] Failed to update widget:', errorMessage);
    return {
      status: 'failed',
      errorMessage,
    };
  }
}

export async function updateWidgetData(
  options: UpdateWidgetDataOptions = {}
): Promise<WidgetUpdateResult> {
    const requestKey = buildWidgetRequestKey(options);
    if (
        !options.referenceDate &&
        requestKey === lastWidgetRequestKey &&
        Date.now() - lastWidgetRequestAt < WIDGET_REQUEST_DEDUPE_WINDOW_MS
    ) {
        return {
          status: 'skipped_duplicate_request',
        };
    }

    if (widgetUpdateInFlight) {
        // Keep only the latest pending request so older explicit payloads like `notes`
        // do not leak into a newer refresh that intended to reload fresh state.
        pendingWidgetUpdateOptions = options;
        await widgetUpdateInFlight;
        return {
          status: 'queued',
        };
    }

    lastWidgetRequestKey = requestKey;
    lastWidgetRequestAt = Date.now();

    widgetUpdateInFlight = runWidgetUpdate(options)
        .finally(async () => {
            widgetUpdateInFlight = null;

            if (!pendingWidgetUpdateOptions) {
                return;
            }

            const nextOptions = pendingWidgetUpdateOptions;
            pendingWidgetUpdateOptions = null;
            await updateWidgetData(nextOptions);
        });

    return await widgetUpdateInFlight;
}

export function scheduleWidgetDataUpdate(
    options: UpdateWidgetDataOptions = {},
    scheduleOptions: ScheduleWidgetDataUpdateOptions = {}
) {
    const debounceMs = scheduleOptions.debounceMs ?? WIDGET_DEFAULT_REFRESH_DEBOUNCE_MS;
    const throttleKey = scheduleOptions.throttleKey?.trim() || null;
    const throttleMs = scheduleOptions.throttleMs ?? 0;
    const now = Date.now();
    const lastThrottleAt = throttleKey ? (widgetRefreshThrottleTimestamps.get(throttleKey) ?? 0) : 0;
    const isThrottled = Boolean(throttleKey && throttleMs > 0 && now - lastThrottleAt < throttleMs);

    if (!scheduledWidgetUpdateRequest && isThrottled) {
        return;
    }

    scheduledWidgetUpdateRequest = {
        options: mergeWidgetUpdateOptions(scheduledWidgetUpdateRequest?.options ?? null, options),
        debounceMs: isThrottled && scheduledWidgetUpdateRequest ? scheduledWidgetUpdateRequest.debounceMs : debounceMs,
        throttleKey: isThrottled && scheduledWidgetUpdateRequest
            ? scheduledWidgetUpdateRequest.throttleKey
            : throttleKey,
        throttleMs: isThrottled && scheduledWidgetUpdateRequest
            ? scheduledWidgetUpdateRequest.throttleMs
            : throttleMs,
    };

    if (isThrottled && scheduledWidgetUpdateTimeout) {
        return;
    }

    schedulePendingWidgetUpdate();
}

export function __resetWidgetServiceForTests() {
    clearScheduledWidgetUpdateTimeout();
    scheduledWidgetUpdateRequest = null;
    widgetRefreshThrottleTimestamps.clear();
    widgetUpdateInFlight = null;
    pendingWidgetUpdateOptions = null;
    lastWidgetRequestKey = null;
    lastWidgetRequestAt = 0;
    lastPlatformDeliverySignature = null;
    sharedWidgetFeedCache = null;
    widgetLocationCache = null;
    __resetWidgetPlatformForTests();
}
