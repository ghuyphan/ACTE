import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface TextMemoryCardProps {
    text: string;
    locationName: string;
    date: string;
    noteId?: string;
}

function hashToIndex(str: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % max;
    }
    return Math.abs(hash) % max;
}

export default function TextMemoryCard({ text, locationName, date, noteId }: TextMemoryCardProps) {
    const { colors, isDark } = useTheme();
    const bgColor = colors.primary;
    const textColor = isDark ? '#000000' : '#1C1C1E';
    const subtitleColor = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.5)';

    return (
        <View style={[styles.card, { backgroundColor: bgColor }]}>
            <View style={[styles.restaurantBadge, { maxWidth: '90%', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.45)' }]}>
                <Text style={[styles.restaurantText, { color: textColor, textShadowRadius: 0 }]} numberOfLines={1} ellipsizeMode="tail">📍 {locationName}</Text>
            </View>
            <Text style={[styles.memoryText, { color: textColor, textShadowRadius: 0 }]} numberOfLines={5}>
                {text}
            </Text>
            <View style={styles.footer}>
                <Text style={[styles.dateText, { color: subtitleColor }]}>{date}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 28,
        padding: 28,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
    },
    restaurantBadge: {
        position: 'absolute',
        top: 24,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        alignSelf: 'center',
    },

    restaurantText: {
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0,
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
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
    footer: {
        position: 'absolute',
        bottom: 28,
        left: 28,
        right: 28,
        alignItems: 'center',
    },
    dateText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
