import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';

const { width, height } = Dimensions.get('window');

function hashToIndex(id: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) % max;
    }
    return Math.abs(hash) % max;
}

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { getNoteById, deleteNote } = useNotes();
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getNoteById(id).then((n) => {
                setNote(n);
                setLoading(false);
            });
        }
    }, [id, getNoteById]);

    const handleDelete = () => {
        Alert.alert(
            t('noteDetail.deleteTitle', 'Delete Note'),
            t('noteDetail.deleteMsg', 'This note and its geofence will be permanently removed.'),
            [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('common.delete', 'Delete'),
                    style: 'destructive',
                    onPress: async () => {
                        if (note) {
                            await deleteNote(note.id);
                            router.back();
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!note) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.secondaryText, fontSize: 17 }}>
                    {t('noteDetail.notFound', 'Note not found')}
                </Text>
                <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '600' }}>
                        {t('common.goBack', 'Go Back')}
                    </Text>
                </Pressable>
            </View>
        );
    }

    const dateStr = new Date(note.createdAt).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    const bgColor = note.type === 'text' ? colors.primary : 'transparent';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Handle bar */}
            <View style={styles.handleBar}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Note Content */}
                {note.type === 'photo' ? (
                    <View style={styles.photoContainer}>
                        <Image
                            source={{ uri: note.content }}
                            style={styles.photo}
                            contentFit="cover"
                            transition={300}
                        />
                    </View>
                ) : (
                    <View style={[styles.textContainer, { backgroundColor: bgColor }]}>
                        <Text style={[styles.noteText, { color: isDark ? '#000' : '#1C1C1E' }]}>{note.content}</Text>
                    </View>
                )}

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                        <Text style={[styles.infoText, { color: colors.text, fontWeight: '700' }]}>
                            {note.locationName || t('noteDetail.unknownLocation', 'Unknown Location')}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={20} color={colors.secondaryText} />
                        <Text style={[styles.infoText, { color: colors.secondaryText }]}>{dateStr}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={20} color={colors.secondaryText} />
                        <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                            {note.latitude.toFixed(5)}, {note.longitude.toFixed(5)}
                        </Text>
                    </View>
                </View>

                {/* Delete Button */}
                <Pressable
                    style={[styles.deleteButton, { backgroundColor: colors.danger + '15' }]}
                    onPress={handleDelete}
                >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    <Text style={[styles.deleteText, { color: colors.danger }]}>
                        {t('noteDetail.delete', 'Delete Note')}
                    </Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    handleBar: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 3,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 60,
    },
    photoContainer: {
        width: width - 40,
        height: width - 40,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 24,
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        width: width - 40,
        height: width - 40,
        borderRadius: 28,
        padding: 24, // Reduced from 30
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    noteText: {
        fontSize: 22, // Reduced from 28
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 30, // Reduced from 38
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    infoSection: {
        gap: 16,
        marginBottom: 32,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoText: {
        fontSize: 16,
        flex: 1,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14, // Reduced from 16
        borderRadius: 14,
        gap: 8,
    },
    deleteText: {
        fontSize: 17,
        fontWeight: '600',
    },
});
