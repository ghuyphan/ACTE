import { Paths } from 'expo-file-system';
import * as FileSystem from '../utils/fileSystem';
import * as Location from 'expo-location';
import { NativeModules, Platform } from 'react-native';
import i18n from '../constants/i18n';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';
import { getSupabaseUser } from '../utils/supabase';
import { formatDate } from '../utils/dateUtils';
import {
    getAllNotesForScope,
    getPersistedActiveNotesScope,
    LOCAL_NOTES_SCOPE,
    Note,
} from './database';
import { getTextNoteCardGradient } from './noteAppearance';
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
    noteColorId?: string;
    locationName: string;
    date: string;
    noteCount: number;
    nearbyPlacesCount: number;
    isLivePhoto: boolean;
    backgroundImageUrl?: string; // local file uri
    backgroundImageBase64?: string;
    backgroundGradientStartColor?: string;
    backgroundGradientEndColor?: string;
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
    livePhotoBadgeText: string;
    isSharedContent: boolean;
    authorDisplayName: string;
    authorInitials: string;
    authorAvatarImageUrl?: string;
    authorAvatarImageBase64?: string;
    primaryActionUrl: string;
    badgeActionUrl?: string;
}

export interface UpdateWidgetDataOptions {
    notes?: Note[];
    includeLocationLookup?: boolean;
    referenceDate?: Date;
    includeSharedRefresh?: boolean;
    currentLocation?: LocationCoords | null;
    preferredNoteId?: string | null;
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
    isLivePhoto: boolean;
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
    createdAt: string;
    updatedAt: string | null;
    hasDoodle: boolean;
    doodleStrokesJson: string | null;
    hasStickers: boolean;
    stickerPlacementsJson: string | null;
    moodEmoji?: string | null;
    noteColor?: string | null;
    authorDisplayName: string | null;
    authorPhotoURLSnapshot: string | null;
}

type WidgetModule = {
    updateTimeline?: (entries: Array<{ date: Date; props: { props: WidgetProps } }>) => void;
};

type AndroidWidgetModule = {
    updateSnapshot?: (snapshotJson: string) => void;
};

export type WidgetSelectionMode =
    | 'nearest_memory'
    | 'photo_memory'
    | 'shared_memory'
    | 'latest_memory';

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_URL_SCHEME = 'noto://';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_TIMELINE_ENTRY_COUNT = 4;
const WIDGET_SLOT_HOURS = 6;
const WIDGET_LAST_DELIVERED_PROPS_STORAGE_KEY = 'widget.timeline.lastDeliveredProps.v2';
const WIDGET_AVATAR_DIRECTORY_NAME = 'widget-avatars';
const WIDGET_STICKER_DIRECTORY_NAME = 'widget-stickers';
const WIDGET_SHARED_REFRESH_TTL_MS = 2 * 60 * 1000;
const WIDGET_LOCATION_CACHE_TTL_MS = 60 * 1000;
const WIDGET_REQUEST_DEDUPE_WINDOW_MS = 3 * 1000;
let widgetUpdateInFlight: Promise<void> | null = null;
let pendingWidgetUpdateOptions: UpdateWidgetDataOptions | null = null;
let lastWidgetRequestKey: string | null = null;
let lastWidgetRequestAt = 0;
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

function getWidgetBadgeActionUrl(noteCount: number) {
    return noteCount > 0 ? buildWidgetUrl('/notes') : undefined;
}

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

function hasRenderableWidgetVisuals(
    note: Pick<WidgetCandidate, 'hasDoodle' | 'doodleStrokesJson' | 'hasStickers' | 'stickerPlacementsJson'>
) {
    return Boolean(
        (note.hasDoodle && note.doodleStrokesJson) ||
        (note.hasStickers && note.stickerPlacementsJson)
    );
}

function isTextWidgetNote(note: WidgetCandidate) {
    return note.noteType === 'text' && (hasRenderableWidgetText(note) || hasRenderableWidgetVisuals(note));
}

function isPhotoWidgetNote(note: WidgetCandidate) {
    return note.noteType === 'photo';
}

