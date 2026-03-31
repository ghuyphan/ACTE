import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showAppAlert } from '../utils/alert';
import {
    Dimensions,
    type GestureResponderEvent,
    Keyboard,
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
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import Animated, {
    cancelAnimation,
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { STICKER_ARTBOARD_FRAME } from '../constants/doodleLayout';
import { ENABLE_PHOTO_STICKERS } from '../constants/experiments';
import { NOTE_RADIUS_OPTIONS, formatRadiusLabel } from '../constants/noteRadius';
import { Layout, Typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useActiveNote } from '../hooks/useActiveNote';
import { useNotes } from '../hooks/useNotes';
import { useSharedFeedStore } from '../hooks/useSharedFeed';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSubscription } from '../hooks/useSubscription';
import { useTheme } from '../hooks/useTheme';
import { Note } from '../services/database';
import {
    getTextNoteCardGradient,
    normalizeSavedTextNoteColor,
    PREMIUM_NOTE_COLOR_IDS,
} from '../services/noteAppearance';
import { clearNoteDoodle, parseNoteDoodleStrokes, saveNoteDoodle } from '../services/noteDoodles';
import {
    bringStickerPlacementToFront,
    createStickerPlacement,
    duplicateStickerPlacement,
    importStickerAsset,
    parseNoteStickerPlacements,
    saveNoteStickerPlacementsWithAssets,
    clearNoteStickers,
    StickerImportError,
    setStickerPlacementOutlineEnabled,
    type NoteStickerPlacement,
    updateStickerPlacementTransform,
} from '../services/noteStickers';
import { getNotePhotoUri } from '../services/photoStorage';
import {
    getFallbackFreeNoteColor,
    getPremiumNoteSaveDecision,
    isHologramNoteColor,
    isPreviewablePremiumNoteColor,
    PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS,
} from '../services/premiumNoteFinish';
import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';
import { formatDate } from '../utils/dateUtils';
import { emitInteractionFeedback, InteractionFeedbackType } from '../utils/interactionFeedback';
import {
    ClipboardStickerError,
    hasClipboardStickerImage,
    importStickerAssetFromClipboard,
} from '../utils/stickerClipboard';
import AppSheet from './AppSheet';
import DynamicStickerCanvas from './DynamicStickerCanvas';
import NoteStickerCanvas from './NoteStickerCanvas';
import NoteDoodleCanvas, { DoodleStroke } from './NoteDoodleCanvas';
import StickerSourceSheet from './StickerSourceSheet';
import NoteColorPicker from './ui/NoteColorPicker';
import PremiumNoteFinishOverlay from './ui/PremiumNoteFinishOverlay';
import StickerPastePopover from './ui/StickerPastePopover';
import TransientStatusChip from './ui/TransientStatusChip';

const { width } = Dimensions.get('window');
const CARD_SIZE = width - Layout.screenPadding * 2;
const CARD_FEEDBACK_TOP_OFFSET = 34;
const CARD_FEEDBACK_SIDE_PADDING = 34;
const CARD_OVERLAY_TOP_INSET = 28;
const CARD_OVERLAY_SIDE_INSET = 28;
const STICKER_SOURCE_SHEET_DISMISS_DELAY_MS = 250;

type StickerPastePromptState = {
    visible: boolean;
    x: number;
    y: number;
};

function getStickerImportErrorMessage(
    t: ReturnType<typeof useTranslation>['t'],
    error: unknown
) {
    if (error instanceof StickerImportError) {
        if (error.code === 'unsupported-format') {
            return t(
                'capture.stickerUnsupportedFormat',
                'Please import a transparent PNG or WebP sticker.'
            );
        }

        if (error.code === 'file-unavailable') {
            return t(
                'capture.stickerFileUnavailable',
                'Sticker file is not available on this device.'
            );
        }

        if (error.code === 'missing-transparency') {
            return t(
                'capture.stickerMissingTransparency',
                'This image does not include transparency. Import a transparent PNG or WebP sticker.'
            );
        }
    }

    return error instanceof Error
        ? error.message
        : t('capture.photoImportFailed', 'We could not import that photo right now.');
}

function SkeletonCard({ colors }: { colors: { card: string } }) {
    const opacity = useSharedValue(0.3);
    const animatedOpacityStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.7, { duration: 800 }),
            -1,
            true
        );

        return () => {
            cancelAnimation(opacity);
        };
    }, [opacity]);

    return (
        <View style={styles.scrollContent}>
            <Animated.View
                style={[
                    styles.skeletonCard,
                    { backgroundColor: colors.card },
                    animatedOpacityStyle,
                ]}
            />
            <View style={styles.infoSection}>
                <Animated.View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.card }, animatedOpacityStyle]} />
                <Animated.View style={[styles.skeletonLine, { width: '45%', backgroundColor: colors.card }, animatedOpacityStyle]} />
                <Animated.View style={[styles.skeletonLine, { width: '55%', backgroundColor: colors.card }, animatedOpacityStyle]} />
            </View>
        </View>
    );
}

function AnimatedActionButton({
    onPress,
    children,
    style,
    testID,
    delay = 0,
    disabled = false,
}: {
    onPress: () => void;
    children: React.ReactNode;
    style: object;
    testID?: string;
    delay?: number;
    disabled?: boolean;
}) {
    const scale = useSharedValue(0);
    const pressScale = useSharedValue(1);
    const reduceMotionEnabled = useReducedMotion();
    const animatedButtonStyle = useAnimatedStyle(() => ({
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: scale.value * pressScale.value }],
    }), [disabled]);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withTiming(1, {
                duration: reduceMotionEnabled ? 110 : 140,
                easing: Easing.out(Easing.cubic),
            })
        );
    }, [delay, reduceMotionEnabled, scale]);

    return (
        <Pressable
            testID={testID}
            onPress={onPress}
            disabled={disabled}
            onPressIn={() => {
                pressScale.value = withTiming(reduceMotionEnabled ? 0.97 : 0.93, {
                    duration: 80,
                    easing: Easing.out(Easing.quad),
                });
            }}
            onPressOut={() => {
                pressScale.value = withTiming(1, {
                    duration: 110,
                    easing: Easing.out(Easing.quad),
                });
            }}
        >
            <Animated.View style={[style, animatedButtonStyle]}>
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
    onClosed?: () => void;
}

