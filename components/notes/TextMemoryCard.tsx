import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STICKER_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { Layout, Shadows } from '../../constants/theme';
import {
    getGradientStickerMotionVariant,
    getNoteColorStickerMotion,
    getTextNoteCardGradient,
    type StickerMotionVariant,
} from '../../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../services/noteStickers';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import DynamicStickerCanvas from './DynamicStickerCanvas';
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
    const stickerPlacements = useMemo(
        () => parseNoteStickerPlacements(stickerPlacementsJson),
        [stickerPlacementsJson]
    );

    return (
        <View style={styles.card}>
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
                        styles.memoryText, 
                        displayText.length > 200 ? styles.memoryTextSmall :
                        displayText.length > 100 ? styles.memoryTextMedium : null
                    ]} 
                    numberOfLines={8}
                >
                    {displayText}
                </Text>
            </LinearGradient>
        </View>
    );
}

export default memo(TextMemoryCard);

const styles = StyleSheet.create({
    card: {
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        ...Shadows.card,
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
        opacity: 0.5,
    },
    stickerOverlay: {
        position: 'absolute',
        ...STICKER_ARTBOARD_FRAME,
        opacity: 0.5,
        zIndex: 0,
    },
    memoryText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: -0.5,
        textAlign: 'center',
        lineHeight: 32,
        fontFamily: 'Noto Sans',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        zIndex: 1,
    },
    memoryTextMedium: {
        fontSize: 18,
        lineHeight: 26,
    },
    memoryTextSmall: {
        fontSize: 16,
        lineHeight: 22,
    },
});