function getWidgetCandidateTimestamp(note: Pick<WidgetCandidate, 'createdAt' | 'updatedAt'>) {
    const timestamp = new Date(note.updatedAt ?? note.createdAt ?? 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareCandidatesByNewest(left: WidgetCandidate, right: WidgetCandidate) {
    const timestampDelta = getWidgetCandidateTimestamp(right) - getWidgetCandidateTimestamp(left);
    if (timestampDelta !== 0) {
        return timestampDelta;
    }

    return left.candidateKey.localeCompare(right.candidateKey);
}

function hasWidgetCandidateCoordinates(candidate: WidgetCandidate): candidate is WidgetCandidate & {
    latitude: number;
    longitude: number;
} {
    return Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
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
        badgeActionUrl: getWidgetBadgeActionUrl(noteCount),
        ...getTranslatedWidgetStrings(noteCount, 0, selectionMode),
    };
}

function isStoredWidgetProps(value: unknown): value is WidgetProps {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'noteType' in value &&
        'text' in value &&
        'isIdleState' in value
    );
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

function getPreferredWidgetCandidate(
    personalCandidates: WidgetCandidate[],
    sharedCandidates: WidgetCandidate[],
    preferredNoteId: string | null
) {
    if (!preferredNoteId) {
        return null;
    }

    return (
        personalCandidates.find((candidate) => candidate.id === preferredNoteId) ??
        sharedCandidates.find((candidate) => candidate.id === preferredNoteId) ??
        null
    );
}

function getSelectionModeForCandidate(candidate: WidgetCandidate): WidgetSelectionMode {
    if (candidate.source === 'shared') {
        return 'shared_memory';
    }
    if (candidate.noteType === 'photo') {
        return 'photo_memory';
    }
    return 'latest_memory';
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

function createTextFallbackWidgetCandidate(candidate: WidgetCandidate): WidgetCandidate | null {
    const fallbackText = candidate.text.trim();
    if (!fallbackText) {
        return null;
    }

    return {
        ...candidate,
        noteType: 'text',
        text: fallbackText,
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
    };
}

function createPersonalWidgetCandidate(note: Note): WidgetCandidate {
    return {
        id: note.id,
        candidateKey: `personal:${note.id}`,
        source: 'personal',
        noteType: note.type,
        text: note.type === 'photo' ? (note.caption ?? '') : note.content,
        photoPath: null,
        photoLocalUri: getNotePhotoUri(note),
        isLivePhoto: Boolean(note.type === 'photo' && note.isLivePhoto),
        locationName: note.locationName,
        latitude: note.latitude,
        longitude: note.longitude,
        radius: note.radius,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        hasDoodle: Boolean(note.hasDoodle && note.doodleStrokesJson),
        doodleStrokesJson: note.doodleStrokesJson ?? null,
        hasStickers: Boolean(note.hasStickers && note.stickerPlacementsJson),
        stickerPlacementsJson: note.stickerPlacementsJson ?? null,
        moodEmoji: note.moodEmoji ?? null,
        noteColor: note.noteColor ?? null,
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
        isLivePhoto: Boolean(post.type === 'photo' && post.isLivePhoto),
        locationName: post.placeName,
        latitude: null,
        longitude: null,
        radius: null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        hasDoodle: Boolean(post.doodleStrokesJson),
        doodleStrokesJson: post.doodleStrokesJson ?? null,
        hasStickers: Boolean(post.hasStickers && post.stickerPlacementsJson),
        stickerPlacementsJson: post.stickerPlacementsJson ?? null,
        noteColor: post.noteColor ?? null,
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
    recentHistory?: unknown[];
    preferredNoteId?: string | null;
}): WidgetSelectionResult {
    const {
        notes,
        sharedPosts = [],
        currentLocation = null,
        nearbyRadiusMeters,
        preferredNoteId = null,
    } = options;

    const personalCandidates = normalizePersonalCandidates(notes).filter(
        (note) => isPhotoWidgetNote(note) || isTextWidgetNote(note)
    );
    const sharedCandidates = normalizeSharedCandidates(sharedPosts).filter(
        (note) => isPhotoWidgetNote(note) || isTextWidgetNote(note)
    );

    return (
        buildOrderedWidgetSelections({
            personalCandidates,
            sharedCandidates,
            currentLocation,
            nearbyRadiusMeters,
            preferredNoteId,
        })[0] ?? createWidgetSelectionResult(null, 'latest_memory')
    );
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

function getWidgetFileContainerUri(): string | null {
    if (Platform.OS === 'ios') {
        return getWidgetSharedContainerUri();
    }

    if (Platform.OS === 'android') {
        return FileSystem.cacheDirectory;
    }

    return null;
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
    const containerUri = getWidgetFileContainerUri();
    if (!containerUri) {
        return undefined;
    }

    const normalizedFileUri = typeof fileUri === 'string' ? fileUri.trim() : '';
    if (!normalizedFileUri) {
        return undefined;
    }

    if (normalizedFileUri.startsWith(containerUri)) {
        return normalizedFileUri;
    }

    const safeToken = destinationToken.replace(/[^a-zA-Z0-9_-]/g, '');
    const destinationDirectory = `${containerUri}${destinationDirectoryName}/`;
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

    // Widget surfaces should match the capture card's fully opaque sticker/stamp rendering.
    const widgetPlacementsBase = parsedPlacements.map((placement) => ({
        ...placement,
        opacity: 1,
    }));

    if (Platform.OS !== 'ios') {
        return JSON.stringify(widgetPlacementsBase);
    }

    const widgetPlacements = await Promise.all(
        widgetPlacementsBase.map(async (placement) => {
            const readableStickerUri = await getReadablePhotoUri(placement.asset.localUri);
            if (!readableStickerUri) {
                const existingSharedStickerUri = await findExistingWidgetFileInSharedContainer(
                    WIDGET_STICKER_DIRECTORY_NAME,
                    `sticker-${candidate.id}-${placement.asset.id}-`
                );

                return existingSharedStickerUri
                    ? {
                        ...placement,
                        asset: {
                            ...placement.asset,
                            localUri: existingSharedStickerUri,
                        },
                    }
                    : placement;
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
    const containerUri = getWidgetFileContainerUri();
    if (!containerUri) {
        return undefined;
    }

    const normalizedRemoteImageUrl = remoteImageUrl.trim();
    if (!normalizedRemoteImageUrl) {
        return undefined;
    }

    const safeToken = destinationToken.replace(/[^a-zA-Z0-9_-]/g, '');
    const destinationDirectory = `${containerUri}${destinationDirectoryName}/`;
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

async function findExistingWidgetFileInSharedContainer(
    directoryName: string,
    filenamePrefix: string
) {
    const containerUri = getWidgetFileContainerUri();
    if (!containerUri) {
        return undefined;
    }

    const directoryUri = `${containerUri}${directoryName}/`;

    try {
        const entries = await FileSystem.readDirectoryAsync(directoryUri);
        const matchingEntry = entries.find((entry) => entry.startsWith(filenamePrefix));
        return matchingEntry ? `${directoryUri}${matchingEntry}` : undefined;
    } catch {
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
        sharedWidgetFeedCache = null;
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
            currentUserUid: currentUser.id,
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
            currentUserUid: currentUser.id,
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

        const location = await Location.getLastKnownPositionAsync();
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
    } catch (e) {
        console.warn('[widgetService] Location fetch failed:', e);
        return null;
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
            const textFallbackCandidate = createTextFallbackWidgetCandidate(candidate);
            if (textFallbackCandidate) {
                personalCandidates.push(textFallbackCandidate);
            }
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
            const textFallbackCandidate = createTextFallbackWidgetCandidate(candidate);
            if (textFallbackCandidate) {
                sharedCandidates.push(textFallbackCandidate);
            }
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

function getWidgetPropsSignature(props: WidgetProps) {
    return JSON.stringify(sanitizeWidgetPropsForBridge(props));
}

function buildNearbyPersonalCandidates(
    personalCandidates: WidgetCandidate[],
    currentLocation: LocationCoords | null,
    nearbyRadiusMeters?: number
) {
    if (!currentLocation) {
        return [] as WidgetCandidate[];
    }

    return [...personalCandidates]
        .filter(hasWidgetCandidateCoordinates)
        .filter((candidate) => {
            const allowedDistance = Math.max(1, nearbyRadiusMeters ?? candidate.radius ?? 1);
            return getDistanceMeters(currentLocation, {
                latitude: candidate.latitude,
                longitude: candidate.longitude,
            }) <= allowedDistance;
        })
        .sort((left, right) => {
            const timestampDelta = compareCandidatesByNewest(left, right);
            if (timestampDelta !== 0) {
                return timestampDelta;
            }

            return getDistanceMeters(currentLocation, {
                latitude: left.latitude,
                longitude: left.longitude,
            }) - getDistanceMeters(currentLocation, {
                latitude: right.latitude,
                longitude: right.longitude,
            });
        });
}

function createWidgetSelectionResult(
    candidate: WidgetCandidate | null,
    selectionMode: WidgetSelectionMode,
    nearbyPlacesCount = 0
): WidgetSelectionResult {
    return {
        selectedNote: candidate,
        selectedCandidate: candidate,
        selectedLocationName: candidate?.locationName ?? null,
        nearbyPlacesCount,
        isIdleState: !candidate,
        selectionMode,
    };
}

function buildOrderedWidgetSelections(options: {
    personalCandidates: WidgetCandidate[];
    sharedCandidates: WidgetCandidate[];
    currentLocation: LocationCoords | null;
    nearbyRadiusMeters?: number;
    preferredNoteId?: string | null;
}) {
    const {
        personalCandidates,
        sharedCandidates,
        currentLocation,
        nearbyRadiusMeters,
        preferredNoteId = null,
    } = options;

    const nearbyCandidates = buildNearbyPersonalCandidates(
        personalCandidates,
        currentLocation,
        nearbyRadiusMeters
    );
    const nearbyPlacesCount = Math.max(0, nearbyCandidates.length - 1);
    const orderedSelections: WidgetSelectionResult[] = [];
    const seenCandidateKeys = new Set<string>();
    const addCandidate = (candidate: WidgetCandidate | null, selectionMode: WidgetSelectionMode, nextNearbyPlacesCount = 0) => {
        if (!candidate || seenCandidateKeys.has(candidate.candidateKey)) {
            return;
        }

        seenCandidateKeys.add(candidate.candidateKey);
        orderedSelections.push(createWidgetSelectionResult(candidate, selectionMode, nextNearbyPlacesCount));
    };

    const preferredCandidate = getPreferredWidgetCandidate(personalCandidates, sharedCandidates, preferredNoteId);
    if (preferredCandidate) {
        const preferredIsNearby = nearbyCandidates.some(
            (candidate) => candidate.candidateKey === preferredCandidate.candidateKey
        );
        addCandidate(
            preferredCandidate,
            preferredIsNearby ? 'nearest_memory' : getSelectionModeForCandidate(preferredCandidate),
            preferredIsNearby ? nearbyPlacesCount : 0
        );
    }

    for (const candidate of nearbyCandidates) {
        addCandidate(candidate, 'nearest_memory', nearbyPlacesCount);
    }

    for (const candidate of [...personalCandidates].sort(compareCandidatesByNewest)) {
        addCandidate(candidate, getSelectionModeForCandidate(candidate));
    }

    for (const candidate of [...sharedCandidates].sort(compareCandidatesByNewest)) {
        addCandidate(candidate, 'shared_memory');
    }

    if (orderedSelections.length === 0) {
        orderedSelections.push(createWidgetSelectionResult(null, 'latest_memory'));
    }

    return orderedSelections;
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
    const textNoteGradient =
        selectedNote.noteType === 'text'
            ? getTextNoteCardGradient({
                text: selectedNote.text.trim(),
                noteId: selectedNote.id,
                emoji: selectedNote.moodEmoji,
                noteColor: selectedNote.noteColor,
              })
            : null;
    const props: WidgetProps = {
        noteType: selectedNote.noteType,
        text:
            selectedNote.noteType === 'text'
                ? formatNoteTextWithEmoji(selectedNote.text.trim(), selectedNote.moodEmoji)
                : selectedNote.text.trim(),
        noteColorId: selectedNote.noteColor ?? undefined,
        locationName: selection.selectedLocationName ?? selectedNote.locationName ?? i18n.t('capture.unknownPlace'),
        date: dateStr,
        noteCount,
        nearbyPlacesCount: resolvedNearbyPlacesCount,
        isLivePhoto: selectedNote.isLivePhoto,
        backgroundGradientStartColor: textNoteGradient?.[0],
        backgroundGradientEndColor: textNoteGradient?.[1],
        hasDoodle: selectedNote.hasDoodle,
        doodleStrokesJson: selectedNote.doodleStrokesJson ?? null,
        hasStickers: selectedNote.hasStickers,
        stickerPlacementsJson: null,
        isIdleState: false,
        isSharedContent: selectedNote.source === 'shared',
        authorDisplayName: selectedNote.authorDisplayName ?? '',
        authorInitials: getAuthorInitials(selectedNote.authorDisplayName),
        primaryActionUrl: getWidgetPrimaryActionUrl(selectedNote, noteCount),
        badgeActionUrl: getWidgetBadgeActionUrl(noteCount),
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
    const {
        personalCandidates,
        sharedCandidates,
        readablePhotoUrisByCandidateKey,
    } = await getEligibleWidgetCandidates(notes, sharedPosts);
    const orderedSelections = buildOrderedWidgetSelections({
        personalCandidates,
        sharedCandidates,
        currentLocation,
        nearbyRadiusMeters,
        preferredNoteId,
    });
    let resolvedProps = buildIdleWidgetProps(notes.length);

    for (const selection of orderedSelections) {
        if (!selection.selectedCandidate || selection.isIdleState) {
            resolvedProps = buildIdleWidgetProps(notes.length, selection.selectionMode);
            break;
        }

        try {
            const props = await buildWidgetPropsFromSelection(
                notes.length,
                selection,
                referenceDate,
                readablePhotoUrisByCandidateKey
            );

            if (isRenderableWidgetProps(props)) {
                resolvedProps = props;
                break;
            }

            console.warn(
                '[widgetService] Selected widget candidate could not render, trying next candidate:',
                selection.selectedCandidate.candidateKey
            );
        } catch (error) {
            console.warn(
                '[widgetService] Failed to build widget props for selected candidate, trying next candidate:',
                getWidgetWarningMessage(error)
            );
        }
    }

    return {
        entries: buildRepeatedWidgetTimeline(resolvedProps, referenceDate),
        hasSourceContent: notes.length > 0 || sharedPosts.length > 0,
    };
}

async function runWidgetUpdate(options: UpdateWidgetDataOptions = {}): Promise<void> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return;
    }

    try {
        const referenceDate = options.referenceDate ?? new Date();
        const noteScope = (await getPersistedActiveNotesScope()) ?? LOCAL_NOTES_SCOPE;
        const notes = options.notes ?? await getAllNotesForScope(noteScope);
        const sharedFeedSnapshot = await getSharedWidgetFeedSnapshot(options.includeSharedRefresh === true);
        const currentLocation =
            options.currentLocation !== undefined
                ? options.currentLocation
                : await getWidgetCurrentLocation(options.includeLocationLookup !== false);

        const { entries, hasSourceContent } = await buildWidgetTimeline({
            notes,
            sharedPosts: sharedFeedSnapshot.sharedPosts,
            currentLocation,
            referenceDate,
            preferredNoteId: options.preferredNoteId ?? null,
        });
        const nextProps = entries[0]?.props ?? buildIdleWidgetProps(notes.length);
        const lastDeliveredProps = await loadLastDeliveredWidgetProps();
        let deliveredProps = nextProps;

        if (nextProps.isIdleState && hasSourceContent && lastDeliveredProps && !lastDeliveredProps.isIdleState) {
            console.warn(
                '[widgetService] Widget refresh produced only idle content despite available notes; reusing last delivered widget payload.'
            );
            deliveredProps = lastDeliveredProps;
        }

        const lastDeliveredSignature = lastDeliveredProps
            ? getWidgetPropsSignature(lastDeliveredProps)
            : null;
        const nextSignature = getWidgetPropsSignature(deliveredProps);

        if (lastDeliveredSignature === nextSignature) {
            return;
        }

        updatePlatformWidgetTimeline(buildRepeatedWidgetTimeline(deliveredProps, referenceDate));
        await saveLastDeliveredWidgetProps(deliveredProps);
    } catch (error) {
        console.warn('[widgetService] Failed to update widget:', getWidgetWarningMessage(error));
    }
}

export async function updateWidgetData(options: UpdateWidgetDataOptions = {}): Promise<void> {
    const requestKey = buildWidgetRequestKey(options);
    if (
        !options.referenceDate &&
        requestKey === lastWidgetRequestKey &&
        Date.now() - lastWidgetRequestAt < WIDGET_REQUEST_DEDUPE_WINDOW_MS
    ) {
        return;
    }

    if (widgetUpdateInFlight) {
        // Keep only the latest pending request so older explicit payloads like `notes`
        // do not leak into a newer refresh that intended to reload fresh state.
        pendingWidgetUpdateOptions = options;
        await widgetUpdateInFlight;
        return;
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

    await widgetUpdateInFlight;
}
