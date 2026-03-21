import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { NativeModules, Platform } from 'react-native';
import i18n from '../constants/i18n';
import { formatDate } from '../utils/dateUtils';
import { getAllNotes, Note } from './database';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { getNotePhotoUri, resolveStoredPhotoUri } from './photoStorage';
import { getDistanceMeters } from './reminderSelection';

// Lazy import to avoid circular dependency issues
let widgetInstance: any = null;

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
}

export interface UpdateWidgetDataOptions {
    notes?: Note[];
    includeLocationLookup?: boolean;
    referenceDate?: Date;
}

interface LocationCoords {
    latitude: number;
    longitude: number;
}

interface WidgetSelectionResult {
    selectedNote: Note | null;
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
    noteId: string;
    slotKey: string;
    slotStartedAt: string;
    selectionMode: WidgetSelectionMode;
}

interface EligibleWidgetNotes {
    notes: Note[];
    readablePhotoUrisByNoteId: Map<string, string>;
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
    notes: Note[];
};

export type WidgetSelectionMode =
    | 'nearest_memory'
    | 'favorite_photo'
    | 'photo_memory'
    | 'favorite_memory'
    | 'resurfaced_memory'
    | 'latest_memory';

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_TIMELINE_ENTRY_COUNT = 4;
const WIDGET_SLOT_HOURS = 6;
const WIDGET_RESURFACE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const WIDGET_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const WIDGET_HISTORY_RETENTION_MS = 48 * 60 * 60 * 1000;
const WIDGET_HISTORY_STORAGE_KEY = 'widget.timeline.history.v1';
const MAX_WIDGET_HISTORY_ENTRIES = 32;

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

