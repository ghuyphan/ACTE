import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type TFunction } from 'i18next';
import React, { useMemo } from 'react';
import {
    Dimensions,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    type GestureResponderEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { STICKER_ARTBOARD_FRAME } from '../../../constants/doodleLayout';
import { ENABLE_PHOTO_STICKERS } from '../../../constants/experiments';
import { Layout, Typography } from '../../../constants/theme';
import type { DoodleStroke } from '../NoteDoodleCanvas';
import type { Note } from '../../../services/database';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import {
    getGradientStickerMotionVariant,
    getNoteColorStickerMotion,
    getTextNoteCardGradient,
} from '../../../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../../../services/noteDoodles';
import { getNotePairedVideoUri } from '../../../services/livePhotoStorage';
import { getNotePhotoUri } from '../../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../../services/noteTextPresentation';
import { formatDate } from '../../../utils/dateUtils';
import { parseNoteStickerPlacements } from '../../../services/noteStickers';
import { POLAROID_EXPORT_HEIGHT, POLAROID_EXPORT_WIDTH } from '../../../services/polaroidExport';
import DynamicStickerCanvas from '../DynamicStickerCanvas';
import NoteDoodleCanvas from '../NoteDoodleCanvas';
import NoteStickerCanvas from '../NoteStickerCanvas';
import PhotoCaptionChip from '../PhotoCaptionChip';
import PhotoMediaView from '../PhotoMediaView';
import PremiumNoteFinishOverlay from '../../ui/PremiumNoteFinishOverlay';
import StickerPastePopover from '../../ui/StickerPastePopover';
import TransientStatusChip from '../../ui/TransientStatusChip';
import { getNoteCardTextSizeStyle, noteCardTextStyles } from '../noteCardTextStyles';
import NoteDetailActionSection from './NoteDetailActionSection';
import NoteDetailEditToolbar from './NoteDetailEditToolbar';
import NoteDetailInfoSection from './NoteDetailInfoSection';
import PolaroidExportAnimation from './PolaroidExportAnimation';
import PolaroidExportView from './PolaroidExportView';
import { SkeletonCard } from './NoteDetailPrimitives';
import NoteDetailStatusBadges from './NoteDetailStatusBadges';

const CARD_FEEDBACK_TOP_OFFSET = 34;
const CARD_FEEDBACK_SIDE_PADDING = 34;
const { width } = Dimensions.get('window');
const CARD_SIZE = width - Layout.screenPadding * 2;
const SheetTextInput = Platform.OS === 'android' ? BottomSheetTextInput : TextInput;
const FALLBACK_TEXT_GRADIENT = ['#6E5960', '#8E767E'] as const;

type InteractionFeedbackType = 'favorited' | 'unfavorited' | 'deleted';

type NoteDetailSheetContentProps = {
    cardAnimatedStyle: any;
    colors: any;
    contentInputRef: any;
    dismissPastePrompt: () => void;
    doodleModeEnabled: boolean;
    editContent: string;
    editDoodleStrokes: DoodleStroke[];
    editIconAnimatedStyle: any;
    editLocation: string;
    editNoteColor: string | null;
    editRadius: number;
    editStickerPlacements: NoteStickerPlacement[];
    favoriteFilledIconStyle: any;
    favoriteFilledTintStyle: any;
    favoriteOutlineIconStyle: any;
    infoSectionAnimatedStyle: any;
    importingSticker: boolean;
    interactionFeedback: { type: InteractionFeedbackType; token: number } | null;
    isDark: boolean;
    isDeleting: boolean;
    isEditing: boolean;
    isSharedByMe: boolean;
    loading: boolean;
    locationInputRef: any;
    locationSelection?: { start: number; end: number };
    lockedPremiumNoteColorIds: string[];
    note: Note | null;
    onClearDoodle: () => void;
    onClose: () => void;
    onConfirmPasteFromPrompt: () => void;
    onDelete: () => void;
    onDownloadPolaroid: () => void;
    onLocationChangeText: (value: string) => void;
    onLocationSelectionChange: (event: any) => void;
    onPolaroidCaptureReady: () => void;
    onPressStickerCanvas: () => void;
    onSaveEdit: () => void;
    onShowCardPastePrompt: (event: GestureResponderEvent) => void;
    onShowStickerSourceOptions: () => void;
    onStartEditing: () => void;
    onStickerAction: (action: 'rotate-left' | 'rotate-right' | 'smaller' | 'larger' | 'duplicate' | 'front' | 'remove' | 'outline-toggle') => void;
    onToggleDoodleMode: () => void;
    onToggleFavorite: () => void;
    onToggleStickerMode: () => void;
    onToggleStickerMotionLock: () => void;
    onUndoDoodle: () => void;
    pastePrompt: { visible: boolean; x: number; y: number };
    onPolaroidAnimationFinished: () => void;
    polaroidAnimationSuccess: boolean;
    polaroidAnimationUri: string | null;
    polaroidCaptureRef: any;
    polaroidExporting: boolean;
    polaroidFallbackLocationLabel: string;
    showPolaroidCapture: boolean;
    previewOnlyNoteColorIds: string[];
    richDecorationsReady: boolean;
    saveIconAnimatedStyle: any;
    scrollContainerRef: any;
    selectedStickerId: string | null;
    setEditContent: (value: string) => void;
    setEditDoodleStrokes: (value: DoodleStroke[] | ((current: DoodleStroke[]) => DoodleStroke[])) => void;
    setEditNoteColor: (value: string | null) => void;
    setEditRadius: (value: number) => void;
    setEditStickerPlacements: (value: NoteStickerPlacement[] | ((current: NoteStickerPlacement[]) => NoteStickerPlacement[])) => void;
    setSelectedStickerId: (value: string | null) => void;
    showPremiumColorAlert: () => void;
    stickerModeEnabled: boolean;
    t: TFunction;
};

function getFeedbackPresentation(t: TFunction, type: InteractionFeedbackType) {
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

export default function NoteDetailSheetContent({
    cardAnimatedStyle,
    colors,
    contentInputRef,
    dismissPastePrompt,
    doodleModeEnabled,
    editContent,
    editDoodleStrokes,
    editIconAnimatedStyle,
    editLocation,
    editNoteColor,
    editRadius,
    editStickerPlacements,
    favoriteFilledIconStyle,
    favoriteFilledTintStyle,
    favoriteOutlineIconStyle,
    infoSectionAnimatedStyle,
    importingSticker,
    interactionFeedback,
    isDark,
    isDeleting,
    isEditing,
    isSharedByMe,
    loading,
    locationInputRef,
    locationSelection,
    lockedPremiumNoteColorIds,
    note,
    onClearDoodle,
    onClose,
    onConfirmPasteFromPrompt,
    onDelete,
    onLocationChangeText,
    onLocationSelectionChange,
    onPressStickerCanvas,
    onSaveEdit,
    onShowCardPastePrompt,
    onShowStickerSourceOptions,
    onStartEditing,
    onStickerAction,
    onToggleDoodleMode,
    onToggleFavorite,
    onToggleStickerMode,
    onToggleStickerMotionLock,
    onUndoDoodle,
    pastePrompt,
    previewOnlyNoteColorIds,
    saveIconAnimatedStyle,
    scrollContainerRef,
    selectedStickerId,
    setEditContent,
    setEditDoodleStrokes,
    setEditNoteColor,
    setEditRadius,
    setEditStickerPlacements,
    setSelectedStickerId,
    showPremiumColorAlert,
    stickerModeEnabled,
    t,
    onDownloadPolaroid,
    polaroidAnimationSuccess,
    polaroidAnimationUri,
    polaroidCaptureRef,
    polaroidExporting,
    polaroidFallbackLocationLabel,
    richDecorationsReady,
    onPolaroidAnimationFinished,
    onPolaroidCaptureReady,
    showPolaroidCapture,
}: NoteDetailSheetContentProps) {
    const showRichDecorations = Boolean(note) && (richDecorationsReady || isEditing);
    const displayedCardText = note ? (isEditing ? editContent : note.content) : '';
    const displayedNoteColor = note ? (isEditing ? editNoteColor : note.noteColor) : null;
    const dateStr = useMemo(
        () => (note ? formatDate(note.createdAt, 'long') : ''),
        [note]
    );
    const gradient = useMemo<readonly [string, string]>(
        () => (
            note
                ? getTextNoteCardGradient({
                    text: displayedCardText,
                    noteId: note.id,
                    emoji: note.moodEmoji,
                    noteColor: displayedNoteColor,
                })
                : FALLBACK_TEXT_GRADIENT
        ),
        [displayedCardText, displayedNoteColor, note]
    );
    const textStickerMotionVariant = useMemo(
        () => getNoteColorStickerMotion(displayedNoteColor) ?? getGradientStickerMotionVariant(gradient),
        [displayedNoteColor, gradient]
    );
    const displayedDoodleStrokes = useMemo(
        () => (
            note
                ? (
                    isEditing
                        ? editDoodleStrokes
                        : showRichDecorations
                            ? parseNoteDoodleStrokes(note.doodleStrokesJson)
                            : []
                )
                : []
        ),
        [editDoodleStrokes, isEditing, note, showRichDecorations]
    );
    const displayedStickerPlacements = useMemo(
        () => (
            note
                ? (
                    isEditing
                        ? editStickerPlacements
                        : showRichDecorations
                            ? parseNoteStickerPlacements(note.stickerPlacementsJson)
                            : []
                )
                : []
        ),
        [editStickerPlacements, isEditing, note, showRichDecorations]
    );
    const displayedPhotoCaption = useMemo(
        () => (
            note?.type === 'photo'
                ? (isEditing ? editContent : note.caption ?? '')
                : ''
        ),
        [editContent, isEditing, note]
    );
    const displayedText = useMemo(
        () => (
            note?.type === 'text'
                ? formatNoteTextWithEmoji(displayedCardText, note.moodEmoji)
                : ''
        ),
        [displayedCardText, note]
    );
    const notePhotoUri = useMemo(() => (note ? getNotePhotoUri(note) : ''), [note]);
    const notePairedVideoUri = useMemo(() => (note ? getNotePairedVideoUri(note) : null), [note]);

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

    const cardContent = note.type === 'photo' ? (
        <View style={styles.photoContainer}>
            <View style={styles.photoCard}>
                <View style={styles.photo}>
                    <PhotoMediaView
                        imageUrl={notePhotoUri}
                        isLivePhoto={note.isLivePhoto}
                        pairedVideoUri={notePairedVideoUri}
                        showLiveBadge={false}
                        style={styles.photo}
                        imageStyle={styles.photo}
                        enablePlayback={!isEditing}
                    />
                </View>
                {isEditing && ENABLE_PHOTO_STICKERS ? (
                    <Pressable
                        testID="note-detail-card-paste-surface"
                        style={styles.cardPasteSurface}
                        onLongPress={onShowCardPastePrompt}
                        delayLongPress={320}
                    />
                ) : null}
                {showRichDecorations && (displayedStickerPlacements.length > 0 || (isEditing && stickerModeEnabled)) ? (
                    <View
                        pointerEvents={isEditing && stickerModeEnabled ? 'box-none' : 'none'}
                        style={styles.stickerOverlay}
                    >
                        {isEditing ? (
                            <NoteStickerCanvas
                                placements={displayedStickerPlacements}
                                editable={stickerModeEnabled}
                                onChangePlacements={setEditStickerPlacements}
                                selectedPlacementId={selectedStickerId}
                                onChangeSelectedPlacementId={setSelectedStickerId}
                                onPressCanvas={onPressStickerCanvas}
                                onToggleSelectedPlacementMotionLock={(placementId) => {
                                    if (placementId === selectedStickerId) {
                                        onToggleStickerMotionLock();
                                    }
                                }}
                                onToggleSelectedPlacementOutline={(placementId) => {
                                    if (placementId === selectedStickerId) {
                                        onStickerAction('outline-toggle');
                                    }
                                }}
                                onRemoveSelectedPlacement={(placementId) => {
                                    if (placementId === selectedStickerId) {
                                        onStickerAction('remove');
                                    }
                                }}
                            />
                        ) : (
                            <DynamicStickerCanvas
                                placements={displayedStickerPlacements}
                                motionVariant={textStickerMotionVariant}
                            />
                        )}
                    </View>
                ) : null}
                {showRichDecorations && (displayedDoodleStrokes.length > 0 || isEditing) ? (
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
                <NoteDetailEditToolbar
                    colors={colors}
                    doodleModeEnabled={doodleModeEnabled}
                    editDoodleStrokesCount={editDoodleStrokes.length}
                    importingSticker={importingSticker}
                    isEditing={isEditing}
                    onClearDoodle={onClearDoodle}
                    onShowStickerSourceOptions={onShowStickerSourceOptions}
                    onToggleDoodleMode={onToggleDoodleMode}
                    onToggleStickerMode={onToggleStickerMode}
                    onUndoDoodle={onUndoDoodle}
                    stickerModeEnabled={stickerModeEnabled}
                    stickersEnabled={ENABLE_PHOTO_STICKERS}
                />
                {!isEditing ? (
                    <NoteDetailStatusBadges
                        captureGlassColorScheme={colors.captureGlassColorScheme}
                        colors={colors}
                        favoriteFilledIconStyle={favoriteFilledIconStyle}
                        favoriteFilledTintStyle={favoriteFilledTintStyle}
                        favoriteOutlineIconStyle={favoriteOutlineIconStyle}
                        inactiveColor={colors.secondaryText}
                        isLivePhoto={Boolean(note.isLivePhoto)}
                        isSharedByMe={isSharedByMe}
                        onToggleFavorite={onToggleFavorite}
                    />
                ) : null}
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
                    onPress={onConfirmPasteFromPrompt}
                    onDismiss={dismissPastePrompt}
                    popoverTestID="note-detail-card-paste-popover"
                    actionTestID="note-detail-card-paste-action"
                    dismissTestID="note-detail-card-paste-dismiss"
                />
                {isEditing || displayedPhotoCaption.trim().length > 0 ? (
                    <View style={styles.photoCaptionOverlay}>
                        {isEditing ? (
                            <View
                                style={[
                                    styles.photoCaptionOverlayField,
                                    styles.photoCaptionOverlayFieldEditing,
                                    {
                                        backgroundColor: isDark ? 'rgba(20,20,20,0.5)' : 'rgba(255,255,255,0.72)',
                                        borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.42)',
                                    },
                                ]}
                            >
                                <Ionicons name="create-outline" size={16} color={colors.secondaryText} />
                                <SheetTextInput
                                    ref={contentInputRef}
                                    testID="note-detail-photo-caption-input"
                                    style={[styles.photoCaptionOverlayInput, { color: colors.text }]}
                                    value={editContent}
                                    onChangeText={setEditContent}
                                    editable={!doodleModeEnabled && !stickerModeEnabled}
                                    placeholder={t('noteDetail.editPhotoCaption', 'Add a short note...')}
                                    placeholderTextColor={colors.secondaryText}
                                    maxLength={60}
                                    selectionColor={colors.primary}
                                />
                                {editContent.trim().length > 0 ? (
                                    <Pressable
                                        testID="note-detail-photo-caption-clear"
                                        accessibilityRole="button"
                                        accessibilityLabel={t('capture.clearPhotoCaption', 'Clear caption')}
                                        hitSlop={8}
                                        onPress={() => {
                                            setEditContent('');
                                            contentInputRef?.current?.focus?.();
                                        }}
                                        style={styles.photoCaptionClearButton}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.secondaryText} />
                                    </Pressable>
                                ) : null}
                            </View>
                        ) : (
                            <PhotoCaptionChip
                                caption={displayedPhotoCaption}
                                color={colors.text}
                                isDark={isDark}
                                numberOfLines={2}
                                overlayStyle={styles.photoCaptionChipOverlay}
                            />
                        )}
                    </View>
                ) : null}
            </View>
        </View>
    ) : (
        <View style={styles.textContainer}>
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.textGradient}
            >
                {showRichDecorations ? (
                    <PremiumNoteFinishOverlay
                        noteColor={isEditing ? editNoteColor : note.noteColor}
                        animated
                        interactive={!isEditing}
                        previewMode={isEditing ? 'editor' : 'saved'}
                        strength={isEditing ? 1 : 0.55}
                    />
                ) : null}
                {isEditing && ENABLE_PHOTO_STICKERS ? (
                    <Pressable
                        testID="note-detail-card-paste-surface"
                        style={styles.cardPasteSurface}
                        onLongPress={onShowCardPastePrompt}
                        delayLongPress={320}
                    />
                ) : null}
                {showRichDecorations && (displayedStickerPlacements.length > 0 || (isEditing && stickerModeEnabled)) ? (
                    <View
                        pointerEvents={isEditing && stickerModeEnabled ? 'box-none' : 'none'}
                        style={[
                            styles.stickerOverlay,
                            styles.textStickerOverlay,
                        ]}
                    >
                        {isEditing ? (
                            <NoteStickerCanvas
                                placements={displayedStickerPlacements}
                                editable={stickerModeEnabled}
                                stampShadowEnabled={false}
                                onChangePlacements={setEditStickerPlacements}
                                selectedPlacementId={selectedStickerId}
                                onChangeSelectedPlacementId={setSelectedStickerId}
                                onPressCanvas={onPressStickerCanvas}
                                onToggleSelectedPlacementMotionLock={(placementId) => {
                                    if (placementId === selectedStickerId) {
                                        onToggleStickerMotionLock();
                                    }
                                }}
                                onToggleSelectedPlacementOutline={(placementId) => {
                                    if (placementId === selectedStickerId) {
                                        onStickerAction('outline-toggle');
                                    }
                                }}
                                onRemoveSelectedPlacement={(placementId) => {
                                    if (placementId === selectedStickerId) {
                                        onStickerAction('remove');
                                    }
                                }}
                            />
                        ) : (
                            <DynamicStickerCanvas placements={displayedStickerPlacements} />
                        )}
                    </View>
                ) : null}
                {showRichDecorations && (displayedDoodleStrokes.length > 0 || isEditing) ? (
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
                <NoteDetailEditToolbar
                    colors={colors}
                    doodleModeEnabled={doodleModeEnabled}
                    editDoodleStrokesCount={editDoodleStrokes.length}
                    importingSticker={importingSticker}
                    isEditing={isEditing}
                    onClearDoodle={onClearDoodle}
                    onShowStickerSourceOptions={onShowStickerSourceOptions}
                    onToggleDoodleMode={onToggleDoodleMode}
                    onToggleStickerMode={onToggleStickerMode}
                    onUndoDoodle={onUndoDoodle}
                    stickerModeEnabled={stickerModeEnabled}
                    stickersEnabled={ENABLE_PHOTO_STICKERS}
                />
                {!isEditing ? (
                    <NoteDetailStatusBadges
                        captureGlassColorScheme={colors.captureGlassColorScheme}
                        colors={colors}
                        favoriteFilledIconStyle={favoriteFilledIconStyle}
                        favoriteFilledTintStyle={favoriteFilledTintStyle}
                        favoriteOutlineIconStyle={favoriteOutlineIconStyle}
                        inactiveColor={colors.secondaryText}
                        isLivePhoto={false}
                        isSharedByMe={isSharedByMe}
                        onToggleFavorite={onToggleFavorite}
                    />
                ) : null}
                <View
                    pointerEvents={stickerModeEnabled ? 'none' : 'auto'}
                    style={[
                        styles.editTextInputWrap,
                        stickerModeEnabled ? styles.editTextInputWrapInactive : null,
                    ]}
                >
                    {isEditing ? (
                        <SheetTextInput
                            ref={contentInputRef}
                            testID="note-detail-content-input"
                            style={[
                                styles.editTextInput,
                                noteCardTextStyles.memoryText,
                                getNoteCardTextSizeStyle(displayedText),
                                styles.editTextInputActive,
                                stickerModeEnabled ? styles.editTextInputInactive : null,
                            ]}
                            value={editContent}
                            onChangeText={setEditContent}
                            editable={!doodleModeEnabled && !stickerModeEnabled}
                            multiline
                            scrollEnabled={false}
                            autoCorrect={false}
                            spellCheck={false}
                            placeholder={t('noteDetail.editContent', 'Edit note content...')}
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            maxLength={300}
                            selectionColor="#FFFFFF"
                        />
                    ) : (
                        <Text
                            testID="note-detail-content-input"
                            numberOfLines={8}
                            style={[
                                noteCardTextStyles.memoryText,
                                getNoteCardTextSizeStyle(displayedText),
                            ]}
                        >
                            {displayedText}
                        </Text>
                    )}
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
                    onPress={onConfirmPasteFromPrompt}
                    onDismiss={dismissPastePrompt}
                    popoverTestID="note-detail-card-paste-popover"
                    actionTestID="note-detail-card-paste-action"
                    dismissTestID="note-detail-card-paste-dismiss"
                />
            </LinearGradient>
        </View>
    );

    const scrollContent = (
        <>
            <Animated.View style={cardAnimatedStyle}>
                {cardContent}
            </Animated.View>

            <NoteDetailActionSection
                colors={colors}
                editIconAnimatedStyle={editIconAnimatedStyle}
                isDark={isDark}
                isDeleting={isDeleting}
                isDownloadingPolaroid={polaroidExporting}
                isEditing={isEditing}
                onDownloadPolaroid={onDownloadPolaroid}
                onPrimaryPress={isEditing ? onSaveEdit : onStartEditing}
                saveIconAnimatedStyle={saveIconAnimatedStyle}
            />

            <Animated.View style={infoSectionAnimatedStyle}>
                <NoteDetailInfoSection
                    colors={colors}
                    dateStr={dateStr}
                    editLocation={editLocation}
                    editNoteColor={editNoteColor}
                    editRadius={editRadius}
                    inputComponent={SheetTextInput}
                    isDark={isDark}
                    isEditing={isEditing}
                    locationInputRef={locationInputRef}
                    locationSelection={locationSelection}
                    lockedPremiumNoteColorIds={lockedPremiumNoteColorIds}
                    note={note}
                    onChangeLocationText={onLocationChangeText}
                    onLockedColorPress={showPremiumColorAlert}
                    onLocationSelectionChange={onLocationSelectionChange}
                    onSelectColor={setEditNoteColor}
                    onSelectRadius={setEditRadius}
                    previewOnlyNoteColorIds={previewOnlyNoteColorIds}
                    t={t}
                />
            </Animated.View>

            {!isEditing ? (
                <Pressable
                    testID="note-detail-delete"
                    accessibilityRole="button"
                    accessibilityLabel={t('noteDetail.deleteTitle', 'Delete Note')}
                    onPress={onDelete}
                    disabled={isDeleting}
                    style={[
                        styles.deleteButton,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(43,38,33,0.12)',
                        },
                        isDeleting ? styles.deleteButtonDisabled : null,
                    ]}
                >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <Text style={[styles.deleteButtonLabel, { color: colors.danger }]}>
                        {t('noteDetail.deleteTitle', 'Delete Note')}
                    </Text>
                </Pressable>
            ) : null}
        </>
    );

    return (
        <View style={styles.sheetSurface}>
            {interactionFeedback ? (
                <View pointerEvents="none" style={styles.feedbackOverlay}>
                    <TransientStatusChip
                        key={interactionFeedback.token}
                        style={styles.feedbackChip}
                        {...getFeedbackPresentation(t, interactionFeedback.type)}
                    />
                </View>
            ) : null}
            {showPolaroidCapture && note ? (
                <View pointerEvents="none" style={styles.offscreenPolaroidCapture}>
                    <PolaroidExportView
                        ref={polaroidCaptureRef}
                        note={note}
                        fallbackLocationLabel={polaroidFallbackLocationLabel}
                        onReady={onPolaroidCaptureReady}
                    />
                </View>
            ) : null}
            <PolaroidExportAnimation
                uri={polaroidAnimationUri}
                success={polaroidAnimationSuccess}
                successLabel={t('noteDetail.polaroidSaved', 'Saved to your photos')}
                onFinished={onPolaroidAnimationFinished}
            />
            <View style={styles.scrollClip}>
                {Platform.OS === 'android' ? (
                    <BottomSheetScrollView
                        ref={scrollContainerRef}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardDismissMode="interactive"
                        keyboardShouldPersistTaps="handled"
                    >
                        {scrollContent}
                    </BottomSheetScrollView>
                ) : (
                    <ScrollView
                        ref={scrollContainerRef}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        automaticallyAdjustKeyboardInsets
                        keyboardDismissMode="interactive"
                        keyboardShouldPersistTaps="handled"
                    >
                        {scrollContent}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sheetSurface: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'visible',
        position: 'relative',
    },
    scrollClip: {
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
    deleteButton: {
        marginTop: 20,
        minHeight: 60,
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    deleteButtonDisabled: {
        opacity: 0.55,
    },
    deleteButtonLabel: {
        fontSize: 15,
        fontWeight: '700',
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
    offscreenPolaroidCapture: {
        position: 'absolute',
        left: -9999,
        top: 0,
        width: POLAROID_EXPORT_WIDTH,
        height: POLAROID_EXPORT_HEIGHT,
        opacity: 1,
        zIndex: -1,
    },
    photoContainer: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        marginBottom: 16,
    },
    photoCard: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    photoCaptionOverlay: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 14,
        alignItems: 'center',
        zIndex: 6,
    },
    photoCaptionChipOverlay: {
        position: 'relative',
        left: undefined,
        right: undefined,
        bottom: undefined,
    },
    photoCaptionOverlayField: {
        minHeight: 38,
        borderRadius: 19,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    photoCaptionOverlayFieldEditing: {
        width: '84%',
    },
    photoCaptionOverlayInput: {
        flex: 1,
        height: 20,
        fontSize: 13.5,
        lineHeight: 18,
        fontFamily: Typography.body.fontFamily,
        fontWeight: '600',
        paddingVertical: 0,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    photoCaptionClearButton: {
        marginLeft: 2,
        alignItems: 'center',
        justifyContent: 'center',
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
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    doodleOverlay: {
        position: 'absolute',
        ...STICKER_ARTBOARD_FRAME,
        opacity: 0.5,
    },
    stickerOverlay: {
        position: 'absolute',
        ...STICKER_ARTBOARD_FRAME,
    },
    textStickerOverlay: {
        zIndex: 0,
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
    editTextInputWrap: {
        width: '100%',
        alignSelf: 'stretch',
    },
    editTextInputWrapInactive: {
        opacity: 0.9,
    },
    editTextInput: {
        width: '100%',
        minWidth: 0,
        paddingVertical: 0,
    },
    editTextInputActive: {
        alignSelf: 'stretch',
        paddingHorizontal: 24,
        minHeight: 72,
    },
    editTextInputInactive: {
        opacity: 0.62,
    },
});
