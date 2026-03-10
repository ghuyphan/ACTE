import * as Location from 'expo-location';
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
    isIdleState: boolean;
    idleText: string;
    savedCountText: string;
    memoryReminderText: string;
}

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

        if (currentLocation) {
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
            props.backgroundImageUrl = selectedNote.content;
        }

        widget.updateSnapshot({ props });
    } catch (error) {
        console.warn('[widgetService] Failed to update widget:', error);
    }
}
