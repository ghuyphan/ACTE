import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showAppAlert } from '../../utils/alert';
import {
    Dimensions,
    type GestureResponderEvent,
    Keyboard,
    Platform,
    Share,
} from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import {
    cancelAnimation,
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { ENABLE_PHOTO_STICKERS } from '../../constants/experiments';
import { Layout } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useActiveNote } from '../../hooks/state/useActiveNote';
import { useNotes } from '../../hooks/useNotes';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSubscription } from '../../hooks/useSubscription';
import { useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';
import {
    normalizeSavedTextNoteColor,
    PREMIUM_NOTE_COLOR_IDS,
} from '../../services/noteAppearance';
import { clearNoteDoodle, parseNoteDoodleStrokes, saveNoteDoodle } from '../../services/noteDoodles';
import {
    bringStickerPlacementToFront,
    createStickerPlacement,
    duplicateStickerPlacement,
    importStickerAsset,
    parseNoteStickerPlacements,
    saveNoteStickerPlacementsWithAssets,
    clearNoteStickers,
    setStickerPlacementMotionLocked,
    StickerImportError,
    setStickerPlacementOutlineEnabled,
    type NoteStickerPlacement,
    updateStickerPlacementTransform,
} from '../../services/noteStickers';
import { getNotePhotoUri } from '../../services/photoStorage';
import {
    getFallbackFreeNoteColor,
    getPremiumNoteSaveDecision,
    isHologramNoteColor,
    isPreviewablePremiumNoteColor,
    PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS,
} from '../../services/premiumNoteFinish';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import { emitInteractionFeedback, InteractionFeedbackType } from '../../utils/interactionFeedback';
import {
    ClipboardStickerError,
    hasClipboardStickerImage,
    importStickerAssetFromClipboard,
} from '../../utils/stickerClipboard';
import AppSheet from '../sheets/AppSheet';
import { type DoodleStroke } from './NoteDoodleCanvas';
import StickerSourceSheet from '../sheets/StickerSourceSheet';
import NoteDetailSheetContent from './detail/NoteDetailSheetContent';

const { width } = Dimensions.get('window');
const CARD_SIZE = width - Layout.screenPadding * 2;
const STICKER_SOURCE_SHEET_DISMISS_DELAY_MS = 250;

type StickerPastePromptState = {
    visible: boolean;
    x: number;
    y: number;
};

type StickerImportIntent = 'sticker' | 'stamp';

function getStickerImportErrorMessage(
    t: ReturnType<typeof useTranslation>['t'],
    error: unknown
) {
    if (error instanceof StickerImportError) {
        if (error.code === 'unsupported-format') {
            return t(
                'capture.stickerUnsupportedFormat',
                'Please import a PNG, WebP, JPEG, or HEIC image.'
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
                'If you want a floating sticker, use a transparent PNG or WebP. Regular photos will import as stamps.'
            );
        }
    }

    return error instanceof Error
        ? error.message
        : t('capture.photoImportFailed', 'We could not import that photo right now.');
}

interface FeedbackState {
    type: InteractionFeedbackType;
    token: number;
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
    const [pendingStickerSourceAction, setPendingStickerSourceAction] = useState<StickerImportIntent | null>(null);
    const [stickerSourceCanPasteFromClipboard, setStickerSourceCanPasteFromClipboard] = useState(false);
    const [pastePrompt, setPastePrompt] = useState<StickerPastePromptState>({ visible: false, x: CARD_SIZE / 2, y: CARD_SIZE / 2 });
    const [interactionFeedback, setInteractionFeedback] = useState<FeedbackState | null>(null);
    const [locationSelection, setLocationSelection] = useState<{ start: number; end: number } | undefined>(undefined);

    const cardScaleValue = useSharedValue(0.92);
    const cardOpacityValue = useSharedValue(0);
    const infoTranslateYValue = useSharedValue(20);
    const favoriteFillProgressValue = useSharedValue(0);
    const editModeAnimValue = useSharedValue(0);
    const cardScale = useRef(cardScaleValue).current;
    const cardOpacity = useRef(cardOpacityValue).current;
    const infoTranslateY = useRef(infoTranslateYValue).current;
    const favoriteFillProgress = useRef(favoriteFillProgressValue).current;
    const editModeAnim = useRef(editModeAnimValue).current;
    const contentInputRef = useRef<any>(null);
    const locationInputRef = useRef<any>(null);
    const scrollContainerRef = useRef<any>(null);
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
        const activeNoteKey = activeNoteKeyRef.current;
        if (visible && noteId) {
            setActiveNote(activeNoteKey, noteId);

            return () => {
                clearActiveNote(activeNoteKey);
            };
        }

        clearActiveNote(activeNoteKey);
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
        setLocationSelection(undefined);
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
    }, [
        cardOpacity,
        cardScale,
        editModeAnim,
        favoriteFillProgress,
        getNoteById,
        infoTranslateY,
        noteId,
        reduceMotionEnabled,
        visible,
    ]);

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
            setLocationSelection(undefined);
            return;
        }

        const focusTimer = setTimeout(() => {
            if (note?.type === 'text') {
                contentInputRef.current?.focus();
                return;
            }
            setLocationSelection({ start: 0, end: 0 });
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

    const handleToggleDoodleMode = useCallback(() => {
        if (!isEditing || !note) {
            return;
        }

        dismissPastePrompt();
        Keyboard.dismiss();
        setStickerModeEnabled(false);
        setSelectedStickerId(null);
        setDoodleModeEnabled((current) => !current);
    }, [dismissPastePrompt, isEditing, note]);

    const handleUndoDoodle = useCallback(() => {
        setEditDoodleStrokes((current) => current.slice(0, -1));
    }, []);

    const handleClearDoodle = useCallback(() => {
        setEditDoodleStrokes([]);
    }, []);

    const handleLocationChangeText = useCallback((value: string) => {
        if (locationSelection) {
            setLocationSelection(undefined);
        }
        setEditLocation(value);
    }, [locationSelection]);

    const handleLocationSelectionChange = useCallback((event: any) => {
        if (!locationSelection) {
            return;
        }

        const { start, end } = event.nativeEvent.selection;
        if (start !== locationSelection.start || end !== locationSelection.end) {
            setLocationSelection(undefined);
        }
    }, [locationSelection]);

    const handleLocationFocus = useCallback(() => {
        if (!isEditing || Platform.OS !== 'ios') {
            return;
        }

        setTimeout(() => {
            scrollContainerRef.current?.scrollToEnd?.({ animated: true });
        }, 120);
    }, [isEditing]);

    const handleImportSticker = useCallback(async (intent: StickerImportIntent = 'sticker') => {
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
            }, intent === 'sticker' ? { requiresTransparency: true } : undefined);

            const nextPlacement = createStickerPlacement(
                importedAsset,
                editStickerPlacements,
                intent === 'stamp' ? { renderMode: 'stamp' } : undefined
            );
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
        if (showStickerSourceSheet || !pendingStickerSourceAction) {
            return;
        }

        const timer = setTimeout(() => {
            const nextAction = pendingStickerSourceAction;
            setPendingStickerSourceAction(null);
            void handleImportSticker(nextAction);
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
                    'Copy an image first, then long press again to paste it.'
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
    const handleSelectStickerSourceSticker = useCallback(() => {
        setPendingStickerSourceAction('sticker');
        setShowStickerSourceSheet(false);
    }, []);
    const handleSelectStickerSourceStamp = useCallback(() => {
        setPendingStickerSourceAction('stamp');
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
    const stickerSourceActions = useMemo(() => {
        const actions: {
            key: string;
            iconName: 'images-outline' | 'pricetag-outline' | 'clipboard-outline';
            label: string;
            description: string;
            onPress: () => void;
            testID: string;
        }[] = [
            {
                key: 'create-sticker',
                iconName: 'images-outline',
                label: t('capture.createStickerLabel', 'Create sticker'),
                description: t('capture.createStickerDescription', 'Transparent PNG or WebP'),
                onPress: handleSelectStickerSourceSticker,
                testID: 'sticker-source-option-create-sticker',
            },
            {
                key: 'create-stamp',
                iconName: 'pricetag-outline',
                label: t('capture.createStampLabel', 'Create stamp'),
                description: t('capture.createStampDescription', 'Turn any photo into a perforated stamp'),
                onPress: handleSelectStickerSourceStamp,
                testID: 'sticker-source-option-create-stamp',
            },
        ];

        if (stickerSourceCanPasteFromClipboard) {
            actions.push({
                key: 'paste-sticker',
                iconName: 'clipboard-outline',
                label: t('capture.pasteStickerFromClipboard', 'Paste from Clipboard'),
                description: t('capture.clipboardStickerReadyHint', 'Copied image will be added as a sticker.'),
                onPress: handleSelectStickerSourceClipboard,
                testID: 'sticker-source-option-clipboard',
            });
        }

        return actions;
    }, [
        handleSelectStickerSourceClipboard,
        handleSelectStickerSourceStamp,
        handleSelectStickerSourceSticker,
        stickerSourceCanPasteFromClipboard,
        t,
    ]);
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
    const handleToggleStickerMotionLock = useCallback(() => {
        if (!selectedStickerId) {
            return;
        }

        const selectedPlacement = editStickerPlacements.find((placement) => placement.id === selectedStickerId);
        if (!selectedPlacement) {
            return;
        }

        setEditStickerPlacements((current) =>
            setStickerPlacementMotionLocked(current, selectedStickerId, selectedPlacement.motionLocked !== true)
        );
    }, [editStickerPlacements, selectedStickerId]);
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
                    && selectedPlacement.renderMode !== 'stamp'
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

    const renderBody = () => (
        <NoteDetailSheetContent
            note={note}
            loading={loading}
            isEditing={isEditing}
            isDeleting={isDeleting}
            editContent={editContent}
            setEditContent={setEditContent}
            editLocation={editLocation}
            editRadius={editRadius}
            setEditRadius={setEditRadius}
            editNoteColor={editNoteColor}
            setEditNoteColor={setEditNoteColor}
            editDoodleStrokes={editDoodleStrokes}
            setEditDoodleStrokes={setEditDoodleStrokes}
            editStickerPlacements={editStickerPlacements}
            setEditStickerPlacements={setEditStickerPlacements}
            doodleModeEnabled={doodleModeEnabled}
            setDoodleModeEnabled={setDoodleModeEnabled}
            stickerModeEnabled={stickerModeEnabled}
            setStickerModeEnabled={setStickerModeEnabled}
            selectedStickerId={selectedStickerId}
            setSelectedStickerId={setSelectedStickerId}
            importingSticker={importingSticker}
            pastePrompt={pastePrompt}
            interactionFeedback={interactionFeedback}
            locationSelection={locationSelection}
            cardAnimatedStyle={cardAnimatedStyle}
            editIconAnimatedStyle={editIconAnimatedStyle}
            saveIconAnimatedStyle={saveIconAnimatedStyle}
            editingHintAnimatedStyle={editingHintAnimatedStyle}
            infoSectionAnimatedStyle={infoSectionAnimatedStyle}
            favoriteFilledTintStyle={favoriteFilledTintStyle}
            favoriteOutlineIconStyle={favoriteOutlineIconStyle}
            favoriteFilledIconStyle={favoriteFilledIconStyle}
            contentInputRef={contentInputRef}
            colors={colors}
            isDark={isDark}
            t={t}
            lockedPremiumNoteColorIds={lockedPremiumNoteColorIds}
            locationInputRef={locationInputRef}
            previewOnlyNoteColorIds={previewOnlyNoteColorIds}
            onClose={onClose}
            onStartEditing={() => setIsEditing(true)}
            onToggleDoodleMode={handleToggleDoodleMode}
            onUndoDoodle={handleUndoDoodle}
            onClearDoodle={handleClearDoodle}
            onLocationChangeText={handleLocationChangeText}
            onLocationFocus={handleLocationFocus}
            onLocationSelectionChange={handleLocationSelectionChange}
            onShowCardPastePrompt={handleShowCardPastePrompt}
            onConfirmPasteFromPrompt={handleConfirmPasteFromPrompt}
            dismissPastePrompt={dismissPastePrompt}
            onPressStickerCanvas={handlePressStickerCanvas}
            onShowStickerSourceOptions={handleShowStickerSourceOptions}
            onToggleStickerMode={handleToggleStickerMode}
            onToggleStickerMotionLock={handleToggleStickerMotionLock}
            onStickerAction={handleStickerAction}
            onToggleFavorite={handleToggleFavorite}
            onSaveEdit={handleSaveEdit}
            onShare={handleShare}
            onDelete={handleDelete}
            scrollContainerRef={scrollContainerRef}
            showPremiumColorAlert={showPremiumColorAlert}
        />
    );

    if (Platform.OS === 'android') {
        return (
            <>
                <AppSheet visible={visible} onClose={handleSheetDismiss} androidScrollable>
                    {renderBody()}
                </AppSheet>
                <StickerSourceSheet
                    visible={showStickerSourceSheet}
                    title={t('capture.addStickerTitle', 'Add sticker')}
                    subtitle={t('capture.addStickerHint', 'Choose a floating sticker or a photo stamp.')}
                    cancelLabel={t('common.cancel', 'Cancel')}
                    actions={stickerSourceActions}
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
                title={t('capture.addStickerTitle', 'Add sticker')}
                subtitle={t('capture.addStickerHint', 'Choose a floating sticker or a photo stamp.')}
                cancelLabel={t('common.cancel', 'Cancel')}
                actions={stickerSourceActions}
                onClose={handleCloseStickerSourceSheet}
            />
        </>
    );
}
