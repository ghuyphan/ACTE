import { Ionicons } from '@expo/vector-icons';
import DoodleIcon from '../../ui/DoodleIcon';
import StickerIcon from '../../ui/StickerIcon';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type NoteDetailEditToolbarProps = {
    colors: {
        card: string;
        captureGlassColorScheme: 'light' | 'dark';
        primary: string;
        text: string;
    };
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
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(43,38,33,0.08)',
    },
    textCardActionPill: {
        minWidth: 34,
        height: 34,
        borderRadius: 17,
        paddingHorizontal: 9,
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
