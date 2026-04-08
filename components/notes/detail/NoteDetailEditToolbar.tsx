import { Ionicons } from '@expo/vector-icons';
import DoodleIcon from '../../ui/DoodleIcon';
import StickerIcon from '../../ui/StickerIcon';
import { type TFunction } from 'i18next';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type NoteDetailEditToolbarProps = {
    colors: {
        captureCardText: string;
        card: string;
        captureGlassColorScheme: 'light' | 'dark';
        primary: string;
        text: string;
    };
    displayedStickerPlacementsCount: number;
    doodleModeEnabled: boolean;
    editDoodleStrokesCount: number;
    importingSticker: boolean;
    isEditing: boolean;
    onClearDoodle: () => void;
    onShowStickerSourceOptions: () => void;
    onStickerAction: (action: 'rotate-left' | 'rotate-right' | 'smaller' | 'larger' | 'duplicate' | 'front' | 'remove' | 'outline-toggle') => void;
    onToggleDoodleMode: () => void;
    onToggleStickerMode: () => void;
    onToggleStickerMotionLock: () => void;
    onUndoDoodle: () => void;
    selectedStickerId: string | null;
    selectedStickerIsStamp: boolean;
    selectedStickerMotionLocked: boolean;
    selectedStickerOutlineEnabled: boolean;
    stickerModeEnabled: boolean;
    stickersEnabled: boolean;
    t: TFunction;
};

