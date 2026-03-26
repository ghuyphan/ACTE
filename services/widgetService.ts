import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { NativeModules, Platform } from 'react-native';
import i18n from '../constants/i18n';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';
import { getSupabaseUser } from '../utils/supabase';
import { formatDate } from '../utils/dateUtils';
import { getAllNotes, Note } from './database';
import { parseNoteStickerPlacements } from './noteStickers';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { getNotePhotoUri, resolveStoredPhotoUri } from './photoStorage';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from './remoteMedia';
import { getDistanceMeters } from './reminderSelection';
import { getCachedSharedFeedSnapshot } from './sharedFeedCache';
import { getSharedFeedErrorMessage, refreshSharedFeed, SharedPost } from './sharedFeedService';

// Lazy import to avoid circular dependency issues
let widgetInstance: WidgetModule | null = null;

export interface WidgetProps {
    noteType: 'text' | 'photo';
    text: string;
    locationName: string;
    date: string;
    noteCount: number;
    nearbyPlacesCount: number;
    backgroundImageUrl?: string; // local file uri
    backgroundImageBase64?: string;
    hasDoodle: boolean;
    doodleStrokesJson?: string | null;
    hasStickers: boolean;
    stickerPlacementsJson?: string | null;
    isIdleState: boolean;
    idleText: string;
    savedCountText: string;
    nearbyPlacesLabelText: string;
    memoryReminderText: string;
    accessorySaveMemoryText: string;
    accessoryAddFirstPlaceText: string;
    accessoryMemoryNearbyText: string;
    accessoryOpenAppText: string;
    accessoryAddLabelText: string;
    accessorySavedLabelText: string;
    accessoryNearLabelText: string;
    isSharedContent: boolean;
    authorDisplayName: string;
    authorInitials: string;
    authorAvatarImageUrl?: string;
    authorAvatarImageBase64?: string;
}

export interface UpdateWidgetDataOptions {
    notes?: Note[];
    includeLocationLookup?: boolean;
    referenceDate?: Date;
    includeSharedRefresh?: boolean;
}

interface LocationCoords {
    latitude: number;
    longitude: number;
}

interface WidgetSelectionResult {
    selectedNote: WidgetCandidate | null;
    selectedCandidate: WidgetCandidate | null;
    selectedLocationName: string | null;
    nearbyPlacesCount: number;
    isIdleState: boolean;
    selectionMode: WidgetSelectionMode;
}

interface WidgetTimelineEntry {
    date: Date;
    props: WidgetProps;
}

interface WidgetHistoryEntry {
    candidateKey: string;
    slotKey: string;
    slotStartedAt: string;
    selectionMode: WidgetSelectionMode;
}

interface EligibleWidgetCandidates {
    personalCandidates: WidgetCandidate[];
    sharedCandidates: WidgetCandidate[];
    readablePhotoUrisByCandidateKey: Map<string, string>;
}

interface WidgetSharedFeedSnapshot {
    currentUserUid: string | null;
    sharedPosts: SharedPost[];
}

interface WidgetCandidate {
    id: string;
    candidateKey: string;
    source: 'personal' | 'shared';
    noteType: 'text' | 'photo';
    text: string;
    photoPath: string | null;
    photoLocalUri: string | null;
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
    createdAt: string;
    updatedAt: string | null;
    isFavorite: boolean;
    hasDoodle: boolean;
    doodleStrokesJson: string | null;
    hasStickers: boolean;
    stickerPlacementsJson: string | null;
    moodEmoji?: string | null;
    authorDisplayName: string | null;
    authorPhotoURLSnapshot: string | null;
}

type WidgetModule = {
    updateTimeline?: (entries: Array<{ date: Date; props: { props: WidgetProps } }>) => void;
};

type AndroidWidgetModule = {
    updateSnapshot?: (snapshotJson: string) => void;
};

type CandidateRepeatPolicy = 'strict' | 'avoid_consecutive' | 'allow_repeat';

type FallbackBucket = {
    mode: WidgetSelectionMode;
    notes: WidgetCandidate[];
};

export type WidgetSelectionMode =
    | 'nearest_memory'
    | 'favorite_photo'
    | 'photo_memory'
    | 'favorite_memory'
    | 'resurfaced_memory'
    | 'shared_photo_memory'
    | 'shared_memory'
    | 'latest_memory';

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_TIMELINE_ENTRY_COUNT = 4;
const WIDGET_SLOT_HOURS = 6;
const WIDGET_RESURFACE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const WIDGET_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const WIDGET_HISTORY_RETENTION_MS = 48 * 60 * 60 * 1000;
const WIDGET_HISTORY_STORAGE_KEY = 'widget.timeline.history.v2';
const MAX_WIDGET_HISTORY_ENTRIES = 32;
const WIDGET_AVATAR_DIRECTORY_NAME = 'widget-avatars';
const WIDGET_STICKER_DIRECTORY_NAME = 'widget-stickers';
let widgetUpdateInFlight: Promise<void> | null = null;
let pendingWidgetUpdateOptions: UpdateWidgetDataOptions | null = null;

