import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
    CreateNoteInput,
    createNote as dbCreate,
    deleteNote as dbDelete,
    deleteAllNotes as dbDeleteAll,
    getNoteById as dbGetById,
    getAllNotes,
    Note,
} from '../services/database';

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
            return note;
        },
        []
    );

    const deleteNote = useCallback(async (id: string) => {
        await dbDelete(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        DeviceEventEmitter.emit('NOTES_CHANGED');
    }, []);

    const deleteAllNotes = useCallback(async () => {
        await dbDeleteAll();
        setNotes([]);
        DeviceEventEmitter.emit('NOTES_CHANGED');
    }, []);

    const getNoteById = useCallback(async (id: string) => {
        return dbGetById(id);
    }, []);

    return {
        notes,
        loading,
        refreshNotes,
        createNote,
        deleteNote,
        deleteAllNotes,
        getNoteById,
    };
}
