import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Layout, Shadows } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface ImageMemoryCardProps {
    imageUrl: string;
}

export default function ImageMemoryCard({ imageUrl }: ImageMemoryCardProps) {
    const { colors } = useTheme();
    return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
            />
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
});