export default function NoteDetailSheet({ noteId, visible, onClose, onClosed }: NoteDetailSheetProps) {
    const { getNoteById, deleteNote, refreshNotes, updateNote, toggleFavorite } = useNotes();
    const { user } = useAuth();
    const { setActiveNote, clearActiveNote } = useActiveNote();
    const { deleteSharedNote, updateSharedNote } = useSharedFeedStore();
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const {
        tier,
        isPurchaseAvailable,
        plusPriceLabel,
        presentPaywallIfNeeded,
        restorePurchases,
    } = useSubscription();
    const reduceMotionEnabled = useReducedMotion();
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editRadius, setEditRadius] = useState(150);
    const [editNoteColor, setEditNoteColor] = useState<string | null>(null);
    const [editDoodleStrokes, setEditDoodleStrokes] = useState<DoodleStroke[]>([]);
    const [editStickerPlacements, setEditStickerPlacements] = useState<NoteStickerPlacement[]>([]);
    const [doodleModeEnabled, setDoodleModeEnabled] = useState(false);
    const [stickerModeEnabled, setStickerModeEnabled] = useState(false);
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
    const [importingSticker, setImportingSticker] = useState(false);
    const [showStickerSourceSheet, setShowStickerSourceSheet] = useState(false);
    const [pendingStickerSourceAction, setPendingStickerSourceAction] = useState<'photos' | null>(null);
    const [stickerSourceCanPasteFromClipboard, setStickerSourceCanPasteFromClipboard] = useState(false);
    const [pastePrompt, setPastePrompt] = useState<StickerPastePromptState>({ visible: false, x: CARD_SIZE / 2, y: CARD_SIZE / 2 });
    const [interactionFeedback, setInteractionFeedback] = useState<FeedbackState | null>(null);

    const cardScale = useSharedValue(0.92);
    const cardOpacity = useSharedValue(0);
    const infoTranslateY = useSharedValue(20);
    const favoriteFillProgress = useSharedValue(0);
    const editModeAnim = useSharedValue(0);
    const contentInputRef = useRef<TextInput>(null);
    const locationInputRef = useRef<TextInput>(null);
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pastePromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingDeleteNoteIdRef = useRef<string | null>(null);
    const closeCompletionHandledRef = useRef(false);
    const activeNoteKeyRef = useRef(`note-detail-${Math.random().toString(36).slice(2)}`);
    const lastFreeEditNoteColorRef = useRef('marigold-glow');
    const lockedPremiumNoteColorIds = useMemo(
        () => (tier === 'plus' ? [] : PREMIUM_NOTE_COLOR_IDS),
        [tier]
    );
    const previewOnlyNoteColorIds = useMemo(() => {
        if (tier === 'plus' || note?.type !== 'text') {
            return [];
        }

        if (note && isHologramNoteColor(note.noteColor) && editNoteColor === note.noteColor) {
            return [];
        }

        return PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS;
    }, [editNoteColor, note, tier]);
    const cardAnimatedStyle = useAnimatedStyle(() => ({
        opacity: cardOpacity.value,
        transform: [{ scale: cardScale.value }],
    }));
    const favoriteFilledTintStyle = useAnimatedStyle(() => ({
        opacity: favoriteFillProgress.value,
    }));
    const favoriteOutlineIconStyle = useAnimatedStyle(() => ({
        opacity: interpolate(favoriteFillProgress.value, [0, 1], [1, 0]),
        transform: [{ scale: interpolate(favoriteFillProgress.value, [0, 1], [1, 0.82]) }],
    }));
    const favoriteFilledIconStyle = useAnimatedStyle(() => ({
        opacity: interpolate(favoriteFillProgress.value, [0, 1], [0, 1]),
        transform: [{ scale: interpolate(favoriteFillProgress.value, [0, 1], [0.72, 1]) }],
    }));
    const editIconAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(editModeAnim.value, [0, 1], [1, 0]),
        transform: [{ scale: interpolate(editModeAnim.value, [0, 1], [1, 0.72]) }],
    }));
    const saveIconAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(editModeAnim.value, [0, 1], [0, 1]),
        transform: [{ scale: interpolate(editModeAnim.value, [0, 1], [0.72, 1]) }],
    }));
    const editingHintAnimatedStyle = useAnimatedStyle(() => ({
        opacity: editModeAnim.value,
    }));
    const infoSectionAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: infoTranslateY.value }],
    }));

    const showPremiumColorAlert = useCallback(() => {
        const buttons: {
            text: string;
            style?: 'default' | 'cancel' | 'destructive';
            onPress?: () => void;
        }[] = [
            {
                text: t('common.cancel', 'Cancel'),
                style: 'cancel',
            },
        ];

        buttons.push({
            text: t('plus.restorePurchases', 'Restore purchases'),
            onPress: () => {
                void (async () => {
                    const result = await restorePurchases();
                    showAppAlert(
                        result.status === 'success'
                            ? t('plus.restoreSuccessTitle', 'Purchases restored')
                            : t('plus.restoreFailedTitle', 'Could not restore purchases'),
                        result.status === 'success'
                            ? t(
                                'plus.restoreSuccessMessage',
                                'Your Noto Plus access has been refreshed for this device.'
                            )
                            : (
                                result.message ??
                                t(
                                    'plus.restoreFailedMessage',
                                    'We could not refresh your purchases right now. Please try again later.'
                                )
                            )
                    );
                })();
            },
        });

        if (isPurchaseAvailable) {
            buttons.push({
                text: plusPriceLabel
                    ? t('plus.upgradeCtaWithPrice', 'Upgrade to Plus · {{price}}', {
                        price: plusPriceLabel,
                    })
                    : t('plus.upgradeCta', 'Upgrade to Plus'),
                onPress: () => {
                    void (async () => {
                        const result = await presentPaywallIfNeeded();
                        if (
                            result === PAYWALL_RESULT.PURCHASED ||
                            result === PAYWALL_RESULT.RESTORED
                        ) {
                            showAppAlert(
                                t('plus.upgradeSuccessTitle', 'Noto Plus is ready'),
                                t(
                                    'plus.upgradeSuccessMessage',
                                    'You can now save more photo notes and import images from your library.'
                                )
                            );
                        }
                    })();
                },
            });
        }

        showAppAlert(
            t('plus.colorTitle', 'Premium card finishes'),
            t(
                'plus.colorMessage',
                'Holographic, RGB, and foil-inspired card finishes are part of Noto Plus.'
            ),
            buttons
        );
    }, [isPurchaseAvailable, plusPriceLabel, presentPaywallIfNeeded, restorePurchases, t]);

    const promptHologramSaveChoice = useCallback(() => {
        return new Promise<'upgrade-success' | 'switch' | 'cancel'>((resolve) => {
            let settled = false;
            const settle = (value: 'upgrade-success' | 'switch' | 'cancel') => {
                if (settled) {
                    return;
                }

                settled = true;
                resolve(value);
            };

            showAppAlert(
                t('plus.hologramSaveTitle', 'Save this hologram card with Plus'),
                t(
                    'plus.hologramSaveMessage',
                    'The hologram finish is ready to preview. Upgrade to Plus to save it, or switch back to a standard finish.'
                ),
                [
                    {
                        text: t('common.cancel', 'Cancel'),
                        style: 'cancel',
                        onPress: () => settle('cancel'),
                    },
                    {
                        text: t('plus.useStandardFinish', 'Use standard finish'),
                        onPress: () => settle('switch'),
                    },
                    {
                        text: plusPriceLabel
                            ? t('plus.upgradeCtaWithPrice', 'Upgrade to Plus · {{price}}', {
                                price: plusPriceLabel,
                            })
                            : t('plus.upgradeCta', 'Upgrade to Plus'),
                        onPress: () => {
                            void (async () => {
                                if (!isPurchaseAvailable) {
                                    showAppAlert(
                                        t('plus.upgradeUnavailableTitle', 'Plus unavailable'),
                                        t(
                                            'plus.upgradeUnavailableMessage',
                                            'We could not complete the purchase right now. Please try again in a moment.'
                                        )
                                    );
                                    settle('cancel');
                                    return;
                                }

                                const result = await presentPaywallIfNeeded();
                                if (
                                    result === PAYWALL_RESULT.PURCHASED ||
                                    result === PAYWALL_RESULT.RESTORED
                                ) {
                                    settle('upgrade-success');
                                    return;
                                }

                                if (
                                    result === PAYWALL_RESULT.CANCELLED ||
                                    result === PAYWALL_RESULT.NOT_PRESENTED
                                ) {
                                    settle('cancel');
                                    return;
                                }

                                showAppAlert(
                                    t('plus.upgradeUnavailableTitle', 'Plus unavailable'),
                                    t(
                                        'plus.upgradeUnavailableMessage',
                                        'We could not complete the purchase right now. Please try again in a moment.'
                                    )
                                );
                                settle('cancel');
                            })();
                        },
                    },
                ]
            );
        });
    }, [isPurchaseAvailable, plusPriceLabel, presentPaywallIfNeeded, t]);

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

    const clearPastePromptTimeout = useCallback(() => {
        if (pastePromptTimeoutRef.current) {
            clearTimeout(pastePromptTimeoutRef.current);
            pastePromptTimeoutRef.current = null;
        }
    }, []);

    const dismissPastePrompt = useCallback(() => {
        clearPastePromptTimeout();
        setPastePrompt((current) => (current.visible ? { ...current, visible: false } : current));
    }, [clearPastePromptTimeout]);

    const schedulePastePromptDismiss = useCallback(() => {
        clearPastePromptTimeout();
        pastePromptTimeoutRef.current = setTimeout(() => {
            setPastePrompt((current) => ({ ...current, visible: false }));
            pastePromptTimeoutRef.current = null;
        }, 2600);
    }, [clearPastePromptTimeout]);

    useEffect(() => {
        if (visible && noteId) {
            setActiveNote(activeNoteKeyRef.current, noteId);

            return () => {
                clearActiveNote(activeNoteKeyRef.current);
            };
        }

        clearActiveNote(activeNoteKeyRef.current);
        return undefined;
    }, [clearActiveNote, noteId, setActiveNote, visible]);

    useEffect(() => {
        if (!visible || !noteId) {
            return;
        }

        let cancelled = false;
        closeCompletionHandledRef.current = false;
        setLoading(true);
        setNote(null);
        setIsEditing(false);
        setIsDeleting(false);
        pendingDeleteNoteIdRef.current = null;
        setEditContent('');
        setEditLocation('');
        setEditRadius(150);
        setEditNoteColor(null);
        setEditDoodleStrokes([]);
        setEditStickerPlacements([]);
        setDoodleModeEnabled(false);
        setStickerModeEnabled(false);
        setSelectedStickerId(null);
        setShowStickerSourceSheet(false);
        favoriteFillProgress.value = 0;
        cardScale.value = 0.97;
        cardOpacity.value = 0;
        infoTranslateY.value = 12;
        editModeAnim.value = 0;

        getNoteById(noteId)
            .then((nextNote) => {
                if (cancelled) {
                    return;
                }

                setNote(nextNote);
                favoriteFillProgress.value = nextNote?.isFavorite ? 1 : 0;
                if (nextNote) {
                    setEditContent(nextNote.content);
                    setEditLocation(nextNote.locationName || '');
                    setEditRadius(nextNote.radius);
                    setEditNoteColor(
                        nextNote.type === 'text'
                            ? normalizeSavedTextNoteColor(nextNote.noteColor)
                            : null
                    );
                    if (nextNote.type === 'text' && !isPreviewablePremiumNoteColor(nextNote.noteColor)) {
                        lastFreeEditNoteColorRef.current = normalizeSavedTextNoteColor(nextNote.noteColor);
                    }
                    setEditDoodleStrokes(parseNoteDoodleStrokes(nextNote.doodleStrokesJson));
                    setEditStickerPlacements(parseNoteStickerPlacements(nextNote.stickerPlacementsJson));
                    setDoodleModeEnabled(false);
                    setStickerModeEnabled(false);
                    setSelectedStickerId(null);
                }
                setLoading(false);

                cardScale.value = withTiming(1, {
                        duration: reduceMotionEnabled ? 140 : 180,
                        easing: Easing.out(Easing.cubic),
                    });
                cardOpacity.value = withTiming(1, {
                        duration: reduceMotionEnabled ? 140 : 180,
                        easing: Easing.out(Easing.cubic),
                    });
                infoTranslateY.value = withDelay(
                    100,
                    withTiming(0, {
                        duration: reduceMotionEnabled ? 140 : 180,
                        easing: Easing.out(Easing.cubic),
                    })
                );
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setNote(null);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [cardOpacity, cardScale, editModeAnim, favoriteFillProgress, getNoteById, infoTranslateY, noteId, reduceMotionEnabled, visible]);

    useEffect(() => {
        if (!isEditing || !note || importingSticker) {
            setShowStickerSourceSheet(false);
        }
    }, [importingSticker, isEditing, note]);

    useEffect(() => {
        cancelAnimation(favoriteFillProgress);
        favoriteFillProgress.value = withTiming(note?.isFavorite ? 1 : 0, {
            duration: reduceMotionEnabled ? 120 : 180,
            easing: Easing.out(Easing.cubic),
        });
    }, [favoriteFillProgress, note?.isFavorite, reduceMotionEnabled]);

    useEffect(() => {
        editModeAnim.value = withTiming(isEditing ? 1 : 0, {
            duration: reduceMotionEnabled ? 100 : 180,
        });
    }, [editModeAnim, isEditing, reduceMotionEnabled]);

    useEffect(() => {
        if (!isEditing) {
            setDoodleModeEnabled(false);
            setStickerModeEnabled(false);
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

    useEffect(() => () => clearPastePromptTimeout(), [clearPastePromptTimeout]);

    useEffect(() => {
        if (!isEditing || doodleModeEnabled || stickerModeEnabled || importingSticker || !visible) {
            dismissPastePrompt();
        }
    }, [dismissPastePrompt, doodleModeEnabled, importingSticker, isEditing, stickerModeEnabled, visible]);

    useEffect(() => {
        if (!editNoteColor || isPreviewablePremiumNoteColor(editNoteColor)) {
            return;
        }

        lastFreeEditNoteColorRef.current = normalizeSavedTextNoteColor(editNoteColor);
    }, [editNoteColor]);

    const parsedNoteDoodleStrokes = useMemo(
        () => parseNoteDoodleStrokes(note?.doodleStrokesJson),
        [note?.doodleStrokesJson]
    );
    const parsedNoteStickerPlacements = useMemo(
        () => parseNoteStickerPlacements(note?.stickerPlacementsJson),
        [note?.stickerPlacementsJson]
    );

    const handleToggleDoodleMode = useCallback(() => {
        if (!isEditing || !note) {
            return;
        }

        dismissPastePrompt();
        Keyboard.dismiss();
        setStickerModeEnabled(false);
        setDoodleModeEnabled((current) => !current);
    }, [dismissPastePrompt, isEditing, note]);

    const handleUndoDoodle = useCallback(() => {
        setEditDoodleStrokes((current) => current.slice(0, -1));
    }, []);

    const handleClearDoodle = useCallback(() => {
        setEditDoodleStrokes([]);
    }, []);
    const handleImportSticker = useCallback(async () => {
        if (!ENABLE_PHOTO_STICKERS || !isEditing || !note || importingSticker) {
            return;
        }

        dismissPastePrompt();
        Keyboard.dismiss();

        let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (mediaPermission.status !== 'granted') {
            mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        }

        if (mediaPermission.status !== 'granted') {
            showAppAlert(
                t('capture.photoLibraryPermissionTitle', 'Photo access needed'),
                mediaPermission.canAskAgain === false
                    ? t(
                        'capture.photoLibraryPermissionSettingsMsg',
                        'Photo library access is blocked for Noto. Open Settings to import from your library.'
                    )
                    : t(
                        'capture.photoLibraryPermissionMsg',
                        'Allow photo library access so you can import an image into this note.'
                    )
            );
            return;
        }

        setImportingSticker(true);
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
                selectionLimit: 1,
            });

            if (result.canceled || !result.assets?.[0]?.uri) {
                return;
            }

            const importedAsset = await importStickerAsset({
                uri: result.assets[0].uri,
                mimeType: result.assets[0].mimeType,
                name: result.assets[0].fileName,
            });

            const nextPlacement = createStickerPlacement(importedAsset, editStickerPlacements);
            setEditStickerPlacements((current) => [...current, nextPlacement]);
            setSelectedStickerId(nextPlacement.id);
            setStickerModeEnabled(true);
            setDoodleModeEnabled(false);
        } catch (error) {
            console.warn('Sticker import failed:', error);
            showAppAlert(
                t('capture.error', 'Error'),
                getStickerImportErrorMessage(t, error)
            );
        } finally {
            setImportingSticker(false);
        }
    }, [dismissPastePrompt, editStickerPlacements, importingSticker, isEditing, note, t]);
    useEffect(() => {
        if (showStickerSourceSheet || pendingStickerSourceAction !== 'photos') {
            return;
        }

        const timer = setTimeout(() => {
            setPendingStickerSourceAction(null);
            void handleImportSticker();
        }, STICKER_SOURCE_SHEET_DISMISS_DELAY_MS);

        return () => clearTimeout(timer);
    }, [handleImportSticker, pendingStickerSourceAction, showStickerSourceSheet]);
    const handlePasteStickerFromClipboard = useCallback(async () => {
        if (!ENABLE_PHOTO_STICKERS || !isEditing || !note || importingSticker) {
            return;
        }

        dismissPastePrompt();
        Keyboard.dismiss();
        setImportingSticker(true);
        try {
            const importedAsset = await importStickerAssetFromClipboard({
                requiresUpdate: t(
                    'capture.clipboardStickerRequiresUpdateMsg',
                    'Clipboard sticker paste needs the latest app build. Restart the iOS app after rebuilding to use this.'
                ),
                unavailable: t(
                    'capture.clipboardStickerUnavailableMsg',
                    'Copy a transparent sticker image first, then long press again to paste it.'
                ),
                unsupported: t(
                    'capture.clipboardStickerUnsupported',
                    'We could not read that clipboard image right now.'
                ),
                storageUnavailable: t(
                    'capture.clipboardStickerStorageUnavailable',
                    'Sticker storage is unavailable on this device.'
                ),
                permissionDenied: t(
                    'capture.clipboardStickerPermissionDeniedMsg',
                    'This device will not let Noto read that clipboard image right now. Try copying it again, or import it from Photos instead.'
                ),
            });

            const nextPlacement = createStickerPlacement(importedAsset, editStickerPlacements);
            setEditStickerPlacements((current) => [...current, nextPlacement]);
            setSelectedStickerId(nextPlacement.id);
            setStickerModeEnabled(true);
            setDoodleModeEnabled(false);
        } catch (error) {
            if (!(error instanceof ClipboardStickerError && error.code === 'permission-denied')) {
                console.warn('Sticker paste failed:', error);
            }
            const alertTitle =
                error instanceof ClipboardStickerError && error.code === 'unavailable'
                    ? t('capture.clipboardStickerUnavailableTitle', 'No sticker to paste')
                    : error instanceof ClipboardStickerError && error.code === 'requires-update'
                        ? t('capture.clipboardStickerRequiresUpdateTitle', 'Update required')
                        : error instanceof ClipboardStickerError && error.code === 'permission-denied'
                            ? t('capture.clipboardStickerPermissionDeniedTitle', 'Paste blocked')
                        : t('capture.error', 'Error');
            showAppAlert(
                alertTitle,
                error instanceof Error
                    ? error.message
                    : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
            );
        } finally {
            setImportingSticker(false);
        }
    }, [dismissPastePrompt, editStickerPlacements, importingSticker, isEditing, note, t]);
    const handleShowCardPastePrompt = useCallback(
        async (event: GestureResponderEvent) => {
            if (
                !ENABLE_PHOTO_STICKERS ||
                !isEditing ||
                !note ||
                importingSticker ||
                doodleModeEnabled ||
                stickerModeEnabled ||
                editStickerPlacements.length > 0
            ) {
                return;
            }

            const canPasteFromClipboard = await hasClipboardStickerImage();

            if (!canPasteFromClipboard) {
                dismissPastePrompt();
                return;
            }

            const locationX = typeof event.nativeEvent.locationX === 'number' ? event.nativeEvent.locationX : CARD_SIZE / 2;
            const locationY = typeof event.nativeEvent.locationY === 'number' ? event.nativeEvent.locationY : CARD_SIZE / 2;

            setPastePrompt({
                visible: true,
                x: locationX,
                y: locationY,
            });
            schedulePastePromptDismiss();
        },
        [
            dismissPastePrompt,
            doodleModeEnabled,
            editStickerPlacements.length,
            importingSticker,
            isEditing,
            note,
            schedulePastePromptDismiss,
            stickerModeEnabled,
        ]
    );
    const handleConfirmPasteFromPrompt = useCallback(() => {
        dismissPastePrompt();
        void handlePasteStickerFromClipboard();
    }, [dismissPastePrompt, handlePasteStickerFromClipboard]);
    const handleCloseStickerSourceSheet = useCallback(() => {
        setShowStickerSourceSheet(false);
    }, []);
    const handleSelectStickerSourceClipboard = useCallback(() => {
        setShowStickerSourceSheet(false);
        void handlePasteStickerFromClipboard();
    }, [handlePasteStickerFromClipboard]);
    const handleSelectStickerSourcePhotos = useCallback(() => {
        setPendingStickerSourceAction('photos');
        setShowStickerSourceSheet(false);
    }, []);
    const handleShowStickerSourceOptions = useCallback(async () => {
        if (!ENABLE_PHOTO_STICKERS || !isEditing || !note || importingSticker) {
            return;
        }

        dismissPastePrompt();
        Keyboard.dismiss();
        const canPasteFromClipboard = await hasClipboardStickerImage();
        setStickerSourceCanPasteFromClipboard(canPasteFromClipboard);
        setShowStickerSourceSheet(true);
    }, [dismissPastePrompt, importingSticker, isEditing, note]);
    const handleToggleStickerMode = useCallback(() => {
        if (!ENABLE_PHOTO_STICKERS || !isEditing || !note) {
            return;
        }

        dismissPastePrompt();
        Keyboard.dismiss();
        setDoodleModeEnabled(false);
        setStickerModeEnabled((current) => !current);
        if (stickerModeEnabled) {
            setSelectedStickerId(null);
        }
    }, [dismissPastePrompt, isEditing, note, stickerModeEnabled]);
    const handlePressStickerCanvas = useCallback(() => {
        if (!stickerModeEnabled) {
            return;
        }

        dismissPastePrompt();

        if (selectedStickerId) {
            setSelectedStickerId(null);
            return;
        }

        setStickerModeEnabled(false);
    }, [dismissPastePrompt, selectedStickerId, stickerModeEnabled]);
    const handleStickerAction = useCallback(
        (action: 'rotate-left' | 'rotate-right' | 'smaller' | 'larger' | 'duplicate' | 'front' | 'remove' | 'outline-toggle') => {
            if (!selectedStickerId) {
                return;
            }

            let nextPlacements = editStickerPlacements;

            if (action === 'duplicate') {
                nextPlacements = duplicateStickerPlacement(editStickerPlacements, selectedStickerId);
            } else if (action === 'front') {
                nextPlacements = bringStickerPlacementToFront(editStickerPlacements, selectedStickerId);
            } else if (action === 'outline-toggle') {
                const selectedPlacement = editStickerPlacements.find((placement) => placement.id === selectedStickerId);
                nextPlacements = selectedPlacement
                    ? setStickerPlacementOutlineEnabled(
                        editStickerPlacements,
                        selectedStickerId,
                        selectedPlacement.outlineEnabled === false
                    )
                    : editStickerPlacements;
            } else if (action === 'remove') {
                nextPlacements = editStickerPlacements.filter((placement) => placement.id !== selectedStickerId);
                setSelectedStickerId(null);
            } else {
                const selectedPlacement = editStickerPlacements.find((placement) => placement.id === selectedStickerId);
                if (!selectedPlacement) {
                    return;
                }

                if (action === 'rotate-left') {
                    nextPlacements = updateStickerPlacementTransform(editStickerPlacements, selectedStickerId, {
                        rotation: selectedPlacement.rotation - 15,
                    });
                } else if (action === 'rotate-right') {
                    nextPlacements = updateStickerPlacementTransform(editStickerPlacements, selectedStickerId, {
                        rotation: selectedPlacement.rotation + 15,
                    });
                } else if (action === 'smaller') {
                    nextPlacements = updateStickerPlacementTransform(editStickerPlacements, selectedStickerId, {
                        scale: selectedPlacement.scale - 0.12,
                    });
                } else if (action === 'larger') {
                    nextPlacements = updateStickerPlacementTransform(editStickerPlacements, selectedStickerId, {
                        scale: selectedPlacement.scale + 0.12,
                    });
                }
            }

            setEditStickerPlacements(nextPlacements);
        },
        [editStickerPlacements, selectedStickerId]
    );

    useEffect(() => () => {
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
    }, []);

    const performDelete = useCallback(async (targetNoteId: string) => {
        try {
            await deleteNote(targetNoteId);
            emitInteractionFeedback('deleted');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (user) {
                try {
                    await deleteSharedNote(targetNoteId);
                } catch (error) {
                    console.error('Shared delete failed:', error);
                    showAppAlert(
                        t('noteDetail.deleteWarningTitle', 'Deleted locally'),
                        t(
                            'noteDetail.deleteWarningMsg',
                            'This note was removed from your device, but the shared copy could not be removed yet.'
                        )
                    );
                }
            }
        } catch (error) {
            console.error('Delete failed:', error);
            showAppAlert(
                t('noteDetail.deleteErrorTitle', 'Delete failed'),
                t('noteDetail.deleteErrorMsg', 'Unable to delete this note right now. Please try again.')
            );
        } finally {
            setIsDeleting(false);
        }
    }, [deleteNote, deleteSharedNote, t, user]);

    useEffect(() => {
        if (visible) {
            closeCompletionHandledRef.current = false;
            return;
        }

        const closeDelay = reduceMotionEnabled ? 40 : 220;
        const timer = setTimeout(() => {
            if (closeCompletionHandledRef.current) {
                return;
            }

            closeCompletionHandledRef.current = true;
            const pendingDeleteNoteId = pendingDeleteNoteIdRef.current;
            pendingDeleteNoteIdRef.current = null;

            if (pendingDeleteNoteId) {
                void performDelete(pendingDeleteNoteId).finally(() => {
                    onClosed?.();
                });
                return;
            }

            onClosed?.();
        }, closeDelay);

        return () => clearTimeout(timer);
    }, [onClosed, performDelete, reduceMotionEnabled, visible]);

    const handleSheetDismiss = useCallback(() => {
        onClose();
    }, [onClose]);

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showAppAlert(
            t('noteDetail.deleteTitle', 'Delete Note'),
            t('noteDetail.deleteMsg', 'This note and its geofence will be permanently removed.'),
            [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('common.delete', 'Delete'),
                    style: 'destructive',
                    onPress: () => {
                        if (!note || isDeleting) {
                            return;
                        }

                        pendingDeleteNoteIdRef.current = note.id;
                        setIsDeleting(true);
                        onClose();
                    },
                },
            ]
        );
    };

    const handleToggleFavorite = async () => {
        if (!note || isDeleting) return;
        const previousValue = note.isFavorite;
        const nextValue = !previousValue;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setNote((prev) => (prev ? { ...prev, isFavorite: nextValue } : prev));

        try {
            const newValue = await toggleFavorite(note.id);
            setNote((prev) => (prev ? { ...prev, isFavorite: newValue } : prev));
            showInteractionFeedback(newValue ? 'favorited' : 'unfavorited');
        } catch (error) {
            console.error('Favorite toggle failed:', error);
            setNote((prev) => (prev ? { ...prev, isFavorite: previousValue } : prev));
            showAppAlert(
                t('noteDetail.favoriteErrorTitle', 'Could not update favorite'),
                t('noteDetail.favoriteErrorMsg', 'Please try again in a moment.')
            );
        }
    };

    const renderFavoriteBadge = (backgroundColor: string, inactiveColor: string) => (
        <Pressable
            testID="note-detail-favorite"
            onPress={handleToggleFavorite}
            style={[styles.cardFavBadge, { backgroundColor }]}
        >
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.favoriteBadgeTint,
                    favoriteFilledTintStyle,
                ]}
            />
            <View style={styles.favoriteIconStack}>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.favoriteIconLayer,
                        favoriteOutlineIconStyle,
                    ]}
                >
                    <Ionicons name="heart-outline" size={20} color={inactiveColor} />
                </Animated.View>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.favoriteIconLayer,
                        favoriteFilledIconStyle,
                    ]}
                >
                    <Ionicons name="heart" size={20} color="#FF3B30" />
                </Animated.View>
            </View>
        </Pressable>
    );

    const handleSaveEdit = async () => {
        if (!note || isDeleting) return;
        const updates: Partial<Pick<Note, 'content' | 'locationName' | 'moodEmoji' | 'noteColor' | 'radius'>> = {};
        const currentNoteColor =
            note.type === 'text' ? normalizeSavedTextNoteColor(note.noteColor) : null;
        if (note.type === 'text') {
            const saveDecision = getPremiumNoteSaveDecision({
                tier,
                selectedNoteColor: editNoteColor,
                existingNoteColor: currentNoteColor,
            });

            if (saveDecision === 'upsell_required') {
                const choice = await promptHologramSaveChoice();
                if (choice === 'switch') {
                    setEditNoteColor(
                        getFallbackFreeNoteColor(lastFreeEditNoteColorRef.current, currentNoteColor)
                    );
                }
                if (choice !== 'upgrade-success') {
                    return;
                }
            }
        }
        const nextDoodleStrokesJson =
            editDoodleStrokes.length > 0 ? JSON.stringify(editDoodleStrokes) : null;
        const nextHasDoodle = Boolean(nextDoodleStrokesJson);
        const doodleChanged = nextDoodleStrokesJson !== (note.doodleStrokesJson ?? null);
        const nextStickerPlacementsJson =
            editStickerPlacements.length > 0 ? JSON.stringify(editStickerPlacements) : null;
        const nextHasStickers = Boolean(nextStickerPlacementsJson);
        const stickersChanged = nextStickerPlacementsJson !== (note.stickerPlacementsJson ?? null);

        if (note.type === 'text' && editContent.trim() !== note.content) {
            updates.content = editContent.trim();
        }
        if (editLocation.trim() !== (note.locationName || '')) {
            updates.locationName = editLocation.trim() || null;
        }
        if (editRadius !== note.radius) {
            updates.radius = editRadius;
        }
        if (note.type === 'text' && editNoteColor !== currentNoteColor) {
            updates.noteColor = editNoteColor ?? currentNoteColor;
        }

        if (Object.keys(updates).length > 0 || doodleChanged || stickersChanged) {
            const nextUpdatedAt = new Date().toISOString();
            const storeUpdates = {
                ...updates,
                ...(doodleChanged
                    ? {
                        hasDoodle: nextHasDoodle,
                        doodleStrokesJson: nextDoodleStrokesJson,
                    }
                    : {}),
                ...(stickersChanged
                    ? {
                        hasStickers: nextHasStickers,
                        stickerPlacementsJson: nextStickerPlacementsJson,
                    }
                    : {}),
            };
            const nextNote = {
                ...note,
                ...storeUpdates,
                content: updates.content ?? note.content,
                noteColor: updates.noteColor !== undefined ? updates.noteColor : currentNoteColor,
                hasDoodle: doodleChanged ? nextHasDoodle : note.hasDoodle,
                doodleStrokesJson: doodleChanged ? nextDoodleStrokesJson : note.doodleStrokesJson ?? null,
                hasStickers: stickersChanged ? nextHasStickers : note.hasStickers,
                stickerPlacementsJson: stickersChanged ? nextStickerPlacementsJson : note.stickerPlacementsJson ?? null,
                updatedAt: nextUpdatedAt,
            };

            if (doodleChanged) {
                if (nextDoodleStrokesJson) {
                    await saveNoteDoodle(note.id, nextDoodleStrokesJson);
                } else {
                    await clearNoteDoodle(note.id);
                }
            }

            if (stickersChanged) {
                if (nextStickerPlacementsJson) {
                    await saveNoteStickerPlacementsWithAssets(note.id, editStickerPlacements);
                } else {
                    await clearNoteStickers(note.id);
                }
            }

            await updateNote(note.id, storeUpdates);
            await refreshNotes(false);
            setNote(nextNote);
            setEditDoodleStrokes(parseNoteDoodleStrokes(nextDoodleStrokesJson));
            setEditStickerPlacements(parseNoteStickerPlacements(nextStickerPlacementsJson));
            setEditContent(nextNote.content);
            setEditLocation(nextNote.locationName || '');
            setEditRadius(nextNote.radius);
            setEditNoteColor(
                nextNote.type === 'text'
                    ? normalizeSavedTextNoteColor(nextNote.noteColor)
                    : null
            );
            setDoodleModeEnabled(false);
            setStickerModeEnabled(false);
            setSelectedStickerId(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsEditing(false);

            if (user) {
                void updateSharedNote(nextNote).catch((error) => {
                    console.warn('Shared note update failed:', error);
                    showAppAlert(
                        t('noteDetail.updateWarningTitle', 'Saved locally'),
                        t(
                            'noteDetail.updateWarningMsg',
                            'This note was updated on your device, but the shared copy could not be refreshed yet.'
                        )
                    );
                });
            }
            return;
        }
        setDoodleModeEnabled(false);
        setStickerModeEnabled(false);
        setIsEditing(false);
    };

    const handleShare = async () => {
        if (!note || isDeleting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const locationStr = note.locationName || t('noteDetail.unknownLocation');
        const photoUri = getNotePhotoUri(note);
        const message =
            note.type === 'text'
                ? `📍 ${locationStr}\n\n${formatNoteTextWithEmoji(note.content, note.moodEmoji)}\n\n— Noto 💛`
                : `${t('noteDetail.sharePhotoMsg', { location: locationStr })}\n\n— Noto 💛`;

        try {
            if (note.type === 'photo' && photoUri) {
                await Share.share({ message, url: photoUri });
                return;
            }

            await Share.share({ message });
        } catch {
            return;
        }
    };

    const renderBody = () => {
        if (loading) {
            return (
                <View style={styles.sheetSurface}>
                    <SkeletonCard colors={{ card: colors.card }} />
                </View>
            );
        }

        if (!note) {
            return (
                <View style={[styles.center, styles.sheetSurface, { minHeight: 200 }]}>
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
        const gradient = getTextNoteCardGradient({
            text: isEditing ? editContent : note.content,
            noteId: note.id,
            emoji: note.moodEmoji,
            noteColor: isEditing ? editNoteColor : note.noteColor,
        });
        const displayedDoodleStrokes = isEditing ? editDoodleStrokes : parsedNoteDoodleStrokes;
        const displayedStickerPlacements = isEditing ? editStickerPlacements : parsedNoteStickerPlacements;
        const selectedStickerPlacement =
            displayedStickerPlacements.find((placement) => placement.id === selectedStickerId) ?? null;
        const selectedStickerOutlineEnabled = selectedStickerPlacement?.outlineEnabled !== false;

        return (
            <KeyboardAvoidingView
                style={styles.sheetSurface}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {interactionFeedback ? (
                    <View pointerEvents="none" style={styles.feedbackOverlay}>
                        <TransientStatusChip
                            key={interactionFeedback.token}
                            style={styles.feedbackChip}
                            {...getFeedbackPresentation(t, interactionFeedback.type)}
                        />
                    </View>
                ) : null}
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Animated.View style={cardAnimatedStyle}>
                        {note.type === 'photo' ? (
                            <View style={styles.photoContainer}>
                                <View style={styles.photo}>
                                    <Image source={{ uri: getNotePhotoUri(note) }} style={styles.photo} contentFit="cover" transition={300} />
                                </View>
                                {isEditing && ENABLE_PHOTO_STICKERS ? (
                                    <Pressable
                                        testID="note-detail-card-paste-surface"
                                        style={styles.cardPasteSurface}
                                        onLongPress={handleShowCardPastePrompt}
                                        delayLongPress={320}
                                    />
                                ) : null}
                                {displayedStickerPlacements.length > 0 || (isEditing && stickerModeEnabled) ? (
                                    <View
                                        pointerEvents={isEditing && stickerModeEnabled ? 'box-none' : 'none'}
                                        style={[
                                            styles.doodleOverlay,
                                            styles.photoDoodleOverlay,
                                            isEditing ? styles.doodleOverlayEditing : null,
                                            isEditing && stickerModeEnabled ? styles.doodleOverlayActive : null,
                                        ]}
                                    >
                                        {isEditing ? (
                                            <NoteStickerCanvas
                                                placements={displayedStickerPlacements}
                                                editable={stickerModeEnabled}
                                                onChangePlacements={setEditStickerPlacements}
                                                selectedPlacementId={selectedStickerId}
                                                onChangeSelectedPlacementId={setSelectedStickerId}
                                                onPressCanvas={handlePressStickerCanvas}
                                            />
                                        ) : (
                                            <DynamicStickerCanvas placements={displayedStickerPlacements} />
                                        )}
                                    </View>
                                ) : null}
                                {displayedDoodleStrokes.length > 0 || isEditing ? (
                                    <View
                                        pointerEvents={isEditing && doodleModeEnabled ? 'auto' : 'none'}
                                        style={[
                                            styles.doodleOverlay,
                                            styles.photoDoodleOverlay,
                                            isEditing ? styles.doodleOverlayEditing : null,
                                            isEditing && doodleModeEnabled ? styles.doodleOverlayActive : null,
                                        ]}
                                    >
                                        <NoteDoodleCanvas
                                            strokes={displayedDoodleStrokes}
                                            editable={isEditing && doodleModeEnabled}
                                            activeColor="#FFFFFF"
                                            onChangeStrokes={setEditDoodleStrokes}
                                        />
                                    </View>
                                ) : null}
                                {isEditing ? (
                                    <View style={styles.textEditHeader}>
                                        <Text style={styles.editFieldBadge}>
                                            {t('noteDetail.contentField', 'Note')}
                                        </Text>
                                        <View style={styles.textCardActionCluster}>
                                            <Pressable
                                                testID="note-detail-doodle-toggle"
                                                onPress={handleToggleDoodleMode}
                                                style={[
                                                    styles.textCardActionButton,
                                                    doodleModeEnabled ? styles.textCardActionButtonActive : null,
                                                ]}
                                            >
                                                <Ionicons
                                                    name={doodleModeEnabled ? 'create' : 'create-outline'}
                                                    size={16}
                                                    color="#FFFFFF"
                                                />
                                            </Pressable>
                                            {ENABLE_PHOTO_STICKERS ? (
                                                <Pressable
                                                    testID="note-detail-sticker-toggle"
                                                    onPress={handleToggleStickerMode}
                                                    style={[
                                                        styles.textCardActionButton,
                                                        stickerModeEnabled ? styles.textCardActionButtonActive : null,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={stickerModeEnabled ? 'images' : 'images-outline'}
                                                        size={16}
                                                        color="#FFFFFF"
                                                    />
                                                </Pressable>
                                            ) : null}
                                            {doodleModeEnabled ? (
                                                <View style={styles.textCardActionCluster}>
                                                    <Pressable
                                                        testID="note-detail-doodle-undo"
                                                        onPress={handleUndoDoodle}
                                                        disabled={editDoodleStrokes.length === 0}
                                                        style={[
                                                            styles.textCardActionPill,
                                                            editDoodleStrokes.length === 0
                                                                ? styles.textCardActionDisabled
                                                                : null,
                                                        ]}
                                                    >
                                                        <Ionicons name="arrow-undo-outline" size={14} color="#FFFFFF" />
                                                    </Pressable>
                                                    <Pressable
                                                        testID="note-detail-doodle-clear"
                                                        onPress={handleClearDoodle}
                                                        disabled={editDoodleStrokes.length === 0}
                                                        style={[
                                                            styles.textCardActionPill,
                                                            editDoodleStrokes.length === 0
                                                                ? styles.textCardActionDisabled
                                                                : null,
                                                        ]}
                                                    >
                                                        <Ionicons name="close-outline" size={14} color="#FFFFFF" />
                                                    </Pressable>
                                                </View>
                                            ) : stickerModeEnabled ? (
                                                <View style={styles.textCardActionCluster}>
                                                    <Pressable
                                                        testID="note-detail-sticker-import"
                                                        onPress={() => {
                                                            void handleShowStickerSourceOptions();
                                                        }}
                                                        disabled={importingSticker}
                                                        style={[
                                                            styles.textCardActionPill,
                                                            importingSticker ? styles.textCardActionDisabled : null,
                                                        ]}
                                                    >
                                                        <Ionicons name="add-outline" size={14} color="#FFFFFF" />
                                                    </Pressable>
                                                    <Pressable
                                                        testID="note-detail-sticker-outline-toggle"
                                                        accessibilityLabel={
                                                            selectedStickerOutlineEnabled
                                                                ? t('capture.stickerOutlineDisable', 'Turn off outline')
                                                                : t('capture.stickerOutlineEnable', 'Turn on outline')
                                                        }
                                                        onPress={() => handleStickerAction('outline-toggle')}
                                                        disabled={!selectedStickerId}
                                                        style={[
                                                            styles.textCardActionPill,
                                                            selectedStickerOutlineEnabled && selectedStickerId
                                                                ? styles.textCardActionPillActive
                                                                : null,
                                                            !selectedStickerId ? styles.textCardActionDisabled : null,
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name={selectedStickerOutlineEnabled ? 'ellipse' : 'ellipse-outline'}
                                                            size={14}
                                                            color="#FFFFFF"
                                                        />
                                                    </Pressable>
                                                    <Pressable
                                                        testID="note-detail-sticker-remove"
                                                        onPress={() => handleStickerAction('remove')}
                                                        disabled={!selectedStickerId}
                                                        style={[
                                                            styles.textCardActionPill,
                                                            !selectedStickerId ? styles.textCardActionDisabled : null,
                                                        ]}
                                                    >
                                                        <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                                    </Pressable>
                                                </View>
                                            ) : null}
                                        </View>
                                        </View>
                                    ) : null}
                                {renderFavoriteBadge(colors.card, colors.secondaryText)}
                                <StickerPastePopover
                                    visible={pastePrompt.visible}
                                    anchor={{ x: pastePrompt.x, y: pastePrompt.y }}
                                    containerWidth={CARD_SIZE}
                                    containerHeight={CARD_SIZE}
                                    label={t('capture.pasteStickerAction', 'Paste sticker')}
                                    description={t('capture.clipboardStickerReadyHint', 'Copied image will be added as a sticker.')}
                                    backgroundColor="rgba(255, 255, 255, 0.96)"
                                    borderColor="rgba(255,255,255,0.24)"
                                    secondaryTextColor="rgba(28,28,30,0.6)"
                                    buttonBackgroundColor="#1C1C1E"
                                    buttonTextColor="#FFFFFF"
                                    onPress={handleConfirmPasteFromPrompt}
                                    onDismiss={dismissPastePrompt}
                                    popoverTestID="note-detail-card-paste-popover"
                                    actionTestID="note-detail-card-paste-action"
                                    dismissTestID="note-detail-card-paste-dismiss"
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
                                    <PremiumNoteFinishOverlay
                                        noteColor={isEditing ? editNoteColor : note.noteColor}
                                        animated
                                        interactive={!isEditing}
                                        previewMode={isEditing ? 'editor' : 'saved'}
                                        strength={isEditing ? 1 : 0.55}
                                    />
                                    {isEditing && ENABLE_PHOTO_STICKERS ? (
                                        <Pressable
                                            testID="note-detail-card-paste-surface"
                                            style={styles.cardPasteSurface}
                                            onLongPress={handleShowCardPastePrompt}
                                            delayLongPress={320}
                                        />
                                    ) : null}
                                    {displayedStickerPlacements.length > 0 || (isEditing && stickerModeEnabled) ? (
                                        <View
                                            pointerEvents={isEditing && stickerModeEnabled ? 'box-none' : 'none'}
                                            style={[
                                                styles.doodleOverlay,
                                                styles.textStickerOverlay,
                                                isEditing && stickerModeEnabled ? styles.textStickerOverlayActive : null,
                                                isEditing ? styles.doodleOverlayEditing : null,
                                                isEditing && stickerModeEnabled ? styles.doodleOverlayActive : null,
                                            ]}
                                        >
                                            {isEditing ? (
                                                <NoteStickerCanvas
                                                    placements={displayedStickerPlacements}
                                                    editable={stickerModeEnabled}
                                                    onChangePlacements={setEditStickerPlacements}
                                                    selectedPlacementId={selectedStickerId}
                                                    onChangeSelectedPlacementId={setSelectedStickerId}
                                                    onPressCanvas={handlePressStickerCanvas}
                                                />
                                            ) : (
                                                <DynamicStickerCanvas placements={displayedStickerPlacements} />
                                            )}
                                        </View>
                                    ) : null}
                                    {displayedDoodleStrokes.length > 0 || isEditing ? (
                                        <View
                                            pointerEvents={isEditing && doodleModeEnabled ? 'auto' : 'none'}
                                            style={[
                                                styles.doodleOverlay,
                                                isEditing ? styles.doodleOverlayEditing : null,
                                                isEditing && doodleModeEnabled ? styles.doodleOverlayActive : null,
                                            ]}
                                        >
                                            <NoteDoodleCanvas
                                                strokes={displayedDoodleStrokes}
                                                editable={isEditing && doodleModeEnabled}
                                                activeColor="#FFFFFF"
                                                onChangeStrokes={setEditDoodleStrokes}
                                            />
                                        </View>
                                    ) : null}
                                    {isEditing ? (
                                        <View style={styles.textEditHeader}>
                                            <Text style={styles.editFieldBadge}>
                                                {t('noteDetail.contentField', 'Note')}
                                            </Text>
                                            <View style={styles.textCardActionCluster}>
                                                <Pressable
                                                    testID="note-detail-doodle-toggle"
                                                    onPress={handleToggleDoodleMode}
                                                    style={[
                                                        styles.textCardActionButton,
                                                        doodleModeEnabled ? styles.textCardActionButtonActive : null,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={doodleModeEnabled ? 'create' : 'create-outline'}
                                                        size={16}
                                                        color="#FFFFFF"
                                                    />
                                                </Pressable>
                                                {ENABLE_PHOTO_STICKERS ? (
                                                    <Pressable
                                                        testID="note-detail-sticker-toggle"
                                                        onPress={handleToggleStickerMode}
                                                        style={[
                                                            styles.textCardActionButton,
                                                            stickerModeEnabled ? styles.textCardActionButtonActive : null,
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name={stickerModeEnabled ? 'images' : 'images-outline'}
                                                            size={16}
                                                            color="#FFFFFF"
                                                        />
                                                    </Pressable>
                                                ) : null}
                                                {doodleModeEnabled ? (
                                                    <View style={styles.textCardActionCluster}>
                                                        <Pressable
                                                            testID="note-detail-doodle-undo"
                                                            onPress={handleUndoDoodle}
                                                            disabled={editDoodleStrokes.length === 0}
                                                            style={[
                                                                styles.textCardActionPill,
                                                                editDoodleStrokes.length === 0
                                                                    ? styles.textCardActionDisabled
                                                                    : null,
                                                            ]}
                                                        >
                                                            <Ionicons name="arrow-undo-outline" size={14} color="#FFFFFF" />
                                                        </Pressable>
                                                        <Pressable
                                                            testID="note-detail-doodle-clear"
                                                            onPress={handleClearDoodle}
                                                            disabled={editDoodleStrokes.length === 0}
                                                            style={[
                                                                styles.textCardActionPill,
                                                                editDoodleStrokes.length === 0
                                                                    ? styles.textCardActionDisabled
                                                                    : null,
                                                            ]}
                                                        >
                                                            <Ionicons name="close-outline" size={14} color="#FFFFFF" />
                                                        </Pressable>
                                                    </View>
                                                ) : stickerModeEnabled ? (
                                                    <View style={styles.textCardActionCluster}>
                                                        <Pressable
                                                            testID="note-detail-sticker-import"
                                                            onPress={() => {
                                                                void handleShowStickerSourceOptions();
                                                            }}
                                                            disabled={importingSticker}
                                                            style={[
                                                                styles.textCardActionPill,
                                                                importingSticker ? styles.textCardActionDisabled : null,
                                                            ]}
                                                        >
                                                            <Ionicons name="add-outline" size={14} color="#FFFFFF" />
                                                        </Pressable>
                                                        <Pressable
                                                            testID="note-detail-sticker-outline-toggle"
                                                            accessibilityLabel={
                                                                selectedStickerOutlineEnabled
                                                                    ? t('capture.stickerOutlineDisable', 'Turn off outline')
                                                                    : t('capture.stickerOutlineEnable', 'Turn on outline')
                                                            }
                                                            onPress={() => handleStickerAction('outline-toggle')}
                                                            disabled={!selectedStickerId}
                                                            style={[
                                                                styles.textCardActionPill,
                                                                selectedStickerOutlineEnabled && selectedStickerId
                                                                    ? styles.textCardActionPillActive
                                                                    : null,
                                                                !selectedStickerId ? styles.textCardActionDisabled : null,
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name={selectedStickerOutlineEnabled ? 'ellipse' : 'ellipse-outline'}
                                                                size={14}
                                                                color="#FFFFFF"
                                                            />
                                                        </Pressable>
                                                        <Pressable
                                                            testID="note-detail-sticker-remove"
                                                            onPress={() => handleStickerAction('remove')}
                                                            disabled={!selectedStickerId}
                                                            style={[
                                                                styles.textCardActionPill,
                                                                !selectedStickerId ? styles.textCardActionDisabled : null,
                                                            ]}
                                                        >
                                                            <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                                        </Pressable>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    ) : (
                                        renderFavoriteBadge('#FFFFFF33', '#FFFFFFDD')
                                    )}
                                    <View
                                        pointerEvents={stickerModeEnabled ? 'none' : 'auto'}
                                        style={stickerModeEnabled ? styles.editTextInputWrapInactive : null}
                                    >
                                        <TextInput
                                            ref={contentInputRef}
                                            testID="note-detail-content-input"
                                            style={[
                                                styles.editTextInput, 
                                                isEditing ? styles.editTextInputActive : null,
                                                stickerModeEnabled ? styles.editTextInputInactive : null,
                                                editContent.length > 200 ? { fontSize: 16, lineHeight: 22 } :
                                                editContent.length > 100 ? { fontSize: 18, lineHeight: 26 } : null
                                            ]}
                                            value={isEditing ? editContent : formatNoteTextWithEmoji(note.content, note.moodEmoji)}
                                            onChangeText={isEditing ? setEditContent : undefined}
                                            editable={isEditing && !doodleModeEnabled && !stickerModeEnabled}
                                            multiline
                                            scrollEnabled={false}
                                            placeholder={isEditing ? t('noteDetail.editContent', 'Edit note content...') : undefined}
                                            placeholderTextColor="rgba(255,255,255,0.5)"
                                            maxLength={300}
                                            selectionColor="#FFFFFF"
                                        />
                                    </View>
                                    <StickerPastePopover
                                        visible={pastePrompt.visible}
                                        anchor={{ x: pastePrompt.x, y: pastePrompt.y }}
                                        containerWidth={CARD_SIZE}
                                        containerHeight={CARD_SIZE}
                                        label={t('capture.pasteStickerAction', 'Paste sticker')}
                                        description={t('capture.clipboardStickerReadyHint', 'Copied image will be added as a sticker.')}
                                        backgroundColor="rgba(255, 255, 255, 0.96)"
                                        borderColor="rgba(255,255,255,0.24)"
                                        secondaryTextColor="rgba(28,28,30,0.6)"
                                        buttonBackgroundColor="#1C1C1E"
                                        buttonTextColor="#FFFFFF"
                                        onPress={handleConfirmPasteFromPrompt}
                                        onDismiss={dismissPastePrompt}
                                        popoverTestID="note-detail-card-paste-popover"
                                        actionTestID="note-detail-card-paste-action"
                                        dismissTestID="note-detail-card-paste-dismiss"
                                    />
                                </LinearGradient>
                            </View>
                        )}
                    </Animated.View>

                    <Animated.View style={styles.actionRow}>
                        <AnimatedActionButton
                            onPress={isEditing ? handleSaveEdit : () => setIsEditing(true)}
                            testID="note-detail-edit"
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={100}
                            disabled={isDeleting}
                        >
                            <View style={styles.editIconStack}>
                                <Animated.View style={[styles.editIconLayer, editIconAnimatedStyle]}>
                                    <Ionicons
                                        name="create-outline"
                                        size={20}
                                        color={colors.secondaryText}
                                    />
                                </Animated.View>
                                <Animated.View style={[styles.editIconLayer, saveIconAnimatedStyle]}>
                                    <Ionicons
                                        name="checkmark"
                                        size={20}
                                        color={colors.success}
                                    />
                                </Animated.View>
                            </View>
                        </AnimatedActionButton>

                        <AnimatedActionButton
                            onPress={handleShare}
                            testID="note-detail-share"
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={140}
                            disabled={isDeleting}
                        >
                            <Ionicons name="share-outline" size={20} color={colors.secondaryText} />
                        </AnimatedActionButton>

                        <AnimatedActionButton
                            onPress={handleDelete}
                            testID="note-detail-delete"
                            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
                            delay={180}
                            disabled={isDeleting}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                        </AnimatedActionButton>
                    </Animated.View>

                    {isEditing ? (
                        <Animated.View style={editingHintAnimatedStyle}>
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
                                    {t('noteDetail.editingHint', 'Editing mode: update note, doodle, and place')}
                                </Text>
                            </View>
                        </Animated.View>
                    ) : null}

                    <Animated.View style={infoSectionAnimatedStyle}>
                        <View style={styles.infoSection}>
                            {isEditing && note.type === 'text' ? (
                                <>
                                    <NoteColorPicker
                                        label={t('noteDetail.colorField', 'Color')}
                                        selectedColor={editNoteColor}
                                        onSelectColor={setEditNoteColor}
                                        lockedColorIds={lockedPremiumNoteColorIds}
                                        previewOnlyColorIds={previewOnlyNoteColorIds}
                                        onLockedColorPress={showPremiumColorAlert}
                                        testIDPrefix="note-detail-color"
                                        compact
                                    />
                                </>
                            ) : null}
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
                                    testID="note-detail-location-input"
                                    style={[styles.editLocationInput, { color: colors.text }]}
                                    value={isEditing ? editLocation : (note.locationName || t('noteDetail.unknownLocation', 'Unknown Location'))}
                                    onChangeText={isEditing ? setEditLocation : undefined}
                                    editable={isEditing}
                                    placeholder={isEditing ? t('noteDetail.editLocation', 'Edit location name...') : undefined}
                                    placeholderTextColor={colors.secondaryText}
                                    maxLength={100}
                                    selectionColor={colors.primary}
                                />
                                {isEditing ? <Ionicons name="create-outline" size={16} color={colors.primary} /> : null}
                            </View>

                            <View style={styles.infoRowRadius}>
                                <Ionicons name="radio-outline" size={20} color={colors.secondaryText} />
                                {isEditing ? (
                                    <View style={styles.radiusChipsRow}>
                                        {NOTE_RADIUS_OPTIONS.map((option) => {
                                            const isSelected = editRadius === option;
                                            return (
                                                <Pressable
                                                    key={option}
                                                    testID={`note-detail-radius-${option}`}
                                                    style={[
                                                        styles.radiusChip,
                                                        {
                                                            backgroundColor: isSelected ? `${colors.primary}20` : 'transparent',
                                                            borderColor: isSelected ? colors.primary : colors.border,
                                                        },
                                                    ]}
                                                    onPress={() => setEditRadius(option)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.radiusChipText,
                                                            { color: isSelected ? colors.primary : colors.secondaryText },
                                                        ]}
                                                    >
                                                        {formatRadiusLabel(option)}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                                        {t('noteDetail.radiusValue', { value: formatRadiusLabel(note.radius) })}
                                    </Text>
                                )}
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

    if (Platform.OS === 'android') {
        return (
            <>
                <AppSheet visible={visible} onClose={handleSheetDismiss}>
                    {renderBody()}
                </AppSheet>
                <StickerSourceSheet
                    visible={showStickerSourceSheet}
                    canPasteFromClipboard={stickerSourceCanPasteFromClipboard}
                    title={t('capture.addStickerTitle', 'Add sticker')}
                    pasteLabel={t('capture.pasteStickerFromClipboard', 'Paste from Clipboard')}
                    photoLabel={t('capture.chooseStickerFromPhotos', 'Choose from Photos')}
                    cancelLabel={t('common.cancel', 'Cancel')}
                    onSelectClipboard={handleSelectStickerSourceClipboard}
                    onSelectPhotos={handleSelectStickerSourcePhotos}
                    onClose={handleCloseStickerSourceSheet}
                />
            </>
        );
    }

    return (
        <>
            <AppSheet visible={visible} onClose={handleSheetDismiss}>
                {renderBody()}
            </AppSheet>
            <StickerSourceSheet
                visible={showStickerSourceSheet}
                canPasteFromClipboard={stickerSourceCanPasteFromClipboard}
                title={t('capture.addStickerTitle', 'Add sticker')}
                pasteLabel={t('capture.pasteStickerFromClipboard', 'Paste from Clipboard')}
                photoLabel={t('capture.chooseStickerFromPhotos', 'Choose from Photos')}
                cancelLabel={t('common.cancel', 'Cancel')}
                onSelectClipboard={handleSelectStickerSourceClipboard}
                onSelectPhotos={handleSelectStickerSourcePhotos}
                onClose={handleCloseStickerSourceSheet}
            />
        </>
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
        top: CARD_FEEDBACK_TOP_OFFSET,
        left: CARD_FEEDBACK_SIDE_PADDING,
        right: CARD_FEEDBACK_SIDE_PADDING,
        alignItems: 'center',
        zIndex: 10,
    },
    feedbackChip: {
        width: '100%',
        maxWidth: CARD_SIZE,
        alignSelf: 'center',
    },
    photoContainer: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
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
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
        overflow: 'hidden',
        marginBottom: 16,
    },
    textGradient: {
        flex: 1,
        width: '100%',
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardPasteSurface: {
        ...StyleSheet.absoluteFill,
        zIndex: 0,
    },
    doodleOverlay: {
        position: 'absolute',
        ...STICKER_ARTBOARD_FRAME,
        opacity: 0.5,
    },
    textStickerOverlay: {
        ...STICKER_ARTBOARD_FRAME,
        zIndex: 0,
    },
    textStickerOverlayActive: {
        zIndex: 1,
    },
    doodleOverlayEditing: {
        opacity: 0.72,
    },
    photoDoodleOverlay: {
        opacity: 0.92,
    },
    doodleOverlayActive: {
        opacity: 1,
    },
    textEditHeader: {
        position: 'absolute',
        top: CARD_OVERLAY_TOP_INSET,
        left: CARD_OVERLAY_SIDE_INSET,
        right: CARD_OVERLAY_SIDE_INSET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 2,
    },
    editFieldBadge: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        color: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: '700',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        zIndex: 2,
        fontFamily: 'System',
    },
    textCardActionCluster: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    textCardActionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    textCardActionButtonActive: {
        backgroundColor: 'rgba(255,255,255,0.24)',
        borderColor: 'rgba(255,255,255,0.28)',
    },
    textCardActionPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    textCardActionPillActive: {
        backgroundColor: 'rgba(255,255,255,0.24)',
        borderColor: 'rgba(255,255,255,0.28)',
    },
    textCardActionDisabled: {
        opacity: 0.45,
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
        zIndex: 1,
    },
    editTextInputWrapInactive: {
        zIndex: 0,
    },
    editTextInputInactive: {
        zIndex: 0,
    },
    editTextInputActive: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.06)',
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
    cardFavBadge: {
        position: 'absolute',
        top: CARD_OVERLAY_TOP_INSET,
        right: CARD_OVERLAY_SIDE_INSET,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        zIndex: 10,
    },
    favoriteBadgeTint: {
        ...StyleSheet.absoluteFill,
        borderRadius: 18,
        backgroundColor: 'rgba(255,59,48,0.16)',
    },
    favoriteIconStack: {
        width: 20,
        height: 20,
    },
    favoriteIconLayer: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editIconStack: {
        width: 20,
        height: 20,
    },
    editIconLayer: {
        ...StyleSheet.absoluteFill,
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
    previewOnlyHint: {
        ...Typography.body,
        marginTop: -8,
        fontSize: 12,
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
    infoRowRadius: {
        flexDirection: 'row',
        alignItems: 'flex-start',
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
        paddingRight: 48,
    },
    radiusChipsRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    radiusChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    radiusChipText: {
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'System',
    },
    skeletonCard: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: Layout.cardRadius,
        marginBottom: 24,
    },
    skeletonLine: {
        height: 16,
        borderRadius: 8,
        marginBottom: 12,
    },
});
