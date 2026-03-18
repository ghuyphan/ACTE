import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';
import { formatDate } from '../utils/dateUtils';
import { getAllNotes, Note } from './database';
import { getNotePhotoUri, resolveStoredPhotoUri } from './photoStorage';
import { selectNearbyReminder } from './reminderSelection';

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
}

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_IMAGE_FILENAME = 'latest-photo.jpg';

function getTranslatedWidgetStrings(noteCount: number, nearbyPlacesCount = 0) {
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
        memoryReminderText: i18n.t('widget.memoryReminder'),
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
}): WidgetSelectionResult {
    const selection = selectNearbyReminder(options);

    return {
        selectedNote: selection.selectedNote,
        selectedLocationName: selection.selectedPlace?.locationName ?? null,
        nearbyPlacesCount: selection.nearbyPlacesCount,
        isIdleState: !selection.isNearby,
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
        const translatedStrings = getTranslatedWidgetStrings(notes.length, 0);

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
        } = selectWidgetNote({
            notes,
            currentLocation: currentLocation
                ? {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                }
                : null,
            nearbyRadiusMeters: 500,
        });
        const resolvedNearbyPlacesCount = isIdleState ? 0 : Math.max(nearbyPlacesCount, 1);
        const selectionTranslatedStrings = getTranslatedWidgetStrings(notes.length, resolvedNearbyPlacesCount);

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
            text: selectedNote.type === 'text' ? selectedNote.content.trim() : '',
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
