import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
    CreateNoteInput,
    createNote as dbCreate,
    deleteNote as dbDelete,
    deleteAllNotes as dbDeleteAll,
    getNoteById as dbGetById,
    searchNotes as dbSearch,
    toggleFavorite as dbToggleFav,
    updateNote as dbUpdate,
    getAllNotes,
    Note,
} from '../services/database';
import { updateWidgetData } from '../services/widgetService';
import { GEOFENCE_TASK_NAME } from '../utils/backgroundGeofence';

export function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshNotes = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const allNotes = await getAllNotes();
            setNotes(allNotes);
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshNotes();

        const subscription = DeviceEventEmitter.addListener('NOTES_CHANGED', () => {
            refreshNotes(false);
        });

        return () => subscription.remove();
    }, [refreshNotes]);

    const createNote = useCallback(
        async (input: CreateNoteInput): Promise<Note> => {
            const note = await dbCreate(input);
            setNotes((prev) => [note, ...prev]);
            DeviceEventEmitter.emit('NOTES_CHANGED');
            updateWidgetData();
            return note;
        },
        []
    );

    const updateNote = useCallback(
        async (id: string, updates: Partial<Pick<Note, 'content' | 'locationName'>>) => {
            await dbUpdate(id, updates);
            setNotes((prev) =>
                prev.map((n) =>
                    n.id === id
                        ? {
                            ...n,
                            ...updates,
                            updatedAt: new Date().toISOString(),
                        }
                        : n
                )
            );
            DeviceEventEmitter.emit('NOTES_CHANGED');
            updateWidgetData();
        },
        []
    );

    const toggleFavorite = useCallback(async (id: string) => {
        const newValue = await dbToggleFav(id);
        setNotes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isFavorite: newValue } : n))
        );
        DeviceEventEmitter.emit('NOTES_CHANGED');
        return newValue;
    }, []);

    const searchNotes = useCallback(async (query: string) => {
        if (!query.trim()) {
            return getAllNotes();
        }
        return dbSearch(query);
    }, []);

    const deleteNote = useCallback(async (id: string) => {
        // Clean up photo file if it's a photo note
        const note = await dbGetById(id);
        if (note?.type === 'photo' && note.content) {
            try {
                const fileInfo = await FileSystem.getInfoAsync(note.content);
                if (fileInfo.exists) {
                    await FileSystem.deleteAsync(note.content, { idempotent: true });
                }
            } catch (e) {
                console.warn('Failed to delete photo file:', e);
            }
        }

        await dbDelete(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        DeviceEventEmitter.emit('NOTES_CHANGED');
        updateWidgetData();
    }, []);

    const deleteAllNotes = useCallback(async () => {
        // Clean up all photo files
        const allNotes = await getAllNotes();
        for (const note of allNotes) {
            if (note.type === 'photo' && note.content) {
                try {
                    const fileInfo = await FileSystem.getInfoAsync(note.content);
                    if (fileInfo.exists) {
                        await FileSystem.deleteAsync(note.content, { idempotent: true });
                    }
                } catch (e) {
                    console.warn('Failed to delete photo file:', e);
                }
            }
        }

        // Clear all geofences
        try {
            const hasTask = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
            if (hasTask) {
                await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
            }
        } catch (e) {
            console.warn('Failed to clear geofences:', e);
        }

        await dbDeleteAll();
        setNotes([]);
        DeviceEventEmitter.emit('NOTES_CHANGED');
        updateWidgetData();
    }, []);

    const getNoteById = useCallback(async (id: string) => {
        return dbGetById(id);
    }, []);

    return {
        notes,
        loading,
        refreshNotes,
        createNote,
        updateNote,
        toggleFavorite,
        searchNotes,
        deleteNote,
        deleteAllNotes,
        getNoteById,
    };
}
