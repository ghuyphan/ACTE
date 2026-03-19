import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';
import { formatDate } from '../utils/dateUtils';
import { getAllNotes, Note } from './database';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { getNotePhotoUri, resolveStoredPhotoUri } from './photoStorage';
import { compareReminderNotes, getDistanceMeters } from './reminderSelection';

// Lazy import to avoid circular dependency issues
let widgetInstance: any = null;

function getWidget() {
    if (Platform.OS !== 'ios') {
        return null;
    }

    if (!widgetInstance) {
        try {
            widgetInstance = require('../widgets/LocketWidget').default;
        } catch (e) {
            console.warn('[widgetService] Could not load widget:', e);
        }
    }
    return widgetInstance;
}

export interface WidgetProps {
    text: string;
    locationName: string;
    date: string;
    noteCount: number;
    nearbyPlacesCount: number;
    backgroundImageUrl?: string; // local file uri
    backgroundImageBase64?: string;
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

export type WidgetSelectionMode =
    | 'nearest_memory'
    | 'random_favorite'
    | 'around_this_area'
    | 'latest_memory';

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_IMAGE_FILENAME = 'latest-photo.jpg';

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

    if (selectionMode === 'random_favorite') {
        return 'widget.modeFavorite';
    }

    if (selectionMode === 'around_this_area') {
        return 'widget.modeArea';
    }

    return 'widget.memoryReminder';
}

function getSlotKey(referenceDate: Date) {
    const slot = Math.floor(referenceDate.getHours() / 6);
    return `${referenceDate.getFullYear()}-${referenceDate.getMonth() + 1}-${referenceDate.getDate()}-${slot}`;
}

