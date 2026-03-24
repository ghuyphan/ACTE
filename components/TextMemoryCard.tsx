import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DOODLE_ARTBOARD_FRAME } from '../constants/doodleLayout';
import { Layout, Shadows } from '../constants/theme';
import { getTextNoteCardGradient } from '../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../services/noteDoodles';
import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';
import NoteDoodleCanvas from './NoteDoodleCanvas';

interface TextMemoryCardProps {
    text: string;
    noteId?: string;
    emoji?: string | null;
    doodleStrokesJson?: string | null;
}

export default function TextMemoryCard({ text, noteId, emoji = null, doodleStrokesJson = null }: TextMemoryCardProps) {
    const gradient = getTextNoteCardGradient({ text, noteId, emoji });
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
        ...DOODLE_ARTBOARD_FRAME,
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
    memoryTextMedium: {
        fontSize: 18,
        lineHeight: 26,
    },
    memoryTextSmall: {
        fontSize: 16,
        lineHeight: 22,
    },
});
