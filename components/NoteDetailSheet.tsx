import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
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
import { Layout, Typography } from '../constants/theme';
import { useNotes } from '../hooks/useNotes';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { CardGradients, useTheme } from '../hooks/useTheme';
import { Note } from '../services/database';
import { formatDate } from '../utils/dateUtils';
import { emitInteractionFeedback, InteractionFeedbackType } from '../utils/interactionFeedback';
import { isOlderIOS } from '../utils/platform';
import TransientStatusChip from './ui/TransientStatusChip';

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
    disabled = false,
}: {
    onPress: () => void;
    children: React.ReactNode;
    style: object;
    delay?: number;
    disabled?: boolean;
}) {
    const scale = useRef(new Animated.Value(0)).current;
    const pressScale = useRef(new Animated.Value(1)).current;
    const reduceMotionEnabled = useReducedMotion();

    useEffect(() => {
        Animated.timing(scale, {
            toValue: 1,
            delay,
            duration: reduceMotionEnabled ? 110 : 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [delay, reduceMotionEnabled, scale]);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            onPressIn={() => {
                Animated.timing(pressScale, {
                    toValue: reduceMotionEnabled ? 0.97 : 0.93,
                    duration: 80,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true
                }).start();
            }}
            onPressOut={() => {
                Animated.timing(pressScale, {
                    toValue: 1,
                    duration: 110,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true
                }).start();
            }}
        >
            <Animated.View
                style={[
                    style,
                    {
                        opacity: disabled ? 0.45 : 1,
                        transform: [{ scale: Animated.multiply(scale, pressScale) }]
                    }
                ]}
            >
                {children}
            </Animated.View>
        </Pressable>
    );
}

interface FeedbackState {
    type: InteractionFeedbackType;
    token: number;
}

function getFeedbackPresentation(t: any, type: InteractionFeedbackType) {
    if (type === 'favorited') {
        return {
            label: t('feedback.favorited', 'Favorited'),
            icon: 'heart' as const,
        };
    }

    if (type === 'unfavorited') {
        return {
            label: t('feedback.unfavorited', 'Unfavorited'),
            icon: 'heart-outline' as const,
        };
    }

    return {
        label: t('feedback.deleted', 'Deleted'),
        icon: 'trash-outline' as const,
    };
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
    const reduceMotionEnabled = useReducedMotion();
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [interactionFeedback, setInteractionFeedback] = useState<FeedbackState | null>(null);

    const cardScale = useRef(new Animated.Value(0.92)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const infoTranslateY = useRef(new Animated.Value(20)).current;
    const infoOpacity = useRef(new Animated.Value(0)).current;
    const actionsOpacity = useRef(new Animated.Value(0)).current;
    const heartScale = useRef(new Animated.Value(1)).current;
    const editModeAnim = useRef(new Animated.Value(0)).current;
    const contentInputRef = useRef<TextInput>(null);
    const locationInputRef = useRef<TextInput>(null);
    const sheetBackgroundStyle = isOlderIOS ? { backgroundColor: colors.card } : null;
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showInteractionFeedback = useCallback((type: InteractionFeedbackType) => {
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }

        emitInteractionFeedback(type);
        setInteractionFeedback({ type, token: Date.now() });
        feedbackTimeoutRef.current = setTimeout(() => {
            setInteractionFeedback(null);
            feedbackTimeoutRef.current = null;
        }, 1200);
    }, []);

    useEffect(() => {
        if (!visible || !noteId) {
            return;
        }

        setLoading(true);
        setIsEditing(false);
        setIsDeleting(false);
        cardScale.setValue(0.97);
        cardOpacity.setValue(0);
        infoTranslateY.setValue(12);
        infoOpacity.setValue(0);
        actionsOpacity.setValue(0);
        editModeAnim.setValue(0);

        getNoteById(noteId).then((nextNote) => {
            setNote(nextNote);
            if (nextNote) {
                setEditContent(nextNote.content);
                setEditLocation(nextNote.locationName || '');
            }
            setLoading(false);

            Animated.parallel([
                Animated.timing(cardScale, {
                    toValue: 1,
                    duration: reduceMotionEnabled ? 140 : 180,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: reduceMotionEnabled ? 140 : 180,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(actionsOpacity, {
                    toValue: 1,
                    duration: reduceMotionEnabled ? 120 : 160,
                    delay: 70,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(infoOpacity, {
                    toValue: 1,
                    duration: reduceMotionEnabled ? 140 : 180,
                    delay: 100,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(infoTranslateY, {
                    toValue: 0,
                    duration: reduceMotionEnabled ? 140 : 180,
                    delay: 100,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
            ]).start();
        });
    }, [actionsOpacity, cardOpacity, cardScale, editModeAnim, getNoteById, infoOpacity, infoTranslateY, noteId, reduceMotionEnabled, visible]);

    useEffect(() => {
        Animated.timing(editModeAnim, {
            toValue: isEditing ? 1 : 0,
            duration: reduceMotionEnabled ? 100 : 180,
            useNativeDriver: true,
        }).start();
    }, [editModeAnim, isEditing, reduceMotionEnabled]);

    useEffect(() => {
        if (!isEditing) {
            return;
        }

        const focusTimer = setTimeout(() => {
            if (note?.type === 'text') {
                contentInputRef.current?.focus();
                return;
            }
            locationInputRef.current?.focus();
        }, 70);

        return () => clearTimeout(focusTimer);
    }, [isEditing, note?.type]);

    useEffect(() => () => {
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
    }, []);

    const performDelete = useCallback(async (targetNoteId: string) => {
        if (isDeleting) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteNote(targetNoteId);
            showInteractionFeedback('deleted');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
        } catch (error) {
            console.error('Delete failed:', error);
            Alert.alert(
                t('noteDetail.deleteErrorTitle', 'Delete failed'),
                t('noteDetail.deleteErrorMsg', 'Unable to delete this note right now. Please try again.')
            );
        } finally {
            setIsDeleting(false);
        }
    }, [deleteNote, isDeleting, onClose, showInteractionFeedback, t]);

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
                    onPress: () => {
                        if (!note || isDeleting) return;
                        void performDelete(note.id);
                    },
                },
            ]
        );
    };

    const handleToggleFavorite = async () => {
        if (!note || isDeleting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
            Animated.timing(heartScale, {
                toValue: reduceMotionEnabled ? 1.1 : 1.14,
                duration: 90,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true
            }),
            Animated.timing(heartScale, {
                toValue: 1,
                duration: 120,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true
            }),
        ]).start();

        const newValue = await toggleFavorite(note.id);
        setNote((prev) => (prev ? { ...prev, isFavorite: newValue } : prev));
        showInteractionFeedback(newValue ? 'favorited' : 'unfavorited');
    };

    const handleSaveEdit = async () => {
        if (!note || isDeleting) return;
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
        if (!note || isDeleting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const locationStr = note.locationName || t('noteDetail.unknownLocation');
        const message =
            note.type === 'text'
                ? `📍 ${locationStr}\n\n${note.content}\n\n— Charmly 💛`
                : `${t('noteDetail.sharePhotoMsg', { location: locationStr })}\n\n— Charmly 💛`;

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
        const editIconStyle = {
            opacity: editModeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ scale: editModeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) }],
        };
        const saveIconStyle = {
            opacity: editModeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            transform: [{ scale: editModeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
        };

        return (
            <KeyboardAvoidingView
                style={[styles.sheetSurface, sheetBackgroundStyle]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {interactionFeedback ? (
                    <View pointerEvents="none" style={styles.feedbackOverlay}>
                        <TransientStatusChip
                            key={interactionFeedback.token}
                            {...getFeedbackPresentation(t, interactionFeedback.type)}
                        />
                    </View>
                ) : null}
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
                                    {isEditing ? (
                                        <Text style={styles.editFieldBadge}>
                                            {t('noteDetail.contentField', 'Note')}
                                        </Text>
                                    ) : null}
                                    <TextInput
                                        ref={contentInputRef}
                                        style={[styles.editTextInput, isEditing ? styles.editTextInputActive : null]}
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

                    <Animated.View style={[styles.actionRow, { opacity: actionsOpacity }]}>
                        <AnimatedActionButton
                            onPress={handleToggleFavorite}
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={100}
                            disabled={isDeleting}
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
                                disabled={isDeleting}
                            >
                                <View style={styles.editIconStack}>
                                    <Animated.View style={[styles.editIconLayer, editIconStyle]}>
                                        <Ionicons
                                            name="create-outline"
                                            size={20}
                                            color={colors.secondaryText}
                                        />
                                    </Animated.View>
                                    <Animated.View style={[styles.editIconLayer, saveIconStyle]}>
                                        <Ionicons
                                            name="checkmark"
                                            size={20}
                                            color={colors.success}
                                        />
                                    </Animated.View>
                                </View>
                            </AnimatedActionButton>
                        ) : null}

                        <AnimatedActionButton
                            onPress={handleShare}
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={200}
                            disabled={isDeleting}
                        >
                            <Ionicons name="share-outline" size={20} color={colors.secondaryText} />
                        </AnimatedActionButton>

                        <AnimatedActionButton
                            onPress={handleDelete}
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={250}
                            disabled={isDeleting}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                        </AnimatedActionButton>
                    </Animated.View>

                    {isEditing ? (
                        <Animated.View style={{ opacity: editModeAnim }}>
                            <View
                                style={[
                                    styles.editingHintCard,
                                    {
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                        borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                                    },
                                ]}
                            >
                                <Ionicons name="create-outline" size={16} color={colors.primary} />
                                <Text style={[styles.editingHintText, { color: colors.secondaryText }]}>
                                    {t('noteDetail.editingHint', 'Editing mode: update note and place')}
                                </Text>
                            </View>
                        </Animated.View>
                    ) : null}

                    <Animated.View style={{ opacity: infoOpacity, transform: [{ translateY: infoTranslateY }] }}>
                        <View style={styles.infoSection}>
                            {isEditing ? (
                                <Text style={[styles.editFieldLabel, { color: colors.secondaryText }]}>
                                    {t('noteDetail.locationField', 'Place')}
                                </Text>
                            ) : null}
                            <View
                                style={[
                                    styles.infoRow,
                                    isEditing
                                        ? [
                                            styles.infoRowEditing,
                                            {
                                                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
                                                borderColor: `${colors.primary}66`,
                                            },
                                        ]
                                        : null,
                                ]}
                            >
                                <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                                <TextInput
                                    ref={locationInputRef}
                                    style={[styles.editLocationInput, { color: colors.text }]}
                                    value={isEditing ? editLocation : (note.locationName || t('noteDetail.unknownLocation', 'Unknown Location'))}
                                    onChangeText={isEditing ? setEditLocation : undefined}
                                    editable={isEditing}
                                    placeholder={isEditing ? t('noteDetail.editLocation', 'Edit location name...') : undefined}
                                    placeholderTextColor={colors.secondaryText}
                                    maxLength={100}
                                />
                                {isEditing ? <Ionicons name="create-outline" size={16} color={colors.primary} /> : null}
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
    feedbackOverlay: {
        position: 'absolute',
        top: 14,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
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
    editFieldBadge: {
        position: 'absolute',
        top: 12,
        left: 14,
        backgroundColor: 'rgba(0,0,0,0.25)',
        color: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: '700',
        overflow: 'hidden',
        zIndex: 2,
        fontFamily: 'System',
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
    editTextInputActive: {
        paddingHorizontal: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.55)',
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.12)',
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
    editIconStack: {
        width: 20,
        height: 20,
    },
    editIconLayer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editingHintCard: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editingHintText: {
        ...Typography.body,
        fontSize: 13,
        flex: 1,
    },
    infoSection: {
        gap: 16,
        marginBottom: 32,
    },
    editFieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: -6,
        fontFamily: 'System',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoRowEditing: {
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
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