function getWidget() {
    if (Platform.OS !== 'ios') {
        return null;
    }

    if (!widgetInstance) {
        try {
            const widgetModule = require('../widgets/LocketWidget') as { default?: unknown };
            const candidate = widgetModule?.default ?? widgetModule;

            if (candidate && typeof (candidate as WidgetModule).updateTimeline === 'function') {
                widgetInstance = candidate;
            } else {
                console.warn('[widgetService] Widget module loaded without updateTimeline');
            }
        } catch (e) {
            console.warn('[widgetService] Could not load widget:', e);
        }
    }
    return widgetInstance;
}

function getAndroidWidgetModule(): AndroidWidgetModule | null {
    if (Platform.OS !== 'android') {
        return null;
    }

    const androidWidgetModule = (NativeModules as { NotoWidgetModule?: AndroidWidgetModule }).NotoWidgetModule;
    return androidWidgetModule ?? null;
}

function sanitizeWidgetPropsForBridge(props: WidgetProps) {
    return Object.fromEntries(
        Object.entries(props).filter(([, value]) => value !== undefined && value !== null)
    ) as WidgetProps;
}

function getWidgetWarningMessage(error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes('hostfunction')) {
        return 'Native widget bridge rejected the timeline update.';
    }

    if (typeof error === 'object' && error && 'message' in error) {
        const message = String((error as { message?: unknown }).message ?? '').trim();
        if (message) {
            return message;
        }
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }

    return 'Unknown widget error';
}

function updatePlatformWidgetTimeline(entries: WidgetTimelineEntry[]) {
    if (entries.length === 0) {
        return;
    }

    if (Platform.OS === 'ios') {
        const widget = getWidget();
        if (!widget?.updateTimeline) {
            return;
        }

        try {
            widget.updateTimeline(entries.map((entry) => ({
                date: entry.date,
                props: { props: sanitizeWidgetPropsForBridge(entry.props) },
            })));
        } catch (error) {
            console.warn('[widgetService] Failed to push iOS widget timeline:', getWidgetWarningMessage(error));
        }
        return;
    }

    if (Platform.OS === 'android') {
        const androidWidgetModule = getAndroidWidgetModule();
        if (!androidWidgetModule?.updateSnapshot) {
            return;
        }

        const firstEntry = entries[0];
        if (!firstEntry) {
            return;
        }

        try {
            androidWidgetModule.updateSnapshot(JSON.stringify(sanitizeWidgetPropsForBridge(firstEntry.props)));
        } catch (error) {
            console.warn('[widgetService] Failed to push Android widget snapshot:', getWidgetWarningMessage(error));
        }
    }
}

function hashString(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash;
}

function getModeLabelKey(selectionMode: WidgetSelectionMode) {
    if (selectionMode === 'nearest_memory') {
        return 'widget.modeNearest';
    }

    if (selectionMode === 'favorite_photo' || selectionMode === 'favorite_memory') {
        return 'widget.modeFavorite';
    }

    if (selectionMode === 'photo_memory') {
        return 'widget.modePhoto';
    }

    if (selectionMode === 'shared_photo_memory' || selectionMode === 'shared_memory') {
        return 'widget.modeShared';
    }

    if (selectionMode === 'resurfaced_memory') {
        return 'widget.modeResurfaced';
    }

    return 'widget.memoryReminder';
}

function getSlotStart(referenceDate: Date) {
    const slotStart = new Date(referenceDate);
    slotStart.setMinutes(0, 0, 0);
    slotStart.setHours(Math.floor(slotStart.getHours() / WIDGET_SLOT_HOURS) * WIDGET_SLOT_HOURS);
    return slotStart;
}

function getSlotKey(referenceDate: Date) {
    const slotStart = getSlotStart(referenceDate);
    const slot = Math.floor(slotStart.getHours() / WIDGET_SLOT_HOURS);
    return `${slotStart.getFullYear()}-${slotStart.getMonth() + 1}-${slotStart.getDate()}-${slot}`;
}

function buildTimelineDates(referenceDate: Date, count = WIDGET_TIMELINE_ENTRY_COUNT) {
    const slotStart = getSlotStart(referenceDate);
    return Array.from({ length: count }, (_, index) => {
        const slotDate = new Date(slotStart);
        slotDate.setHours(slotDate.getHours() + index * WIDGET_SLOT_HOURS);
        return slotDate;
    });
}

function hasRenderableWidgetText(note: Pick<WidgetCandidate, 'noteType' | 'text'>) {
    return note.noteType === 'text' && typeof note.text === 'string' && note.text.trim().length > 0;
}

function isTextWidgetNote(note: WidgetCandidate) {
    return hasRenderableWidgetText(note);
}

function isPhotoWidgetNote(note: WidgetCandidate) {
    return note.noteType === 'photo';
}

