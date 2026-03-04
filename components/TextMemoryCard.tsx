import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardGradients, useTheme } from '../hooks/useTheme';

interface TextMemoryCardProps {
    text: string;
    noteId?: string;
}

function hashToIndex(str: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % max;
    }
    return Math.abs(hash) % max;
}

export default function TextMemoryCard({ text, noteId }: TextMemoryCardProps) {
    const { isDark } = useTheme();

    // Pick a unique gradient based on the note content or id
    const gradientIndex = hashToIndex(noteId || text, CardGradients.length);
    const gradient = CardGradients[gradientIndex];

    return (
        <View style={styles.card}>
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <Text style={styles.memoryText} numberOfLines={5}>
                    {text}
                </Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 40,
        borderCurve: 'continuous',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
    },
    gradient: {
        flex: 1,
        padding: 28,
        justifyContent: 'center',
    },
    memoryText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
        textAlign: 'center',
        lineHeight: 32,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
