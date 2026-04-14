import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { STICKER_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { Layout, Shadows } from '../../constants/theme';
import {
    getGradientStickerMotionVariant,
    getNoteCardTextPalette,
    getNoteColorStickerMotion,
    getTextNoteCardGradient,
    type StickerMotionVariant,
} from '../../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../services/noteStickers';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import DynamicStickerCanvas from './DynamicStickerCanvas';
import { getNoteCardTextSizeStyle, noteCardTextStyles } from './noteCardTextStyles';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import PremiumNoteFinishOverlay from '../ui/PremiumNoteFinishOverlay';
import type { SharedValue } from 'react-native-reanimated';

interface TextMemoryCardProps {
    text: string;
    noteId?: string;
    emoji?: string | null;
    noteColor?: string | null;
    doodleStrokesJson?: string | null;
    stickerPlacementsJson?: string | null;
    remoteBucket?: string;
    isActive?: boolean;
    debugTiltOverride?: SharedValue<DebugTiltState>;
}

function TextMemoryCard({
    text,
    noteId,
    emoji = null,
    noteColor = null,
    doodleStrokesJson = null,
    stickerPlacementsJson = null,
    remoteBucket,
    isActive = false,
    debugTiltOverride,
}: TextMemoryCardProps) {
    const gradient = useMemo(
        () => getTextNoteCardGradient({ text, noteId, emoji, noteColor }),
        [emoji, noteColor, noteId, text]
    );
    const stickerMotionVariant = useMemo<StickerMotionVariant>(
        () => getNoteColorStickerMotion(noteColor) ?? getGradientStickerMotionVariant(gradient),
        [gradient, noteColor]
    );
    const displayText = useMemo(
        () => formatNoteTextWithEmoji(text, emoji),
        [emoji, text]
    );
    const doodleStrokes = useMemo(
        () => parseNoteDoodleStrokes(doodleStrokesJson),
        [doodleStrokesJson]
    );
    const textPalette = useMemo(
        () => getNoteCardTextPalette(gradient),
        [gradient]
    );
    const stickerPlacements = useMemo(
        () => parseNoteStickerPlacements(stickerPlacementsJson),
        [stickerPlacementsJson]
    );

    return (
        <View style={styles.cardShadow}>
            <View style={styles.cardSurface}>
                <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    <PremiumNoteFinishOverlay noteColor={noteColor} />
                    {stickerPlacements.length > 0 ? (
                        <View
                            pointerEvents={__DEV__ && isActive ? 'box-none' : 'none'}
                            style={styles.stickerOverlay}
                        >
                            <DynamicStickerCanvas
                                placements={stickerPlacements}
                                remoteBucket={remoteBucket}
                                isActive={isActive}
                                motionVariant={stickerMotionVariant}
                                debugTiltOverride={debugTiltOverride}
                            />
                        </View>
                    ) : null}
                    {doodleStrokes.length > 0 ? (
                        <View pointerEvents="none" style={styles.doodleOverlay}>
                            <NoteDoodleCanvas strokes={doodleStrokes} />
                        </View>
                    ) : null}
                    <Text 
                        style={[
                            noteCardTextStyles.memoryText,
                            getNoteCardTextSizeStyle(displayText),
                            {
                                color: textPalette.color,
                                textShadowColor: textPalette.shadowColor,
                            },
                        ]} 
                        numberOfLines={8}
                    >
                        {displayText}
                    </Text>
                </LinearGradient>
            </View>
        </View>
    );
}

export default memo(TextMemoryCard);

const styles = StyleSheet.create({
    cardShadow: {
        width: '100%',
        height: '100%',
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
        ...(Platform.OS === 'android' ? {} : Shadows.card),
    },
    cardSurface: {
        flex: 1,
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
        overflow: 'hidden',
    },
    gradient: {
        flex: 1,
        padding: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    doodleOverlay: {
        position: 'absolute',
        ...STICKER_ARTBOARD_FRAME,
        opacity: 1,
    },
    stickerOverlay: {
        position: 'absolute',
        ...STICKER_ARTBOARD_FRAME,
        zIndex: 0,
    },
});