function getWidgetSelectionTimestamp(note: Pick<WidgetCandidate, 'createdAt' | 'updatedAt'>) {
    const timestamp = new Date(note.updatedAt ?? note.createdAt ?? 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareRecentWidgetNotes(left: WidgetCandidate, right: WidgetCandidate) {
    const timestampDelta = getWidgetSelectionTimestamp(right) - getWidgetSelectionTimestamp(left);
    if (timestampDelta !== 0) {
        return timestampDelta;
    }

    return left.candidateKey.localeCompare(right.candidateKey);
}

function compareOldestWidgetNotes(left: WidgetCandidate, right: WidgetCandidate) {
    const timestampDelta = getWidgetSelectionTimestamp(left) - getWidgetSelectionTimestamp(right);
    if (timestampDelta !== 0) {
        return timestampDelta;
    }

    return left.candidateKey.localeCompare(right.candidateKey);
}

function compareNearbyWidgetNotes(
    left: { note: WidgetCandidate; distanceMeters: number },
    right: { note: WidgetCandidate; distanceMeters: number }
) {
    const distanceDelta = left.distanceMeters - right.distanceMeters;
    if (distanceDelta !== 0) {
        return distanceDelta;
    }

    return compareRecentWidgetNotes(left.note, right.note);
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
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        isIdleState: true,
        isSharedContent: false,
        authorDisplayName: '',
        authorInitials: '',
        ...getTranslatedWidgetStrings(noteCount, 0, selectionMode),
    };
}

function pruneWidgetHistory(history: WidgetHistoryEntry[], referenceDate = new Date()) {
    const referenceTime = referenceDate.getTime();

    return [...history]
        .filter((entry) => {
            const entryTime = new Date(entry.slotStartedAt).getTime();
            return Number.isFinite(entryTime) && Math.abs(referenceTime - entryTime) <= WIDGET_HISTORY_RETENTION_MS;
        })
        .sort(
            (left, right) =>
                new Date(left.slotStartedAt).getTime() - new Date(right.slotStartedAt).getTime()
        )
        .slice(-MAX_WIDGET_HISTORY_ENTRIES);
}

async function loadWidgetHistory(referenceDate = new Date()) {
    try {
        const rawValue = await getPersistentItem(WIDGET_HISTORY_STORAGE_KEY);
        if (!rawValue) {
            return [] as WidgetHistoryEntry[];
        }

        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            return [] as WidgetHistoryEntry[];
        }

        return pruneWidgetHistory(
            parsed.filter((entry): entry is WidgetHistoryEntry => {
                return Boolean(
                    entry &&
                    typeof entry === 'object' &&
                    typeof entry.candidateKey === 'string' &&
                    typeof entry.slotKey === 'string' &&
                    typeof entry.slotStartedAt === 'string' &&
                    typeof entry.selectionMode === 'string'
                );
            }),
            referenceDate
        );
    } catch (error) {
        console.warn('[widgetService] Failed to load widget history:', error);
        return [] as WidgetHistoryEntry[];
    }
}

async function saveWidgetHistory(history: WidgetHistoryEntry[], referenceDate = new Date()) {
    try {
        await setPersistentItem(
            WIDGET_HISTORY_STORAGE_KEY,
            JSON.stringify(pruneWidgetHistory(history, referenceDate))
        );
    } catch (error) {
        console.warn('[widgetService] Failed to persist widget history:', error);
    }
}

function getPreviousHistoryEntry(history: WidgetHistoryEntry[], referenceDate: Date) {
    const referenceTime = referenceDate.getTime();

    return [...history]
        .filter((entry) => new Date(entry.slotStartedAt).getTime() < referenceTime)
        .sort((left, right) => new Date(right.slotStartedAt).getTime() - new Date(left.slotStartedAt).getTime())[0] ?? null;
}

function hasShownRecently(candidateKey: string, history: WidgetHistoryEntry[], referenceDate: Date) {
    const referenceTime = referenceDate.getTime();

    return history.some((entry) => {
        if (entry.candidateKey !== candidateKey) {
            return false;
        }

        const entryTime = new Date(entry.slotStartedAt).getTime();
        if (!Number.isFinite(entryTime) || entryTime > referenceTime) {
            return false;
        }

        return referenceTime - entryTime < WIDGET_RECENT_WINDOW_MS;
    });
}

function isCandidateAllowed(
    note: WidgetCandidate,
    history: WidgetHistoryEntry[],
    referenceDate: Date,
    repeatPolicy: CandidateRepeatPolicy
) {
    if (repeatPolicy === 'allow_repeat') {
        return true;
    }

    const previousEntry = getPreviousHistoryEntry(history, referenceDate);
    if (previousEntry?.candidateKey === note.candidateKey) {
        return false;
    }

    if (repeatPolicy === 'avoid_consecutive') {
        return true;
    }

    return !hasShownRecently(note.candidateKey, history, referenceDate);
}

function getPersonalFallbackBuckets(notes: WidgetCandidate[], referenceDate: Date): FallbackBucket[] {
    const referenceTime = referenceDate.getTime();

    return [
        {
            mode: 'favorite_photo',
            notes: notes.filter((note) => isPhotoWidgetNote(note) && note.isFavorite).sort(compareRecentWidgetNotes),
        },
        {
            mode: 'photo_memory',
            notes: notes.filter((note) => isPhotoWidgetNote(note) && !note.isFavorite).sort(compareRecentWidgetNotes),
        },
        {
            mode: 'favorite_memory',
            notes: notes.filter((note) => isTextWidgetNote(note) && note.isFavorite).sort(compareRecentWidgetNotes),
        },
        {
            mode: 'resurfaced_memory',
            notes: notes
                .filter((note) => {
                    if (!isTextWidgetNote(note) || note.isFavorite) {
                        return false;
                    }

                    return referenceTime - getWidgetSelectionTimestamp(note) >= WIDGET_RESURFACE_AGE_MS;
                })
                .sort(compareOldestWidgetNotes),
        },
        {
            mode: 'latest_memory',
            notes: notes.sort(compareRecentWidgetNotes),
        },
    ];
}

