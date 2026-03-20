import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DOODLE_ARTBOARD_FRAME } from '../constants/doodleLayout';
import { Layout, Shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import { parseNoteDoodleStrokes } from '../services/noteDoodles';

interface ImageMemoryCardProps {
    imageUrl: string;
    doodleStrokesJson?: string | null;
}

export default function ImageMemoryCard({ imageUrl, doodleStrokesJson = null }: ImageMemoryCardProps) {
    const { colors } = useTheme();
    const doodleStrokes = parseNoteDoodleStrokes(doodleStrokesJson);

    return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
            />
            {doodleStrokes.length > 0 ? (
                <View pointerEvents="none" style={styles.doodleOverlay}>
                    <NoteDoodleCanvas strokes={doodleStrokes} />
                </View>
            ) : null}
        </View>
    );
}

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
