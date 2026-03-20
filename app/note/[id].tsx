import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import NoteDetailSheet from '../../components/NoteDetailSheet';

export default function NoteDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [visible, setVisible] = useState(true);

    if (!id) {
        return null;
    }

    return (
        <NoteDetailSheet
            noteId={id}
            visible={visible}
            onClose={() => {
                setVisible(false);
            }}
            onClosed={() => {
                router.back();
            }}
        />
    );
}