function getSharedFallbackBuckets(notes: WidgetCandidate[]): FallbackBucket[] {
    return [
        {
            mode: 'shared_photo_memory',
            notes: notes.filter((note) => isPhotoWidgetNote(note)).sort(compareRecentWidgetNotes),
        },
        {
            mode: 'shared_memory',
            notes: notes.filter((note) => isTextWidgetNote(note)).sort(compareRecentWidgetNotes),
        },
    ];
}

function pickFallbackCandidateFromBuckets(
    buckets: FallbackBucket[],
    referenceDate: Date,
    recentHistory: WidgetHistoryEntry[]
): { note: WidgetCandidate; mode: WidgetSelectionMode } | null {
    const repeatPolicies: CandidateRepeatPolicy[] = ['strict', 'avoid_consecutive', 'allow_repeat'];

    for (const repeatPolicy of repeatPolicies) {
        for (const bucket of buckets) {
            const selectedNote = bucket.notes.find((note) =>
                isCandidateAllowed(note, recentHistory, referenceDate, repeatPolicy)
            );

            if (selectedNote) {
                return {
                    note: selectedNote,
                    mode: bucket.mode,
                };
            }
        }
    }

    return null;
}

function pickPersonalFallbackCandidate(
    notes: WidgetCandidate[],
    referenceDate: Date,
    recentHistory: WidgetHistoryEntry[]
): { note: WidgetCandidate; mode: WidgetSelectionMode } | null {
    return pickFallbackCandidateFromBuckets(getPersonalFallbackBuckets(notes, referenceDate), referenceDate, recentHistory);
}

function pickSharedFallbackCandidate(
    notes: WidgetCandidate[],
    referenceDate: Date,
    recentHistory: WidgetHistoryEntry[]
): { note: WidgetCandidate; mode: WidgetSelectionMode } | null {
    return pickFallbackCandidateFromBuckets(getSharedFallbackBuckets(notes), referenceDate, recentHistory);
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

function createPersonalWidgetCandidate(note: Note): WidgetCandidate {
    return {
        id: note.id,
        candidateKey: `personal:${note.id}`,
        source: 'personal',
        noteType: note.type,
        text: note.content,
        photoPath: null,
        photoLocalUri: getNotePhotoUri(note),
        locationName: note.locationName,
        latitude: note.latitude,
        longitude: note.longitude,
        radius: note.radius,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        isFavorite: note.isFavorite,
        hasDoodle: Boolean(note.hasDoodle && note.doodleStrokesJson),
        doodleStrokesJson: note.doodleStrokesJson ?? null,
        hasStickers: Boolean(note.hasStickers && note.stickerPlacementsJson),
        stickerPlacementsJson: note.stickerPlacementsJson ?? null,
        moodEmoji: note.moodEmoji ?? null,
        authorDisplayName: null,
        authorPhotoURLSnapshot: null,
    };
}

function createSharedWidgetCandidate(post: SharedPost): WidgetCandidate {
    return {
        id: post.id,
        candidateKey: `shared:${post.id}`,
        source: 'shared',
        noteType: post.type,
        text: post.text,
        photoPath: post.photoPath ?? null,
        photoLocalUri: post.photoLocalUri,
        locationName: post.placeName,
        latitude: null,
        longitude: null,
        radius: null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        isFavorite: false,
        hasDoodle: Boolean(post.doodleStrokesJson),
        doodleStrokesJson: post.doodleStrokesJson ?? null,
        hasStickers: Boolean(post.hasStickers && post.stickerPlacementsJson),
        stickerPlacementsJson: post.stickerPlacementsJson ?? null,
        authorDisplayName: post.authorDisplayName ?? null,
        authorPhotoURLSnapshot: post.authorPhotoURLSnapshot ?? null,
    };
}

function isWidgetCandidate(value: Note | WidgetCandidate | SharedPost): value is WidgetCandidate {
    return (
        typeof value === 'object' &&
        value !== null &&
        'candidateKey' in value &&
        typeof (value as { candidateKey?: unknown }).candidateKey === 'string'
    );
}

function normalizePersonalCandidates(notes: Array<Note | WidgetCandidate>) {
    return notes.map((note) => (isWidgetCandidate(note) ? note : createPersonalWidgetCandidate(note)));
}

function normalizeSharedCandidates(sharedPosts: Array<SharedPost | WidgetCandidate>) {
    return sharedPosts.map((post) => (isWidgetCandidate(post) ? post : createSharedWidgetCandidate(post)));
}

export function selectWidgetNote(options: {
    notes: Array<Note | WidgetCandidate>;
    sharedPosts?: Array<SharedPost | WidgetCandidate>;
    currentLocation?: LocationCoords | null;
    nearbyRadiusMeters?: number;
    referenceDate?: Date;
    recentHistory?: WidgetHistoryEntry[];
}): WidgetSelectionResult {
    const {
        notes,
        sharedPosts = [],
        currentLocation = null,
        referenceDate = new Date(),
        recentHistory = [],
    } = options;

    if (notes.length === 0 && sharedPosts.length === 0) {
        return {
            selectedNote: null,
            selectedCandidate: null,
            selectedLocationName: null,
            nearbyPlacesCount: 0,
            isIdleState: true,
            selectionMode: 'latest_memory',
        };
    }

    const personalCandidates = normalizePersonalCandidates(notes).filter(
        (note) => isPhotoWidgetNote(note) || isTextWidgetNote(note)
    );
    const sharedCandidates = normalizeSharedCandidates(sharedPosts).filter(
        (note) => isPhotoWidgetNote(note) || isTextWidgetNote(note)
    );

    if (personalCandidates.length === 0 && sharedCandidates.length === 0) {
        return {
            selectedNote: null,
            selectedCandidate: null,
            selectedLocationName: null,
            nearbyPlacesCount: 0,
            isIdleState: true,
            selectionMode: 'latest_memory',
        };
    }

    const nearestCandidates = currentLocation
        ? personalCandidates
            .map((note) => ({
                note,
                distanceMeters: getDistanceMeters(currentLocation, {
                    latitude: note.latitude ?? 0,
                    longitude: note.longitude ?? 0,
                }),
            }))
            .filter((entry) => entry.distanceMeters <= Math.max(1, entry.note.radius ?? 0))
            .sort(compareNearbyWidgetNotes)
        : [];

    if (nearestCandidates.length > 0) {
        return {
            selectedNote: nearestCandidates[0]?.note ?? null,
            selectedCandidate: nearestCandidates[0]?.note ?? null,
            selectedLocationName: nearestCandidates[0]?.note.locationName ?? null,
            nearbyPlacesCount: Math.max(0, nearestCandidates.length - 1),
            isIdleState: false,
            selectionMode: 'nearest_memory',
        };
    }

    const fallbackCandidate =
        personalCandidates.length > 0
            ? pickPersonalFallbackCandidate(personalCandidates, referenceDate, recentHistory)
            : pickSharedFallbackCandidate(sharedCandidates, referenceDate, recentHistory);

    if (!fallbackCandidate) {
        return {
            selectedNote: null,
            selectedCandidate: null,
            selectedLocationName: null,
            nearbyPlacesCount: 0,
            isIdleState: true,
            selectionMode: 'latest_memory',
        };
    }

    return {
        selectedNote: fallbackCandidate.note,
        selectedCandidate: fallbackCandidate.note,
        selectedLocationName: fallbackCandidate.note.locationName ?? null,
        nearbyPlacesCount: 0,
        isIdleState: false,
        selectionMode: fallbackCandidate.mode,
    };
}

function getWidgetSharedContainerUri(): string | null {
    const containers = Paths.appleSharedContainers ?? {};
    const preferredContainer =
        containers[IOS_WIDGET_APP_GROUP_ID] ??
        Object.values(containers)[0];

    if (!preferredContainer?.uri) {
        return null;
    }

    const uri = preferredContainer.uri.startsWith('file://')
        ? preferredContainer.uri
        : `file://${preferredContainer.uri}`;

    return uri.endsWith('/') ? uri : `${uri}/`;
}

async function copyPhotoForWidget(photoUri: string, destinationToken: string): Promise<string | undefined> {
    return copyFileForWidgetContainer(photoUri, WIDGET_IMAGE_DIRECTORY_NAME, destinationToken, 'jpg');
}

function sanitizeWidgetFileExtension(value: string | null | undefined) {
    const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!normalizedValue) {
        return null;
    }

    const withoutDot = normalizedValue.startsWith('.') ? normalizedValue.slice(1) : normalizedValue;
    return /^[a-z0-9]{1,5}$/.test(withoutDot) ? withoutDot : null;
}

