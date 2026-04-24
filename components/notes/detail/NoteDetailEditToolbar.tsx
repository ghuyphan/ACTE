import { Ionicons } from '@expo/vector-icons';
import DoodleIcon from '../../ui/DoodleIcon';
import StickerIcon from '../../ui/StickerIcon';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { getNoteDetailTheme, type NoteDetailColors } from './noteDetailTheme';

type NoteDetailEditToolbarProps = {
    colors: NoteDetailColors;
    doodleModeEnabled: boolean;
    editDoodleStrokesCount: number;
    importingSticker: boolean;
    isEditing: boolean;
    onClearDoodle: () => void;
    onShowStickerSourceOptions: () => void;
    onToggleDoodleMode: () => void;
    onToggleStickerMode: () => void;
    onUndoDoodle: () => void;
    stickerModeEnabled: boolean;
    stickersEnabled: boolean;
};

export default function NoteDetailEditToolbar({
    colors,
    doodleModeEnabled,
    editDoodleStrokesCount,
    importingSticker,
    isEditing,
    onClearDoodle,
    onShowStickerSourceOptions,
    onToggleDoodleMode,
    onToggleStickerMode,
    onUndoDoodle,
    stickerModeEnabled,
	stickersEnabled,
}: NoteDetailEditToolbarProps) {
    const { t } = useTranslation();

    if (!isEditing) {
        return null;
    }

    const noteDetailTheme = getNoteDetailTheme(colors);
    const detailBadgeFill = noteDetailTheme.badgeSurface;
    const detailBadgeBorder = noteDetailTheme.badgeBorder;
    const detailBadgeIconColor = colors.text;
    const detailBadgeActiveIconColor = colors.primary;

    return (
        <View pointerEvents="box-none" style={styles.textEditHeader}>
            <View style={[styles.textCardActionCluster, styles.cardTopOverlayRowWrap]}>
                <Pressable
                    testID="note-detail-doodle-toggle"
                    accessibilityRole="button"
                    accessibilityLabel={t('noteDetail.toggleDoodleMode', 'Toggle doodle mode')}
                    accessibilityState={{ selected: doodleModeEnabled }}
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
                        accessibilityRole="button"
                        accessibilityLabel={t('noteDetail.toggleStickerMode', 'Toggle sticker mode')}
                        accessibilityState={{ selected: stickerModeEnabled }}
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
                {doodleModeEnabled ? (
                    <>
                        <Pressable
                            testID="note-detail-doodle-undo"
                            accessibilityRole="button"
                            accessibilityLabel={t('noteDetail.doodleUndo', 'Undo')}
                            accessibilityState={{ disabled: editDoodleStrokesCount === 0 }}
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
                            accessibilityRole="button"
                            accessibilityLabel={t('noteDetail.doodleClear', 'Clear')}
                            accessibilityState={{ disabled: editDoodleStrokesCount === 0 }}
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
                    <Pressable
                        testID="note-detail-sticker-import"
                        accessibilityRole="button"
                        accessibilityLabel={t('noteDetail.addSticker', 'Add sticker')}
                        accessibilityState={{ disabled: importingSticker }}
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
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    textEditHeader: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
        zIndex: 3,
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
        zIndex: 10,
    },
    textCardActionButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    textCardActionPill: {
        minWidth: 34,
        height: 34,
        borderRadius: 17,
        paddingHorizontal: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    textCardActionDisabled: {
        opacity: 0.45,
    },
});
