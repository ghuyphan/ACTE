import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import LivePhotoIcon from '../../ui/LivePhotoIcon';

type NoteDetailStatusBadgesProps = {
    captureGlassColorScheme: 'light' | 'dark';
    colors: {
        card: string;
        danger: string;
    };
    favoriteFilledIconStyle: any;
    favoriteFilledTintStyle: any;
    favoriteOutlineIconStyle: any;
    inactiveColor: string;
    isLivePhoto: boolean;
    isSharedByMe: boolean;
    onToggleFavorite: () => void;
};

export default function NoteDetailStatusBadges({
    captureGlassColorScheme,
    colors,
    favoriteFilledIconStyle,
    favoriteFilledTintStyle,
    favoriteOutlineIconStyle,
    inactiveColor,
    isLivePhoto,
    isSharedByMe,
    onToggleFavorite,
}: NoteDetailStatusBadgesProps) {
    const borderColor =
        captureGlassColorScheme === 'dark'
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(43,38,33,0.12)';

    return (
        <View pointerEvents="box-none" style={styles.cardStatusBadgeRow}>
            <View pointerEvents="box-none" style={styles.leftBadgeGroup}>
                {isSharedByMe ? (
                    <View
                        pointerEvents="none"
                        testID="note-detail-shared-post"
                        style={[
                            styles.cardStatusBadge,
                            styles.cardSharedBadge,
                            {
                                backgroundColor: colors.card,
                                borderColor,
                            },
                        ]}
                    >
                        <Ionicons name="people-outline" size={16} color={inactiveColor} />
                    </View>
                ) : null}
                {isLivePhoto ? (
                    <View
                        pointerEvents="none"
                        testID="note-detail-live-photo"
                        style={[
                            styles.cardStatusBadge,
                            styles.cardLivePhotoBadge,
                            {
                                backgroundColor: colors.card,
                                borderColor,
                            },
                        ]}
                    >
                        <LivePhotoIcon size={18} color={inactiveColor} />
                    </View>
                ) : null}
            </View>
            <Pressable
                testID="note-detail-favorite"
                onPress={onToggleFavorite}
                style={[
                    styles.cardStatusBadge,
                    styles.cardFavBadge,
                    {
                        backgroundColor: colors.card,
                        borderColor,
                    },
                ]}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.favoriteBadgeTint,
                        favoriteFilledTintStyle,
                    ]}
                />
                <View style={styles.favoriteIconStack}>
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.favoriteIconLayer,
                            favoriteOutlineIconStyle,
                        ]}
                    >
                        <Ionicons name="heart-outline" size={16} color={inactiveColor} />
                    </Animated.View>
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.favoriteIconLayer,
                            favoriteFilledIconStyle,
                        ]}
                    >
                        <Ionicons name="heart" size={16} color={colors.danger} />
                    </Animated.View>
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    cardStatusBadgeRow: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 3,
    },
    leftBadgeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardStatusBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    cardFavBadge: {
        marginLeft: 'auto',
    },
    cardSharedBadge: {
        marginRight: 8,
    },
    cardLivePhotoBadge: {
        marginRight: 8,
    },
    favoriteBadgeTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 85, 115, 0.16)',
    },
    favoriteIconStack: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    favoriteIconLayer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
