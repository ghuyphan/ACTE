import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import AppSheetAlert from './AppSheetAlert';
import { Layout, Typography } from '../constants/theme';
import { useAppSheetAlert } from '../hooks/useAppSheetAlert';
import { useNotes } from '../hooks/useNotes';
import { CardGradients, useTheme } from '../hooks/useTheme';
import { Note } from '../services/database';
import { formatDate } from '../utils/dateUtils';
import { isOlderIOS } from '../utils/platform';

const { width } = Dimensions.get('window');
const CARD_SIZE = width - Layout.screenPadding * 2;

function hashToIndex(str: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % max;
    }
    return Math.abs(hash) % max;
}

function SkeletonCard({ colors }: { colors: { card: string } }) {
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

function AnimatedActionButton({
    onPress,
    children,
    style,
    delay = 0,
}: {
    onPress: () => void;
    children: React.ReactNode;
    style: object;
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

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => {
                Animated.spring(pressScale, { toValue: 0.85, tension: 300, friction: 10, useNativeDriver: true }).start();
            }}
            onPressOut={() => {
                Animated.spring(pressScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
            }}
        >
            <Animated.View style={[style, { transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

interface NoteDetailSheetProps {
    noteId: string;
    visible: boolean;
    onClose: () => void;
}

export default function NoteDetailSheet({ noteId, visible, onClose }: NoteDetailSheetProps) {
    const { getNoteById, deleteNote, updateNote, toggleFavorite } = useNotes();
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const { alertProps, showAlert } = useAppSheetAlert();
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editLocation, setEditLocation] = useState('');

    const cardScale = useRef(new Animated.Value(0.92)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const infoTranslateY = useRef(new Animated.Value(20)).current;
    const infoOpacity = useRef(new Animated.Value(0)).current;
    const heartScale = useRef(new Animated.Value(1)).current;
    const sheetBackgroundStyle = isOlderIOS ? { backgroundColor: colors.card } : null;

    useEffect(() => {
        if (!visible || !noteId) {
            return;
        }

        setLoading(true);
        setIsEditing(false);
        cardScale.setValue(0.92);
        cardOpacity.setValue(0);
        infoTranslateY.setValue(20);
        infoOpacity.setValue(0);

        getNoteById(noteId).then((nextNote) => {
            setNote(nextNote);
            if (nextNote) {
                setEditContent(nextNote.content);
                setEditLocation(nextNote.locationName || '');
            }
            setLoading(false);

            Animated.parallel([
                Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
                Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(infoOpacity, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
                Animated.spring(infoTranslateY, { toValue: 0, tension: 80, friction: 12, delay: 200, useNativeDriver: true }),
            ]).start();
        });
    }, [cardOpacity, cardScale, getNoteById, infoOpacity, infoTranslateY, noteId, visible]);

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showAlert({
            variant: 'error',
            title: t('noteDetail.deleteTitle', 'Delete Note'),
            message: t('noteDetail.deleteMsg', 'This note and its geofence will be permanently removed.'),
            primaryAction: {
                label: t('common.delete', 'Delete'),
                variant: 'destructive',
                onPress: async () => {
                    if (note) {
                        await deleteNote(note.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onClose();
                    }
                },
            },
            secondaryAction: {
                label: t('common.cancel', 'Cancel'),
                variant: 'secondary',
            },
        });
    };

    const handleToggleFavorite = async () => {
        if (!note) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        const message =
            note.type === 'text'
                ? `📍 ${locationStr}\n\n${note.content}\n\n— ACTE 💛`
                : `${t('noteDetail.sharePhotoMsg', { location: locationStr })}\n\n— ACTE 💛`;

        try {
            await Share.share({ message });
        } catch {
            return;
        }
    };

    const handleSheetVisibility = (nextVisible: boolean) => {
        if (!nextVisible) {
            onClose();
        }
    };

    const renderBody = () => {
        if (loading) {
            return (
                <View style={[styles.sheetSurface, sheetBackgroundStyle]}>
                    <SkeletonCard colors={{ card: colors.card }} />
                </View>
            );
        }

        if (!note) {
            return (
                <View style={[styles.center, styles.sheetSurface, sheetBackgroundStyle, { minHeight: 200 }]}>
                    <Text style={{ color: colors.secondaryText, fontSize: 17 }}>
                        {t('noteDetail.notFound', 'Note not found')}
                    </Text>
                    <Pressable onPress={onClose} style={{ marginTop: 20 }}>
                        <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '600' }}>
                            {t('common.goBack', 'Go Back')}
                        </Text>
                    </Pressable>
                </View>
            );
        }

        const dateStr = formatDate(note.createdAt, 'long');
        const gradientIndex = hashToIndex(note.id, CardGradients.length);
        const gradient = CardGradients[gradientIndex];

        return (
            <KeyboardAvoidingView
                style={[styles.sheetSurface, sheetBackgroundStyle]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Animated.View style={{ opacity: cardOpacity, transform: [{ scale: cardScale }] }}>
                        {note.type === 'photo' ? (
                            <View style={styles.photoContainer}>
                                <Image source={{ uri: note.content }} style={styles.photo} contentFit="cover" transition={300} />
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
                                        style={styles.editTextInput}
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

                    <View style={styles.actionRow}>
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

                        {note.type === 'text' ? (
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
                        ) : null}

                        <AnimatedActionButton
                            onPress={handleShare}
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={200}
                        >
                            <Ionicons name="share-outline" size={20} color={colors.secondaryText} />
                        </AnimatedActionButton>
                    </View>

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

                        <Pressable
                            style={[styles.deleteButton, { backgroundColor: `${colors.danger}15` }]}
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
        );
    };

    return (
        <View pointerEvents={visible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
            <Host style={StyleSheet.absoluteFill} colorScheme={isDark ? 'dark' : 'light'}>
                <BottomSheet isPresented={visible} onIsPresentedChange={handleSheetVisibility} fitToContents>
                    <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                        <RNHostView matchContents>
                            {renderBody()}
                        </RNHostView>
                    </Group>
                </BottomSheet>
            </Host>
            <AppSheetAlert {...alertProps} />
        </View>
    );
}

const styles = StyleSheet.create({
    sheetSurface: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding,
        paddingVertical: 32,
    },
    scrollContent: {
        padding: Layout.screenPadding,
        paddingTop: 16,
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
        ...Typography.body,
        flex: 1,
    },
    editLocationInput: {
        ...Typography.body,
        fontWeight: '700',
        flex: 1,
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