function getOrderedSelectionModes(referenceDate: Date): WidgetSelectionMode[] {
    const modes: WidgetSelectionMode[] = ['nearest_memory', 'random_favorite', 'around_this_area'];
    const startIndex = hashString(getSlotKey(referenceDate)) % modes.length;
    return modes.map((_, offset) => modes[(startIndex + offset) % modes.length]!);
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

export function selectWidgetNote(options: {
    notes: Note[];
    currentLocation?: LocationCoords | null;
    nearbyRadiusMeters?: number;
    referenceDate?: Date;
}): WidgetSelectionResult {
    const {
        notes,
        currentLocation = null,
        nearbyRadiusMeters = 5000,
        referenceDate = new Date(),
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

    const orderedModes = getOrderedSelectionModes(referenceDate);

    const nearestCandidates = currentLocation
        ? notes
            .map((note) => ({
                note,
                distanceMeters: getDistanceMeters(currentLocation, {
                    latitude: note.latitude,
                    longitude: note.longitude,
                }),
            }))
            .filter((entry) => entry.distanceMeters <= Math.max(1, entry.note.radius))
            .sort((left, right) => {
                const distanceDelta = left.distanceMeters - right.distanceMeters;
                if (distanceDelta !== 0) {
                    return distanceDelta;
                }

                return compareReminderNotes(left.note, right.note);
            })
        : [];

    const nearbyAreaCandidates = currentLocation
        ? notes
            .map((note) => ({
                note,
                distanceMeters: getDistanceMeters(currentLocation, {
                    latitude: note.latitude,
                    longitude: note.longitude,
                }),
            }))
            .filter((entry) => entry.distanceMeters <= nearbyRadiusMeters)
            .sort((left, right) => {
                const distanceDelta = left.distanceMeters - right.distanceMeters;
                if (distanceDelta !== 0) {
                    return distanceDelta;
                }

                return compareReminderNotes(left.note, right.note);
            })
        : [];

    const favoriteCandidates = notes.filter((note) => note.isFavorite);
    const favoriteSelection =
        favoriteCandidates.length > 0
            ? [...favoriteCandidates].sort(compareReminderNotes)[hashString(getSlotKey(referenceDate)) % favoriteCandidates.length] ?? null
            : null;

    for (const mode of orderedModes) {
        if (mode === 'nearest_memory' && nearestCandidates.length > 0) {
            return {
                selectedNote: nearestCandidates[0]?.note ?? null,
                selectedLocationName: nearestCandidates[0]?.note.locationName ?? null,
                nearbyPlacesCount: Math.max(0, nearestCandidates.length - 1),
                isIdleState: false,
                selectionMode: mode,
            };
        }

        if (mode === 'random_favorite' && favoriteSelection) {
            return {
                selectedNote: favoriteSelection,
                selectedLocationName: favoriteSelection.locationName ?? null,
                nearbyPlacesCount: 0,
                isIdleState: false,
                selectionMode: mode,
            };
        }

        if (mode === 'around_this_area' && nearbyAreaCandidates.length > 0) {
            return {
                selectedNote: nearbyAreaCandidates[0]?.note ?? null,
                selectedLocationName: nearbyAreaCandidates[0]?.note.locationName ?? null,
                nearbyPlacesCount: Math.max(0, nearbyAreaCandidates.length - 1),
                isIdleState: false,
                selectionMode: mode,
            };
        }
    }

    const latestNote = [...notes].sort((left, right) =>
        new Date(right.updatedAt ?? right.createdAt).getTime() - new Date(left.updatedAt ?? left.createdAt).getTime()
    )[0] ?? null;

    return {
        selectedNote: latestNote,
        selectedLocationName: latestNote?.locationName ?? null,
        nearbyPlacesCount: 0,
        isIdleState: false,
        selectionMode: 'latest_memory',
    };
}

async function resolveWidgetPhotoProps(note: Note): Promise<Pick<WidgetProps, 'backgroundImageUrl' | 'backgroundImageBase64'>> {
    const selectedPhotoUri = getNotePhotoUri(note);
    if (note.type !== 'photo' || !selectedPhotoUri) {
        return {};
    }

    const readablePhotoUri = await getReadablePhotoUri(selectedPhotoUri);
    if (!readablePhotoUri) {
        return {};
    }

    const copiedPhotoUri = await copyPhotoForWidget(readablePhotoUri);
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

async function copyPhotoForWidget(photoUri: string): Promise<string | undefined> {
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

    const destinationDirectory = `${sharedContainerUri}${WIDGET_IMAGE_DIRECTORY_NAME}/`;
    const destinationPath = `${destinationDirectory}${WIDGET_IMAGE_FILENAME}`;

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

export async function updateWidgetData(options: UpdateWidgetDataOptions = {}): Promise<void> {
    if (Platform.OS !== 'ios') {
        return;
    }

    try {
        const widget = getWidget();
        if (!widget) return;

        const notes = options.notes ?? await getAllNotes();
        const translatedStrings = getTranslatedWidgetStrings(notes.length, 0, 'latest_memory');

        if (notes.length === 0) {
            widget.updateSnapshot({
                props: {
                    text: '',
                    locationName: '',
                    date: '',
                    noteCount: 0,
                    nearbyPlacesCount: 0,
                    isIdleState: true,
                    ...translatedStrings,
                },
            });
            return;
        }

        // 1. Try to get current location
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

        const {
            selectedNote,
            selectedLocationName,
            nearbyPlacesCount,
            isIdleState,
            selectionMode,
        } = selectWidgetNote({
            notes,
            currentLocation: currentLocation
                ? {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                }
                : null,
            nearbyRadiusMeters: 5000,
            referenceDate: options.referenceDate ?? new Date(),
        });
        const resolvedNearbyPlacesCount =
            isIdleState
                ? 0
                : selectionMode === 'nearest_memory' || selectionMode === 'around_this_area'
                    ? Math.max(nearbyPlacesCount, 1)
                    : 0;
        const selectionTranslatedStrings = getTranslatedWidgetStrings(notes.length, resolvedNearbyPlacesCount, selectionMode);

        if (!selectedNote || isIdleState) {
            widget.updateSnapshot({
                props: {
                    text: '',
                    locationName: '',
                    date: '',
                    noteCount: notes.length,
                    nearbyPlacesCount: 0,
                    isIdleState: true,
                    ...selectionTranslatedStrings,
                },
            });
            return;
        }

        const dateStr = formatDate(selectedNote.createdAt, 'short');

        const props: WidgetProps = {
            text:
                selectedNote.type === 'text'
                    ? formatNoteTextWithEmoji(selectedNote.content.trim(), selectedNote.moodEmoji)
                    : '',
            locationName: selectedLocationName ?? selectedNote.locationName ?? i18n.t('capture.unknownPlace'),
            date: dateStr,
            noteCount: notes.length,
            nearbyPlacesCount: resolvedNearbyPlacesCount,
            isIdleState,
            ...selectionTranslatedStrings,
        };

        if (selectedNote.type === 'photo') {
            Object.assign(props, await resolveWidgetPhotoProps(selectedNote));
        }

        widget.updateSnapshot({ props });
    } catch (error) {
        console.warn('[widgetService] Failed to update widget:', error);
    }
}
