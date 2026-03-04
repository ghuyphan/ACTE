import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ImageMemoryCardProps {
    imageUrl: string;
}

export default function ImageMemoryCard({ imageUrl }: ImageMemoryCardProps) {
    return (
        <View style={styles.card}>
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
        borderRadius: 40,
        borderCurve: 'continuous',
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
});
