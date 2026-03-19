import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Layout, Shadows } from '../constants/theme';
import { CardGradients } from '../hooks/useTheme';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import { parseNoteDoodleStrokes } from '../services/noteDoodles';
import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';

interface TextMemoryCardProps {
    text: string;
    noteId?: string;
    emoji?: string | null;
    doodleStrokesJson?: string | null;
}

function hashToIndex(str: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % max;
    }
    return Math.abs(hash) % max;
}

export default function TextMemoryCard({ text, noteId, emoji = null, doodleStrokesJson = null }: TextMemoryCardProps) {
    // Pick a unique gradient based on the note content or id
    const gradientIndex = hashToIndex(noteId || text, CardGradients.length);
    const gradient = CardGradients[gradientIndex];
    const displayText = formatNoteTextWithEmoji(text, emoji);
    const doodleStrokes = parseNoteDoodleStrokes(doodleStrokesJson);

    return (
        <View style={styles.card}>
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {doodleStrokes.length > 0 ? (
                    <View pointerEvents="none" style={styles.doodleOverlay}>
                        <NoteDoodleCanvas strokes={doodleStrokes} />
                    </View>
                ) : null}
                <Text style={styles.memoryText} numberOfLines={5}>
                    {displayText}
                </Text>
            </LinearGradient>
        </View>
    );
}

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
        top: 18,
        right: 18,
        bottom: 18,
        left: 18,
        opacity: 0.5,
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
});
