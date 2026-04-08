import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import NoteDetailSheet from '../../components/notes/NoteDetailSheet';

export default function NoteDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [visible, setVisible] = useState(true);

    if (!id) {
        return null;
    }

    return (
        <NoteDetailSheet
            key={id}
            noteId={id}
            visible={visible}
            onClose={() => {
                setVisible(false);
            }}
            onClosed={() => {
                if (router.canGoBack()) {
                    router.back();
                    return;
                }

                router.replace('/notes');
            }}
        />
    );
}