export default function NoteDetailEditToolbar({
    colors,
    displayedStickerPlacementsCount,
    doodleModeEnabled,
    editDoodleStrokesCount,
    importingSticker,
    isEditing,
    onClearDoodle,
    onShowStickerSourceOptions,
    onStickerAction,
    onToggleDoodleMode,
    onToggleStickerMode,
    onToggleStickerMotionLock,
    onUndoDoodle,
    selectedStickerId,
    selectedStickerIsStamp,
    selectedStickerMotionLocked,
    selectedStickerOutlineEnabled,
    stickerModeEnabled,
    stickersEnabled,
    t,
}: NoteDetailEditToolbarProps) {
    if (!isEditing) {
        return null;
    }

    const detailBadgeFill = colors.card;
    const detailBadgeBorder =
        colors.captureGlassColorScheme === 'dark'
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(43,38,33,0.12)';
    const detailBadgeIconColor = colors.text;
    const detailBadgeActiveIconColor = colors.primary;

    return (
        <View pointerEvents="box-none" style={styles.textEditHeader}>
            <View style={[styles.textCardActionCluster, styles.cardTopOverlayRowWrap]}>
                <Pressable
                    testID="note-detail-doodle-toggle"
                    onPress={onToggleDoodleMode}
                    style={[
                        styles.textCardActionButton,
                        styles.topOverlayActionButton,
                        {
                            backgroundColor: detailBadgeFill,
                            borderColor: detailBadgeBorder,
                        },
                    ]}
                    >
                        <DoodleIcon
                            size={18}
                            color={doodleModeEnabled ? detailBadgeActiveIconColor : detailBadgeIconColor}
                        />
                    </Pressable>
                {stickersEnabled ? (
                    <Pressable
                        testID="note-detail-sticker-toggle"
                        onPress={onToggleStickerMode}
                        style={[
                            styles.textCardActionButton,
                            styles.topOverlayActionButton,
                            {
                                backgroundColor: detailBadgeFill,
                                borderColor: detailBadgeBorder,
                            },
                        ]}
                    >
                        <StickerIcon
                            size={18}
                            color={stickerModeEnabled ? detailBadgeActiveIconColor : detailBadgeIconColor}
                        />
                    </Pressable>
                ) : null}
                {stickersEnabled && (stickerModeEnabled || displayedStickerPlacementsCount > 0) ? (
                    <Pressable
                        testID="note-detail-sticker-motion-lock"
                        accessibilityLabel={
                            selectedStickerMotionLocked
                                ? t('capture.unlockStickerMotion', 'Unlock sticker motion')
                                : t('capture.lockStickerMotion', 'Lock sticker motion')
                        }
                        onPress={onToggleStickerMotionLock}
                        disabled={!selectedStickerId}
                        style={[
                            styles.textCardActionButton,
                            styles.topOverlayActionButton,
                            {
                                backgroundColor: selectedStickerMotionLocked ? colors.primary : detailBadgeFill,
                                borderColor: selectedStickerMotionLocked ? colors.primary : detailBadgeBorder,
                            },
                            !selectedStickerId ? styles.textCardActionDisabled : null,
                        ]}
                    >
                        <Ionicons
                            name={selectedStickerMotionLocked ? 'lock-closed' : 'lock-open-outline'}
                            size={16}
                            color={selectedStickerMotionLocked ? colors.captureCardText : detailBadgeIconColor}
                        />
                    </Pressable>
                ) : null}
                {doodleModeEnabled ? (
                    <>
                        <Pressable
                            testID="note-detail-doodle-undo"
                            onPress={onUndoDoodle}
                            disabled={editDoodleStrokesCount === 0}
                            style={[
                                styles.textCardActionPill,
                                styles.topOverlayActionButton,
                                {
                                    backgroundColor: detailBadgeFill,
                                    borderColor: detailBadgeBorder,
                                },
                                editDoodleStrokesCount === 0 ? styles.textCardActionDisabled : null,
                            ]}
                        >
                            <Ionicons name="arrow-undo-outline" size={14} color={detailBadgeIconColor} />
                        </Pressable>
                        <Pressable
                            testID="note-detail-doodle-clear"
                            onPress={onClearDoodle}
                            disabled={editDoodleStrokesCount === 0}
                            style={[
                                styles.textCardActionPill,
                                styles.topOverlayActionButton,
                                {
                                    backgroundColor: detailBadgeFill,
                                    borderColor: detailBadgeBorder,
                                },
                                editDoodleStrokesCount === 0 ? styles.textCardActionDisabled : null,
                            ]}
                        >
                            <Ionicons name="trash-outline" size={16} color={detailBadgeIconColor} />
                        </Pressable>
                    </>
                ) : null}
                {stickerModeEnabled ? (
                    <>
                        <Pressable
                            testID="note-detail-sticker-import"
                            onPress={onShowStickerSourceOptions}
                            disabled={importingSticker}
                            style={[
                                styles.textCardActionPill,
                                styles.topOverlayActionButton,
                                {
                                    backgroundColor: detailBadgeFill,
                                    borderColor: detailBadgeBorder,
                                },
                                importingSticker ? styles.textCardActionDisabled : null,
                            ]}
                        >
                            <Ionicons name="add-outline" size={14} color={detailBadgeIconColor} />
                        </Pressable>
                        {!selectedStickerIsStamp ? (
                            <Pressable
                                testID="note-detail-sticker-outline-toggle"
                                accessibilityLabel={
                                    selectedStickerOutlineEnabled
                                        ? t('capture.stickerOutlineDisable', 'Turn off outline')
                                        : t('capture.stickerOutlineEnable', 'Turn on outline')
                                }
                                onPress={() => onStickerAction('outline-toggle')}
                                disabled={!selectedStickerId}
                                style={[
                                    styles.textCardActionPill,
                                    styles.topOverlayActionButton,
                                    {
                                        backgroundColor: detailBadgeFill,
                                        borderColor: detailBadgeBorder,
                                    },
                                    !selectedStickerId ? styles.textCardActionDisabled : null,
                                ]}
                            >
                                <Ionicons
                                    name={selectedStickerOutlineEnabled ? 'ellipse' : 'ellipse-outline'}
                                    size={14}
                                    color={
                                        selectedStickerOutlineEnabled && selectedStickerId
                                            ? detailBadgeActiveIconColor
                                            : detailBadgeIconColor
                                    }
                                />
                            </Pressable>
                        ) : null}
                        <Pressable
                            testID="note-detail-sticker-remove"
                            onPress={() => onStickerAction('remove')}
                            disabled={!selectedStickerId}
                            style={[
                                styles.textCardActionPill,
                                styles.topOverlayActionButton,
                                {
                                    backgroundColor: detailBadgeFill,
                                    borderColor: detailBadgeBorder,
                                },
                                !selectedStickerId ? styles.textCardActionDisabled : null,
                            ]}
                        >
                            <Ionicons name="trash-outline" size={14} color={detailBadgeIconColor} />
                        </Pressable>
                    </>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    textEditHeader: {
        position: 'absolute',
        top: 28,
        right: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
        zIndex: 2,
    },
    textCardActionCluster: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardTopOverlayRowWrap: {
        flexWrap: 'wrap',
    },
    topOverlayActionButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    textCardActionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(43,38,33,0.08)',
    },
    textCardActionPill: {
        minWidth: 36,
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(43,38,33,0.08)',
    },
    textCardActionDisabled: {
        opacity: 0.45,
    },
});
