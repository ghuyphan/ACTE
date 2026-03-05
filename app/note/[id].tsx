import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useNotes } from '../../hooks/useNotes';
import { CardGradients, useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';
import { formatDate } from '../../utils/dateUtils';

const { width } = Dimensions.get('window');
const CARD_SIZE = width - 40;

function hashToIndex(str: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % max;
    }
    return Math.abs(hash) % max;
}

// ─── Skeleton Placeholder ──────────────────────────
function SkeletonCard({ colors }: { colors: any }) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [opacity]);

    return (
        <View style={styles.scrollContent}>
            <Animated.View
                style={[
                    styles.skeletonCard,
                    { backgroundColor: colors.card, opacity },
                ]}
            />
            <View style={styles.infoSection}>
                <Animated.View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.card, opacity }]} />
                <Animated.View style={[styles.skeletonLine, { width: '45%', backgroundColor: colors.card, opacity }]} />
                <Animated.View style={[styles.skeletonLine, { width: '55%', backgroundColor: colors.card, opacity }]} />
            </View>
        </View>
    );
}

// ─── Animated Action Button ──────────────────────────
function AnimatedActionButton({ onPress, children, style, delay = 0 }: {
    onPress: () => void;
    children: React.ReactNode;
    style: any;
    delay?: number;
}) {
    const scale = useRef(new Animated.Value(0)).current;
    const pressScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(scale, {
            toValue: 1,
            delay,
            tension: 200,
            friction: 12,
            useNativeDriver: true,
        }).start();
    }, [scale, delay]);

    const handlePressIn = () => {
        Animated.spring(pressScale, { toValue: 0.85, tension: 300, friction: 10, useNativeDriver: true }).start();
    };
    const handlePressOut = () => {
        Animated.spring(pressScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
    };

    return (
        <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[style, { transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { getNoteById, deleteNote, updateNote, toggleFavorite } = useNotes();
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);

    // Native Bottom Sheet State
    const [isPresented, setIsPresented] = useState(true);

    const handleDismiss = (val: boolean) => {
        setIsPresented(val);
        if (!val) {
            router.back();
        }
    };

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editLocation, setEditLocation] = useState('');

    // Entrance animation
    const cardScale = useRef(new Animated.Value(0.92)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const infoTranslateY = useRef(new Animated.Value(20)).current;
    const infoOpacity = useRef(new Animated.Value(0)).current;

    // Favorite heart bounce
    const heartScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (id) {
            getNoteById(id).then((n) => {
                setNote(n);
                if (n) {
                    setEditContent(n.content);
                    setEditLocation(n.locationName || '');
                }
                setLoading(false);

                // Trigger entrance animation
                Animated.parallel([
                    Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
                    Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(infoOpacity, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
                    Animated.spring(infoTranslateY, { toValue: 0, tension: 80, friction: 12, delay: 200, useNativeDriver: true }),
                ]).start();
            });
        }
    }, [id, getNoteById]);

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            router.back();
                        }
                    },
                },
            ]
        );
    };

    const handleToggleFavorite = async () => {
        if (!note) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Heart bounce animation
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.4, tension: 300, friction: 5, useNativeDriver: true }),
            Animated.spring(heartScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
        ]).start();

        const newValue = await toggleFavorite(note.id);
        setNote((prev) => (prev ? { ...prev, isFavorite: newValue } : prev));
    };

    const handleSaveEdit = async () => {
        if (!note) return;
        const updates: Partial<Pick<Note, 'content' | 'locationName'>> = {};

        if (note.type === 'text' && editContent.trim() !== note.content) {
            updates.content = editContent.trim();
        }
        if (editLocation.trim() !== (note.locationName || '')) {
            updates.locationName = editLocation.trim() || null;
        }

        if (Object.keys(updates).length > 0) {
            await updateNote(note.id, updates);
            setNote((prev) =>
                prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : prev
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setIsEditing(false);
    };

    const handleShare = async () => {
        if (!note) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const locationStr = note.locationName || t('noteDetail.unknownLocation');
        let message: string;

        if (note.type === 'text') {
            message = `📍 ${locationStr}\n\n${note.content}\n\n— ACTE 💛`;
        } else {
            message = t('noteDetail.sharePhotoMsg', { location: locationStr }) + '\n\n— ACTE 💛';
        }

        try {
            await Share.share({ message });
        } catch (e) {
            console.warn('Share failed:', e);
        }
    };

    if (loading) {
        return (
            <Host style={{ flex: 1, backgroundColor: 'transparent' }} colorScheme={isDark ? 'dark' : 'light'}>
                <BottomSheet isPresented={isPresented} onIsPresentedChange={handleDismiss} fitToContents>
                    <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                        <RNHostView matchContents>
                            <View style={[styles.container, { backgroundColor: 'transparent' }]}>
                                <View style={styles.handleBar}>
                                    <View style={[styles.handle, { backgroundColor: colors.border }]} />
                                </View>
                                <SkeletonCard colors={colors} />
                            </View>
                        </RNHostView>
                    </Group>
                </BottomSheet>
            </Host>
        );
    }

    if (!note) {
        return (
            <Host style={{ flex: 1, backgroundColor: 'transparent' }} colorScheme={isDark ? 'dark' : 'light'}>
                <BottomSheet isPresented={isPresented} onIsPresentedChange={handleDismiss} fitToContents>
                    <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                        <RNHostView matchContents>
                            <View style={[styles.center, { backgroundColor: 'transparent', minHeight: 200 }]}>
                                <Text style={{ color: colors.secondaryText, fontSize: 17 }}>
                                    {t('noteDetail.notFound', 'Note not found')}
                                </Text>
                                <Pressable onPress={() => handleDismiss(false)} style={{ marginTop: 20 }}>
                                    <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '600' }}>
                                        {t('common.goBack', 'Go Back')}
                                    </Text>
                                </Pressable>
                            </View>
                        </RNHostView>
                    </Group>
                </BottomSheet>
            </Host>
        );
    }

    const dateStr = formatDate(note.createdAt, 'long');
    const gradientIndex = hashToIndex(note.id, CardGradients.length);
    const gradient = CardGradients[gradientIndex];

    return (
        <Host style={{ flex: 1, backgroundColor: 'transparent' }} colorScheme={isDark ? 'dark' : 'light'}>
            <BottomSheet isPresented={isPresented} onIsPresentedChange={handleDismiss} fitToContents>
                <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                    <RNHostView matchContents>
                        <KeyboardAvoidingView
                            style={[styles.container, { backgroundColor: 'transparent' }]}
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        >
                            <ScrollView
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Note Content — animated entrance */}
                                <Animated.View style={{ opacity: cardOpacity, transform: [{ scale: cardScale }] }}>
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
                                        <View style={styles.textContainer}>
                                            <LinearGradient
                                                colors={gradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.textGradient}
                                            >
                                                <TextInput
                                                    style={[styles.editTextInput, { color: '#FFFFFF' }]}
                                                    value={isEditing ? editContent : note.content}
                                                    onChangeText={isEditing ? setEditContent : undefined}
                                                    editable={isEditing}
                                                    multiline
                                                    scrollEnabled={false}
                                                    placeholder={isEditing ? t('noteDetail.editContent', 'Edit note content...') : undefined}
                                                    placeholderTextColor="rgba(255,255,255,0.5)"
                                                    maxLength={300}
                                                />
                                            </LinearGradient>
                                        </View>
                                    )}
                                </Animated.View>

                                {/* Action buttons row — animated entrance */}
                                <View style={styles.actionRow}>
                                    {/* Favorite */}
                                    <AnimatedActionButton
                                        onPress={handleToggleFavorite}
                                        style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                                        delay={100}
                                    >
                                        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                                            <Ionicons
                                                name={note.isFavorite ? 'heart' : 'heart-outline'}
                                                size={20}
                                                color={note.isFavorite ? '#FF3B30' : colors.secondaryText}
                                            />
                                        </Animated.View>
                                    </AnimatedActionButton>

                                    {/* Edit / Save */}
                                    {note.type === 'text' && (
                                        <AnimatedActionButton
                                            onPress={isEditing ? handleSaveEdit : () => setIsEditing(true)}
                                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                                            delay={150}
                                        >
                                            <Ionicons
                                                name={isEditing ? 'checkmark' : 'create-outline'}
                                                size={20}
                                                color={isEditing ? colors.success : colors.secondaryText}
                                            />
                                        </AnimatedActionButton>
                                    )}

                                    {/* Share */}
                                    <AnimatedActionButton
                                        onPress={handleShare}
                                        style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                                        delay={200}
                                    >
                                        <Ionicons name="share-outline" size={20} color={colors.secondaryText} />
                                    </AnimatedActionButton>
                                </View>

                                {/* Info Section — animated entrance */}
                                <Animated.View style={{ opacity: infoOpacity, transform: [{ translateY: infoTranslateY }] }}>
                                    <View style={styles.infoSection}>
                                        <View style={styles.infoRow}>
                                            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                                            <TextInput
                                                style={[styles.editLocationInput, { color: colors.text }]}
                                                value={isEditing ? editLocation : (note.locationName || t('noteDetail.unknownLocation', 'Unknown Location'))}
                                                onChangeText={isEditing ? setEditLocation : undefined}
                                                editable={isEditing}
                                                placeholder={isEditing ? t('noteDetail.editLocation', 'Edit location name...') : undefined}
                                                placeholderTextColor={colors.secondaryText}
                                                maxLength={100}
                                            />
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
                                </Animated.View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </RNHostView>
                </Group>
            </BottomSheet>
        </Host>
    );
}

const styles = StyleSheet.create({
    container: {
        // Removed flex: 1 to prevent RNHostView matchContents height collapse
    },
    center: {
        // Removed flex: 1 to prevent RNHostView matchContents height collapse
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
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 16,
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    // Fixed-size container — same size in both edit and view mode
    textContainer: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 16,
    },
    textGradient: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noteText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 30,
        fontFamily: 'System',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    // TextInput wraps to content — parent gradient centers it vertically
    editTextInput: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 30,
        fontFamily: 'System',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // ─── Action buttons ──────────────────
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    actionBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ─── Info section ────────────────────
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
        fontFamily: 'System',
    },
    editLocationInput: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
        fontFamily: 'System',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    deleteText: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: 'System',
    },

    // ─── Skeleton ────────────────────────
    skeletonCard: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 28,
        marginBottom: 24,
    },
    skeletonLine: {
        height: 16,
        borderRadius: 8,
        marginBottom: 12,
    },
});