function getWidgetFileExtensionFromUri(uri: string) {
    const normalizedUri = uri.split(/[?#]/, 1)[0] ?? '';
    const match = normalizedUri.match(/\.([a-zA-Z0-9]{1,5})$/);
    return sanitizeWidgetFileExtension(match?.[1] ?? null);
}

function getStickerFileExtension(mimeType: string | null | undefined) {
    switch ((mimeType ?? '').trim().toLowerCase()) {
        case 'image/webp':
            return 'webp';
        case 'image/png':
            return 'png';
        default:
            return null;
    }
}

async function copyFileForWidgetContainer(
    fileUri: string,
    destinationDirectoryName: string,
    destinationToken: string,
    extensionHint?: string | null
): Promise<string | undefined> {
    if (Platform.OS !== 'ios') {
        return undefined;
    }

    const sharedContainerUri = getWidgetSharedContainerUri();
    if (!sharedContainerUri) {
        return undefined;
    }

    const normalizedFileUri = typeof fileUri === 'string' ? fileUri.trim() : '';
    if (!normalizedFileUri) {
        return undefined;
    }

    if (normalizedFileUri.startsWith(sharedContainerUri)) {
        return normalizedFileUri;
    }

    const safeToken = destinationToken.replace(/[^a-zA-Z0-9_-]/g, '');
    const destinationDirectory = `${sharedContainerUri}${destinationDirectoryName}/`;
    const resolvedExtension =
        sanitizeWidgetFileExtension(extensionHint) ??
        getWidgetFileExtensionFromUri(normalizedFileUri) ??
        'jpg';
    const destinationPath =
        `${destinationDirectory}${safeToken}-${hashString(normalizedFileUri)}.${resolvedExtension}`;

    try {
        await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });
        await FileSystem.deleteAsync(destinationPath, { idempotent: true });
        await FileSystem.copyAsync({ from: normalizedFileUri, to: destinationPath });
        return destinationPath;
    } catch (error) {
        console.warn('[widgetService] Failed to prepare widget photo:', error);
        return undefined;
    }
}

