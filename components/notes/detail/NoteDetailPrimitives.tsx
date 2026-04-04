import React, { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { Layout } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

const { width } = Dimensions.get('window');
const CARD_SIZE = width - Layout.screenPadding * 2;

export function SkeletonCard({ colors }: { colors: { card: string } }) {
    const opacity = useSharedValue(0.3);
    const animatedOpacityStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.7, { duration: 800 }),
            -1,
            true
        );

        return () => {
            cancelAnimation(opacity);
        };
    }, [opacity]);

    return (
        <View style={styles.scrollContent}>
            <Animated.View
                style={[
                    styles.skeletonCard,
                    { backgroundColor: colors.card },
                    animatedOpacityStyle,
                ]}
            />
            <View style={styles.infoSection}>
                <Animated.View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.card }, animatedOpacityStyle]} />
                <Animated.View style={[styles.skeletonLine, { width: '45%', backgroundColor: colors.card }, animatedOpacityStyle]} />
                <Animated.View style={[styles.skeletonLine, { width: '55%', backgroundColor: colors.card }, animatedOpacityStyle]} />
            </View>
        </View>
    );
}

export function AnimatedActionButton({
    onPress,
    children,
    style,
    testID,
    delay = 0,
    disabled = false,
}: {
    onPress: () => void;
    children: React.ReactNode;
    style: object;
    testID?: string;
    delay?: number;
    disabled?: boolean;
}) {
    const scale = useSharedValue(0);
    const pressScale = useSharedValue(1);
    const reduceMotionEnabled = useReducedMotion();
    const animatedButtonStyle = useAnimatedStyle(() => ({
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: scale.value * pressScale.value }],
    }), [disabled]);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withTiming(1, {
                duration: reduceMotionEnabled ? 110 : 140,
                easing: Easing.out(Easing.cubic),
            })
        );
    }, [delay, reduceMotionEnabled, scale]);

    return (
        <Pressable
            testID={testID}
            onPress={onPress}
            disabled={disabled}
            onPressIn={() => {
                pressScale.value = withTiming(reduceMotionEnabled ? 0.97 : 0.93, {
                    duration: 80,
                    easing: Easing.out(Easing.quad),
                });
            }}
            onPressOut={() => {
                pressScale.value = withTiming(1, {
                    duration: 110,
                    easing: Easing.out(Easing.quad),
                });
            }}
        >
            <Animated.View style={[style, animatedButtonStyle]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        padding: Layout.screenPadding,
        paddingTop: 16,
        paddingBottom: 60,
    },
    skeletonCard: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: Layout.cardRadius,
        marginBottom: 16,
    },
    infoSection: {
        gap: 14,
    },
    skeletonLine: {
        height: 18,
        borderRadius: 9,
    },
});