function updatePlatformWidgetTimeline(entries: WidgetTimelineEntry[]) {
    if (entries.length === 0) {
        return;
    }

    if (Platform.OS === 'ios') {
        const widget = getWidget();
        if (!widget?.updateTimeline) {
            return;
        }

        widget.updateTimeline(entries.map((entry) => ({
            date: entry.date,
            props: { props: entry.props },
        })));
        return;
    }

    if (Platform.OS === 'android') {
        const androidWidgetModule = getAndroidWidgetModule();
        if (!androidWidgetModule?.updateSnapshot) {
            return;
        }

        try {
            androidWidgetModule.updateSnapshot(JSON.stringify(entries[0]?.props ?? null));
        } catch (error) {
            console.warn('[widgetService] Failed to push Android widget snapshot:', error);
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

function hasRenderableWidgetText(note: Pick<Note, 'type' | 'content'>) {
    return note.type === 'text' && typeof note.content === 'string' && note.content.trim().length > 0;
}

function isTextWidgetNote(note: Note) {
    return hasRenderableWidgetText(note);
}

function isPhotoWidgetNote(note: Note) {
    return note.type === 'photo';
}

function getWidgetSelectionTimestamp(note: Pick<Note, 'createdAt' | 'updatedAt'>) {
    const timestamp = new Date(note.updatedAt ?? note.createdAt ?? 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareRecentWidgetNotes(left: Note, right: Note) {
    const timestampDelta = getWidgetSelectionTimestamp(right) - getWidgetSelectionTimestamp(left);
    if (timestampDelta !== 0) {
        return timestampDelta;
    }

    return left.id.localeCompare(right.id);
}

function compareOldestWidgetNotes(left: Note, right: Note) {
    const timestampDelta = getWidgetSelectionTimestamp(left) - getWidgetSelectionTimestamp(right);
    if (timestampDelta !== 0) {
        return timestampDelta;
    }

    return left.id.localeCompare(right.id);
}

function compareNearbyWidgetNotes(
    left: { note: Note; distanceMeters: number },
    right: { note: Note; distanceMeters: number }
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
        isIdleState: true,
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
        const rawValue = await AsyncStorage.getItem(WIDGET_HISTORY_STORAGE_KEY);
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
                    typeof entry.noteId === 'string' &&
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
        await AsyncStorage.setItem(
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

function hasShownRecently(noteId: string, history: WidgetHistoryEntry[], referenceDate: Date) {
    const referenceTime = referenceDate.getTime();

    return history.some((entry) => {
        if (entry.noteId !== noteId) {
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
    note: Note,
    history: WidgetHistoryEntry[],
    referenceDate: Date,
    repeatPolicy: CandidateRepeatPolicy
) {
    if (repeatPolicy === 'allow_repeat') {
        return true;
    }

    const previousEntry = getPreviousHistoryEntry(history, referenceDate);
    if (previousEntry?.noteId === note.id) {
        return false;
    }

    if (repeatPolicy === 'avoid_consecutive') {
        return true;
    }

    return !hasShownRecently(note.id, history, referenceDate);
}

function getFallbackBuckets(notes: Note[], referenceDate: Date): FallbackBucket[] {
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
            notes: [...notes].sort(compareRecentWidgetNotes),
        },
    ];
}

function pickFallbackCandidate(
    notes: Note[],
    referenceDate: Date,
    recentHistory: WidgetHistoryEntry[]
): { note: Note; mode: WidgetSelectionMode } | null {
    const buckets = getFallbackBuckets(notes, referenceDate);
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

export function selectWidgetNote(options: {
    notes: Note[];
    currentLocation?: LocationCoords | null;
    nearbyRadiusMeters?: number;
    referenceDate?: Date;
    recentHistory?: WidgetHistoryEntry[];
}): WidgetSelectionResult {
    const {
        notes,
        currentLocation = null,
        referenceDate = new Date(),
        recentHistory = [],
    } = options;

    if (notes.length === 0) {
        return {
            selectedNote: null,
            selectedLocationName: null,
            nearbyPlacesCount: 0,
            isIdleState: true,
            selectionMode: 'latest_memory',
        };
    }

    const selectableNotes = notes.filter((note) => isPhotoWidgetNote(note) || isTextWidgetNote(note));

    if (selectableNotes.length === 0) {
        return {
            selectedNote: null,
            selectedLocationName: null,
            nearbyPlacesCount: 0,
            isIdleState: true,
            selectionMode: 'latest_memory',
        };
    }

    const nearestCandidates = currentLocation
        ? selectableNotes
            .map((note) => ({
                note,
                distanceMeters: getDistanceMeters(currentLocation, {
                    latitude: note.latitude,
                    longitude: note.longitude,
                }),
            }))
            .filter((entry) => entry.distanceMeters <= Math.max(1, entry.note.radius))
            .sort(compareNearbyWidgetNotes)
        : [];

    if (nearestCandidates.length > 0) {
        return {
            selectedNote: nearestCandidates[0]?.note ?? null,
            selectedLocationName: nearestCandidates[0]?.note.locationName ?? null,
            nearbyPlacesCount: Math.max(0, nearestCandidates.length - 1),
            isIdleState: false,
            selectionMode: 'nearest_memory',
        };
    }

    const fallbackCandidate = pickFallbackCandidate(selectableNotes, referenceDate, recentHistory);

    if (!fallbackCandidate) {
        return {
            selectedNote: null,
            selectedLocationName: null,
            nearbyPlacesCount: 0,
            isIdleState: true,
            selectionMode: 'latest_memory',
        };
    }

    return {
        selectedNote: fallbackCandidate.note,
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
    if (Platform.OS !== 'ios') {
        return undefined;
    }

    const sharedContainerUri = getWidgetSharedContainerUri();
    if (!sharedContainerUri) {
        return undefined;
    }

    const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
    if (!normalizedPhotoUri) {
        return undefined;
    }

    if (normalizedPhotoUri.startsWith(sharedContainerUri)) {
        return normalizedPhotoUri;
    }

    const safeToken = destinationToken.replace(/[^a-zA-Z0-9_-]/g, '');
    const destinationDirectory = `${sharedContainerUri}${WIDGET_IMAGE_DIRECTORY_NAME}/`;
    const destinationPath = `${destinationDirectory}${safeToken}-${hashString(normalizedPhotoUri)}.jpg`;

    try {
        await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });
        await FileSystem.deleteAsync(destinationPath, { idempotent: true });
        await FileSystem.copyAsync({ from: normalizedPhotoUri, to: destinationPath });
        return destinationPath;
    } catch (error) {
        console.warn('[widgetService] Failed to prepare widget photo:', error);
        return undefined;
    }
}

async function getReadablePhotoUri(photoUri: string): Promise<string | undefined> {
    const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
    if (!normalizedPhotoUri) {
        return undefined;
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

async function getEligibleWidgetNotes(notes: Note[]): Promise<EligibleWidgetNotes> {
    const eligibleNotes: Note[] = [];
    const readablePhotoUrisByNoteId = new Map<string, string>();

    for (const note of notes) {
        if (isTextWidgetNote(note)) {
            eligibleNotes.push(note);
            continue;
        }

        if (!isPhotoWidgetNote(note)) {
            continue;
        }

        const selectedPhotoUri = getNotePhotoUri(note);
        if (!selectedPhotoUri) {
            continue;
        }

        const readablePhotoUri = await getReadablePhotoUri(selectedPhotoUri);
        if (!readablePhotoUri) {
            continue;
        }

        eligibleNotes.push(note);
        readablePhotoUrisByNoteId.set(note.id, readablePhotoUri);
    }

    return {
        notes: eligibleNotes,
        readablePhotoUrisByNoteId,
    };
}

async function resolveWidgetPhotoProps(
    note: Note,
    readablePhotoUri: string | undefined,
    destinationToken: string
): Promise<Pick<WidgetProps, 'backgroundImageUrl' | 'backgroundImageBase64'>> {
    if (note.type !== 'photo' || !readablePhotoUri) {
        return {};
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

function createHistoryEntry(note: Note, referenceDate: Date, selectionMode: WidgetSelectionMode): WidgetHistoryEntry {
    return {
        noteId: note.id,
        slotKey: getSlotKey(referenceDate),
        slotStartedAt: getSlotStart(referenceDate).toISOString(),
        selectionMode,
    };
}

async function buildWidgetPropsFromSelection(
    noteCount: number,
    selection: WidgetSelectionResult,
    referenceDate: Date,
    readablePhotoUrisByNoteId: Map<string, string>
): Promise<WidgetProps> {
    const resolvedNearbyPlacesCount =
        selection.selectionMode === 'nearest_memory'
            ? Math.max(selection.nearbyPlacesCount, 1)
            : 0;
    const translatedStrings = getTranslatedWidgetStrings(noteCount, resolvedNearbyPlacesCount, selection.selectionMode);

    if (!selection.selectedNote || selection.isIdleState) {
        return {
            ...buildIdleWidgetProps(noteCount, selection.selectionMode),
            ...translatedStrings,
        };
    }

    const selectedNote = selection.selectedNote;
    const dateStr = formatDate(selectedNote.createdAt, 'short');
    const props: WidgetProps = {
        noteType: selectedNote.type,
        text:
            selectedNote.type === 'text'
                ? formatNoteTextWithEmoji(selectedNote.content.trim(), selectedNote.moodEmoji)
                : '',
        locationName: selection.selectedLocationName ?? selectedNote.locationName ?? i18n.t('capture.unknownPlace'),
        date: dateStr,
        noteCount,
        nearbyPlacesCount: resolvedNearbyPlacesCount,
        hasDoodle: Boolean(selectedNote.hasDoodle && selectedNote.doodleStrokesJson),
        doodleStrokesJson: selectedNote.doodleStrokesJson ?? null,
        isIdleState: false,
        ...translatedStrings,
    };

    if (selectedNote.type === 'photo') {
        Object.assign(
            props,
            await resolveWidgetPhotoProps(
                selectedNote,
                readablePhotoUrisByNoteId.get(selectedNote.id),
                `slot-${getSlotKey(referenceDate)}-note-${selectedNote.id}`
            )
        );
    }

    return props;
}

async function buildWidgetTimeline(options: {
    notes: Note[];
    currentLocation?: LocationCoords | null;
    referenceDate: Date;
}) {
    const { notes, currentLocation = null, referenceDate } = options;
    const { notes: eligibleNotes, readablePhotoUrisByNoteId } = await getEligibleWidgetNotes(notes);
    const history = await loadWidgetHistory(referenceDate);
    const timelineDates = buildTimelineDates(referenceDate);
    const nextHistory = [...history];
    const entries: WidgetTimelineEntry[] = [];

    if (notes.length === 0 || eligibleNotes.length === 0) {
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
            notes: eligibleNotes,
            currentLocation,
            referenceDate: date,
            recentHistory: nextHistory,
        });

        entries.push({
            date,
            props: await buildWidgetPropsFromSelection(notes.length, selection, date, readablePhotoUrisByNoteId),
        });

        if (selection.selectedNote && !selection.isIdleState) {
            nextHistory.push(createHistoryEntry(selection.selectedNote, date, selection.selectionMode));
        }
    }

    return {
        entries,
        history: pruneWidgetHistory(nextHistory, referenceDate),
    };
}

export async function updateWidgetData(options: UpdateWidgetDataOptions = {}): Promise<void> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return;
    }

    try {
        const notes = options.notes ?? await getAllNotes();

        let currentLocation: Location.LocationObject | null = null;
        if (options.includeLocationLookup !== false) {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    currentLocation = await Location.getLastKnownPositionAsync();
                    if (!currentLocation) {
                        currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    }
                }
            } catch (e) {
                console.warn('[widgetService] Location fetch failed:', e);
            }
        }

        const { entries, history } = await buildWidgetTimeline({
            notes,
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
        console.warn('[widgetService] Failed to update widget:', error);
    }
}