async function resolveWidgetStickerPlacementsJson(candidate: WidgetCandidate) {
    const parsedPlacements = parseNoteStickerPlacements(candidate.stickerPlacementsJson);
    if (parsedPlacements.length === 0) {
        return null;
    }

    if (Platform.OS !== 'ios') {
        return JSON.stringify(parsedPlacements);
    }

    const widgetPlacements = await Promise.all(
        parsedPlacements.map(async (placement) => {
            const readableStickerUri = await getReadablePhotoUri(placement.asset.localUri);
            if (!readableStickerUri) {
                return placement;
            }

            if (/^https?:\/\//i.test(readableStickerUri)) {
                const downloadedStickerUri = await downloadRemoteImageToWidgetContainer(
                    readableStickerUri,
                    WIDGET_STICKER_DIRECTORY_NAME,
                    `sticker-${candidate.id}-${placement.asset.id}`
                );

                return downloadedStickerUri
                    ? {
                        ...placement,
                        asset: {
                            ...placement.asset,
                            localUri: downloadedStickerUri,
                        },
                    }
                    : placement;
            }

            const copiedStickerUri = await copyFileForWidgetContainer(
                readableStickerUri,
                WIDGET_STICKER_DIRECTORY_NAME,
                `sticker-${candidate.id}-${placement.asset.id}`,
                getStickerFileExtension(placement.asset.mimeType)
            );

            return copiedStickerUri
                ? {
                    ...placement,
                    asset: {
                        ...placement.asset,
                        localUri: copiedStickerUri,
                    },
                }
                : placement;
        })
    );

    return JSON.stringify(widgetPlacements);
}

async function getReadablePhotoUri(photoUri: string): Promise<string | undefined> {
    const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
    if (!normalizedPhotoUri) {
        return undefined;
    }

    if (/^https?:\/\//i.test(normalizedPhotoUri)) {
        return normalizedPhotoUri;
    }

    const candidates = Array.from(
        new Set([
            resolveStoredPhotoUri(normalizedPhotoUri),
            normalizedPhotoUri,
        ].filter(Boolean))
    );

    for (const candidate of candidates) {
        try {
            const info = await FileSystem.getInfoAsync(candidate);
            if (info.exists && !info.isDirectory) {
                return candidate;
            }
        } catch {
            // Try the next candidate.
        }
    }

    console.warn('[widgetService] Widget photo is missing or unreadable:', normalizedPhotoUri);
    return undefined;
}

async function encodePhotoForWidget(photoUri: string): Promise<string | undefined> {
    const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
    if (!normalizedPhotoUri) {
        return undefined;
    }

    try {
        return await FileSystem.readAsStringAsync(normalizedPhotoUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
    } catch (error) {
        console.warn('[widgetService] Failed to encode widget photo:', error);
        return undefined;
    }
}

async function downloadRemoteImageToWidgetContainer(
    remoteImageUrl: string,
    destinationDirectoryName: string,
    destinationToken: string
) {
    const sharedContainerUri = getWidgetSharedContainerUri();
    if (!sharedContainerUri) {
        return undefined;
    }

    const normalizedRemoteImageUrl = remoteImageUrl.trim();
    if (!normalizedRemoteImageUrl) {
        return undefined;
    }

    const safeToken = destinationToken.replace(/[^a-zA-Z0-9_-]/g, '');
    const destinationDirectory = `${sharedContainerUri}${destinationDirectoryName}/`;
    const destinationPath = `${destinationDirectory}${safeToken}-${hashString(normalizedRemoteImageUrl)}.jpg`;

    try {
        await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });

        const existingInfo = await FileSystem.getInfoAsync(destinationPath);
        if (existingInfo.exists && !existingInfo.isDirectory) {
            return destinationPath;
        }

        await FileSystem.downloadAsync(normalizedRemoteImageUrl, destinationPath);
        return destinationPath;
    } catch (error) {
        try {
            const fallbackInfo = await FileSystem.getInfoAsync(destinationPath);
            if (fallbackInfo.exists && !fallbackInfo.isDirectory) {
                return destinationPath;
            }
        } catch {
            // Ignore fallback lookup errors.
        }

        console.warn('[widgetService] Failed to download remote widget image:', error);
        return undefined;
    }
}

async function resolveWidgetAuthorAvatarProps(candidate: WidgetCandidate) {
    if (candidate.source !== 'shared' || !candidate.authorPhotoURLSnapshot?.trim()) {
        return {};
    }

    const readableAvatarUri = await getReadablePhotoUri(candidate.authorPhotoURLSnapshot);
    if (!readableAvatarUri) {
        return {};
    }

    if (/^https?:\/\//i.test(readableAvatarUri)) {
        const downloadedAvatarUri = await downloadRemoteImageToWidgetContainer(
            readableAvatarUri,
            WIDGET_AVATAR_DIRECTORY_NAME,
            `author-${candidate.id}`
        );

        if (downloadedAvatarUri) {
            return {
                authorAvatarImageUrl: downloadedAvatarUri,
            };
        }

        return {};
    }

    const copiedAvatarUri = await copyPhotoForWidget(readableAvatarUri, `author-${candidate.id}`);
    if (copiedAvatarUri) {
        return {
            authorAvatarImageUrl: copiedAvatarUri,
        };
    }

    const avatarBase64 = await encodePhotoForWidget(readableAvatarUri);
    if (avatarBase64) {
        return {
            authorAvatarImageBase64: avatarBase64,
        };
    }

    return {};
}

