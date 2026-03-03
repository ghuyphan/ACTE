import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ImageMemoryCardProps {
    imageUrl: string;
    locationName: string;
    date: string;
}

export default function ImageMemoryCard({ imageUrl, locationName, date }: ImageMemoryCardProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.card}>
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
            />
            <View style={styles.overlay}>
                <Text style={[styles.locationText, { color: colors.primary, flex: 1, marginRight: 12 }]} numberOfLines={1} ellipsizeMode="tail">📍 {locationName}</Text>
                <Text style={styles.dateText}>{date}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#1C1C1E',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 50,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    locationText: {
        fontWeight: '800',
        fontSize: 16,
        letterSpacing: 0.3,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    dateText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
