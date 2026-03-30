import { Image } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DOODLE_ARTBOARD_FRAME } from '../constants/doodleLayout';
import { Layout, Shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import { parseNoteDoodleStrokes } from '../services/noteDoodles';
import DynamicStickerCanvas from './DynamicStickerCanvas';
import { parseNoteStickerPlacements } from '../services/noteStickers';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import type { SharedValue } from 'react-native-reanimated';

interface ImageMemoryCardProps {
    imageUrl: string;
    doodleStrokesJson?: string | null;
    stickerPlacementsJson?: string | null;
    remoteBucket?: string;
    isActive?: boolean;
    debugTiltOverride?: SharedValue<DebugTiltState>;
}

function ImageMemoryCard({
    imageUrl,
    doodleStrokesJson = null,
    stickerPlacementsJson = null,
    remoteBucket,
    isActive = false,
    debugTiltOverride,
}: ImageMemoryCardProps) {
    const { colors } = useTheme();
    const doodleStrokes = useMemo(
        () => parseNoteDoodleStrokes(doodleStrokesJson),
        [doodleStrokesJson]
    );
    const stickerPlacements = useMemo(
        () => parseNoteStickerPlacements(stickerPlacementsJson),
        [stickerPlacementsJson]
    );

    return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
            />
            {stickerPlacements.length > 0 ? (
                <View
                    pointerEvents={__DEV__ && isActive ? 'box-none' : 'none'}
                    style={styles.doodleOverlay}
                >
                    <DynamicStickerCanvas
                        placements={stickerPlacements}
                        remoteBucket={remoteBucket}
                        isActive={isActive}
                        debugTiltOverride={debugTiltOverride}
                    />
                </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
                <View pointerEvents="none" style={styles.doodleOverlay}>
                    <NoteDoodleCanvas strokes={doodleStrokes} />
                </View>
            ) : null}
        </View>
    );
}

export default memo(ImageMemoryCard);

const styles = StyleSheet.create({
    card: {
        borderRadius: Layout.cardRadius,
        borderCurve: 'continuous',
        overflow: 'hidden',
        ...Shadows.card,
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    doodleOverlay: {
        position: 'absolute',
        ...DOODLE_ARTBOARD_FRAME,
        opacity: 0.82,
    },
});