async function getSharedWidgetFeedSnapshot(includeSharedRefresh = false): Promise<WidgetSharedFeedSnapshot> {
    const currentUser = await getSupabaseUser();
    if (!currentUser) {
        return {
            currentUserUid: null,
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
            currentUserUid: currentUser.id,
            sharedPosts: cachedPosts,
        };
    }

    try {
        const liveSnapshot = await refreshSharedFeed(currentUser);
        return {
            currentUserUid: currentUser.id,
            sharedPosts: liveSnapshot.sharedPosts.filter((post) => post.authorUid !== currentUser.id),
        };
    } catch (error) {
        console.warn(
            '[widgetService] Failed to refresh shared widget feed, using cache:',
            getSharedFeedErrorMessage(error)
        );
        return {
            currentUserUid: currentUser.id,
            sharedPosts: cachedPosts,
        };
    }
}

async function getEligibleWidgetCandidates(
    notes: Note[],
    sharedPosts: SharedPost[]
): Promise<EligibleWidgetCandidates> {
    const personalCandidates: WidgetCandidate[] = [];
    const sharedCandidates: WidgetCandidate[] = [];
    const readablePhotoUrisByCandidateKey = new Map<string, string>();

    for (const note of notes) {
        const candidate = createPersonalWidgetCandidate(note);
        if (isTextWidgetNote(candidate)) {
            personalCandidates.push(candidate);
            continue;
        }

        if (!isPhotoWidgetNote(candidate)) {
            continue;
        }

        const selectedPhotoUri = candidate.photoLocalUri;
        if (!selectedPhotoUri) {
            continue;
        }

        const readablePhotoUri = await getReadablePhotoUri(selectedPhotoUri);
        if (!readablePhotoUri) {
            continue;
        }

        personalCandidates.push(candidate);
        readablePhotoUrisByCandidateKey.set(candidate.candidateKey, readablePhotoUri);
    }

    for (const sharedPost of sharedPosts) {
        const candidate = createSharedWidgetCandidate(sharedPost);
        if (isTextWidgetNote(candidate)) {
            sharedCandidates.push(candidate);
            continue;
        }

        if (!isPhotoWidgetNote(candidate)) {
            continue;
        }

        let readablePhotoUri = candidate.photoLocalUri
            ? await getReadablePhotoUri(candidate.photoLocalUri)
            : undefined;

        if (!readablePhotoUri && candidate.photoPath) {
            const downloadedPhotoUri = await downloadPhotoFromStorage(
                SHARED_POST_MEDIA_BUCKET,
                candidate.photoPath,
                `shared-post-${candidate.id}`
            );
            readablePhotoUri = downloadedPhotoUri
                ? await getReadablePhotoUri(downloadedPhotoUri)
                : undefined;
        }

        if (!readablePhotoUri) {
            continue;
        }

        candidate.photoLocalUri = readablePhotoUri;
        sharedCandidates.push(candidate);
        readablePhotoUrisByCandidateKey.set(candidate.candidateKey, readablePhotoUri);
    }

    return {
        personalCandidates,
        sharedCandidates,
        readablePhotoUrisByCandidateKey,
    };
}

async function resolveWidgetPhotoProps(
    note: WidgetCandidate,
    readablePhotoUri: string | undefined,
    destinationToken: string
): Promise<Pick<WidgetProps, 'backgroundImageUrl' | 'backgroundImageBase64'>> {
    if (note.noteType !== 'photo' || !readablePhotoUri) {
        return {};
    }

    if (/^https?:\/\//i.test(readablePhotoUri)) {
        const downloadedPhotoUri = await downloadRemoteImageToWidgetContainer(
            readablePhotoUri,
            WIDGET_IMAGE_DIRECTORY_NAME,
            destinationToken
        );

        if (downloadedPhotoUri) {
            return {
                backgroundImageUrl: downloadedPhotoUri,
            };
        }
    }

    const copiedPhotoUri = await copyPhotoForWidget(readablePhotoUri, destinationToken);
    if (copiedPhotoUri) {
        return {
            backgroundImageUrl: copiedPhotoUri,
        };
    }

    const photoBase64 = await encodePhotoForWidget(readablePhotoUri);
    if (photoBase64) {
        return {
            backgroundImageBase64: photoBase64,
        };
    }

    return {};
}

function createHistoryEntry(note: WidgetCandidate, referenceDate: Date, selectionMode: WidgetSelectionMode): WidgetHistoryEntry {
    return {
        candidateKey: note.candidateKey,
        slotKey: getSlotKey(referenceDate),
        slotStartedAt: getSlotStart(referenceDate).toISOString(),
        selectionMode,
    };
}

