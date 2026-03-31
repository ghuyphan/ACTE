import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { STICKER_ARTBOARD_FRAME } from '../constants/doodleLayout';
import { Layout, Shadows } from '../constants/theme';
import {
    getGradientStickerMotionVariant,
    getNoteColorStickerMotion,
    getTextNoteCardGradient,
    type StickerMotionVariant,
} from '../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../services/noteDoodles';
import { parseNoteStickerPlacements } from '../services/noteStickers';
import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import DynamicStickerCanvas from './DynamicStickerCanvas';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import PremiumNoteFinishOverlay from './ui/PremiumNoteFinishOverlay';
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

function WaterCardOverlay() {
    const drift = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const driftAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(drift, {
                    toValue: 1,
                    duration: 4600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(drift, {
                    toValue: 0,
                    duration: 4600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 2800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 2800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        driftAnimation.start();
        pulseAnimation.start();

        return () => {
            driftAnimation.stop();
            pulseAnimation.stop();
            drift.stopAnimation();
            pulse.stopAnimation();
        };
    }, [drift, pulse]);

    const driftStyle = {
        opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.14, 0.22],
        }),
        transform: [
            {
                translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-18, 22],
                }),
            },
            {
                translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 16],
                }),
            },
            {
                rotate: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-8deg', '6deg'],
                }),
            },
            {
                scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.04],
                }),
            },
        ],
    };

    const shimmerStyle = {
        opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.06, 0.1],
        }),
        transform: [
            {
                translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, -10],
                }),
            },
            {
                translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, -8],
                }),
            },
        ],
    };

    return (
        <>
            <View pointerEvents="none" style={styles.waterBaseGlow} />
            <Animated.View
                pointerEvents="none"
                testID="text-memory-card-water-overlay"
                style={[styles.waterDriftOverlay, driftStyle]}
            >
                <LinearGradient
                    colors={[
                        'rgba(255,255,255,0.36)',
                        'rgba(255,255,255,0.12)',
                        'rgba(255,255,255,0)',
                    ]}
                    start={{ x: 0, y: 0.15 }}
                    end={{ x: 1, y: 0.85 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.waterShimmer, shimmerStyle]} />
        </>
    );
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
                {stickerMotionVariant === 'water' ? <WaterCardOverlay /> : null}
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
    waterBaseGlow: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(214, 243, 255, 0.08)',
    },
    waterDriftOverlay: {
        position: 'absolute',
        width: '145%',
        height: '72%',
        top: '-6%',
        left: '-18%',
        borderRadius: 999,
    },
    waterShimmer: {
        position: 'absolute',
        width: '68%',
        height: '32%',
        right: '-6%',
        bottom: '12%',
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
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
        fontFamily: 'System',
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
