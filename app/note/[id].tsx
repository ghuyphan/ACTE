import { useLocalSearchParams, useRouter } from 'expo-router';
import NoteDetailSheet from '../../components/NoteDetailSheet';

export default function NoteDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    if (!id) {
        return null;
    }

    return (
        <NoteDetailSheet
            noteId={id}
            visible
            onClose={() => {
                router.back();
            }}
        />
    );
}