async function buildWidgetPropsFromSelection(
    noteCount: number,
    selection: WidgetSelectionResult,
    referenceDate: Date,
    readablePhotoUrisByCandidateKey: Map<string, string>
): Promise<WidgetProps> {
    const resolvedNearbyPlacesCount =
        selection.selectionMode === 'nearest_memory'
            ? Math.max(selection.nearbyPlacesCount, 1)
            : 0;
    const translatedStrings = getTranslatedWidgetStrings(noteCount, resolvedNearbyPlacesCount, selection.selectionMode);

    if (!selection.selectedCandidate || selection.isIdleState) {
        return {
            ...buildIdleWidgetProps(noteCount, selection.selectionMode),
            ...translatedStrings,
        };
    }

    const selectedNote = selection.selectedCandidate;
    const dateStr = formatDate(selectedNote.createdAt, 'short');
    const props: WidgetProps = {
        noteType: selectedNote.noteType,
        text:
            selectedNote.noteType === 'text'
                ? formatNoteTextWithEmoji(selectedNote.text.trim(), selectedNote.moodEmoji)
                : '',
        locationName: selection.selectedLocationName ?? selectedNote.locationName ?? i18n.t('capture.unknownPlace'),
        date: dateStr,
        noteCount,
        nearbyPlacesCount: resolvedNearbyPlacesCount,
        hasDoodle: selectedNote.hasDoodle,
        doodleStrokesJson: selectedNote.doodleStrokesJson ?? null,
        hasStickers: selectedNote.hasStickers,
        stickerPlacementsJson: null,
        isIdleState: false,
        isSharedContent: selectedNote.source === 'shared',
        authorDisplayName: selectedNote.authorDisplayName ?? '',
        authorInitials: getAuthorInitials(selectedNote.authorDisplayName),
        ...translatedStrings,
    };

    if (selectedNote.noteType === 'photo') {
        Object.assign(
            props,
            await resolveWidgetPhotoProps(
                selectedNote,
                readablePhotoUrisByCandidateKey.get(selectedNote.candidateKey),
                `slot-${getSlotKey(referenceDate)}-note-${selectedNote.candidateKey}`
            )
        );
    }

    if (selectedNote.hasStickers && selectedNote.stickerPlacementsJson) {
        props.stickerPlacementsJson = await resolveWidgetStickerPlacementsJson(selectedNote);
        props.hasStickers = Boolean(props.stickerPlacementsJson);
    }

    Object.assign(props, await resolveWidgetAuthorAvatarProps(selectedNote));

    return props;
}

async function buildWidgetTimeline(options: {
    notes: Note[];
    sharedPosts?: SharedPost[];
    currentLocation?: LocationCoords | null;
    referenceDate: Date;
}) {
    const { notes, sharedPosts = [], currentLocation = null, referenceDate } = options;
    const {
        personalCandidates,
        sharedCandidates,
        readablePhotoUrisByCandidateKey,
    } = await getEligibleWidgetCandidates(notes, sharedPosts);
    const history = await loadWidgetHistory(referenceDate);
    const timelineDates = buildTimelineDates(referenceDate);
    const nextHistory = [...history];
    const entries: WidgetTimelineEntry[] = [];

    if ((notes.length === 0 && sharedPosts.length === 0) || (personalCandidates.length === 0 && sharedCandidates.length === 0)) {
        const idleProps = buildIdleWidgetProps(notes.length);
        for (const date of timelineDates) {
            entries.push({
                date,
                props: idleProps,
            });
        }

        return {
            entries,
            history: nextHistory,
        };
    }

    for (const date of timelineDates) {
        const selection = selectWidgetNote({
            notes: personalCandidates,
            sharedPosts: sharedCandidates,
            currentLocation,
            referenceDate: date,
            recentHistory: nextHistory,
        });

        entries.push({
            date,
            props: await buildWidgetPropsFromSelection(notes.length, selection, date, readablePhotoUrisByCandidateKey),
        });

        if (selection.selectedCandidate && !selection.isIdleState) {
            nextHistory.push(createHistoryEntry(selection.selectedCandidate, date, selection.selectionMode));
        }
    }

    return {
        entries,
        history: pruneWidgetHistory(nextHistory, referenceDate),
    };
}

async function runWidgetUpdate(options: UpdateWidgetDataOptions = {}): Promise<void> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return;
    }

    try {
        const notes = options.notes ?? await getAllNotes();
        const sharedFeedSnapshot = await getSharedWidgetFeedSnapshot(options.includeSharedRefresh === true);

        let currentLocation: Location.LocationObject | null = null;
        if (options.includeLocationLookup !== false) {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    currentLocation = await Location.getLastKnownPositionAsync();
                }
            } catch (e) {
                console.warn('[widgetService] Location fetch failed:', e);
            }
        }

        const { entries, history } = await buildWidgetTimeline({
            notes,
            sharedPosts: sharedFeedSnapshot.sharedPosts,
            currentLocation: currentLocation
                ? {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                }
                : null,
            referenceDate: options.referenceDate ?? new Date(),
        });

        updatePlatformWidgetTimeline(entries);
        await saveWidgetHistory(history, options.referenceDate ?? new Date());
    } catch (error) {
        console.warn('[widgetService] Failed to update widget:', getWidgetWarningMessage(error));
    }
}

export async function updateWidgetData(options: UpdateWidgetDataOptions = {}): Promise<void> {
    if (widgetUpdateInFlight) {
        pendingWidgetUpdateOptions = {
            ...(pendingWidgetUpdateOptions ?? {}),
            ...options,
        };
        await widgetUpdateInFlight;
        return;
    }

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

    await widgetUpdateInFlight;
}
