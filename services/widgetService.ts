import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';
import { formatDate } from '../utils/dateUtils';
import { getAllNotes, Note } from './database';

// Lazy import to avoid circular dependency issues
let widgetInstance: any = null;

function getWidget() {
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
    memoryReminderText: string;
}

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_IMAGE_FILENAME = 'latest-photo.jpg';

// Haversine distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

function getTranslatedWidgetStrings(noteCount: number) {
    return {
        idleText: i18n.t('widget.idleText'),
        savedCountText: i18n.t('widget.savedCount', { count: noteCount }),
        memoryReminderText: i18n.t('widget.memoryReminder'),
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

export async function updateWidgetData(): Promise<void> {
    try {
        const widget = getWidget();
        if (!widget) return;

        const notes = await getAllNotes();
        const translatedStrings = getTranslatedWidgetStrings(notes.length);

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

        let selectedNote: Note | null = null;
        let nearbyPlacesCount = 0;
        let isIdleState = false;
        // Prefer the newest photo note when available so the widget stays visual.
        const latestPhotoNote = notes.find((note) => note.type === 'photo' && Boolean(note.content));

        if (currentLocation && !latestPhotoNote) {
            const lat = currentLocation.coords.latitude;
            const lon = currentLocation.coords.longitude;

            // Find nearby notes (within 500 meters roughly)
            const nearbyNotes = notes
                .map((note) => ({
                    note,
                    distance: getDistance(lat, lon, note.latitude, note.longitude),
                }))
                .filter((entry) => entry.distance <= 500)
                .sort((a, b) => a.distance - b.distance);

            if (nearbyNotes.length > 0) {
                selectedNote = nearbyNotes[0].note;

                // Count unique nearby places
                const uniquePlaces = new Set(nearbyNotes.map((entry) => entry.note.locationName).filter(Boolean));
                nearbyPlacesCount = Math.max(0, uniquePlaces.size - 1);
            }
        }

        if (!selectedNote && latestPhotoNote) {
            selectedNote = latestPhotoNote;
        }

        // Deterministic idle fallback: use latest saved note to avoid widget flicker.
        if (!selectedNote) {
            isIdleState = true;
            selectedNote = notes[0];
        }

        const dateStr = formatDate(selectedNote.createdAt, 'short');

        const props: WidgetProps = {
            text: selectedNote.type === 'text' ? selectedNote.content : '',
            locationName: selectedNote.locationName ?? i18n.t('capture.unknownPlace'),
            date: dateStr,
            noteCount: notes.length,
            nearbyPlacesCount,
            isIdleState,
            ...translatedStrings,
        };

        if (selectedNote.type === 'photo' && selectedNote.content) {
            const copiedPhotoUri = await copyPhotoForWidget(selectedNote.content);
            if (copiedPhotoUri) {
                props.backgroundImageUrl = copiedPhotoUri;
            } else {
                const photoBase64 = await encodePhotoForWidget(selectedNote.content);
                if (photoBase64) {
                    props.backgroundImageBase64 = photoBase64;
                } else {
                    const fallbackTextNote = notes.find(
                        (note) => note.type === 'text' && note.content.trim().length > 0
                    );
                    if (fallbackTextNote) {
                        props.text = fallbackTextNote.content.trim();
                        props.locationName =
                            fallbackTextNote.locationName ?? i18n.t('capture.unknownPlace');
                        props.date = formatDate(fallbackTextNote.createdAt, 'short');
                        props.isIdleState = false;
                    }
                }
            }
        }

        widget.updateSnapshot({ props });
    } catch (error) {
        console.warn('[widgetService] Failed to update widget:', error);
    }
}
