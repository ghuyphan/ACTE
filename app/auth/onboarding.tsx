import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

const SLIDES = [
    { emoji: '🪴', titleKey: 'onboarding.title1', subtitleKey: 'onboarding.subtitle1' },
    { emoji: '☕️', titleKey: 'onboarding.title2', subtitleKey: 'onboarding.subtitle2' },
    { emoji: '💛', titleKey: 'onboarding.title3', subtitleKey: 'onboarding.subtitle3' },
];

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const [step, setStep] = useState(0);

    const completeOnboarding = async () => {
        await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
        router.replace('/(tabs)');
    };

    const nextStep = () => {
        if (step < SLIDES.length - 1) {
            setStep(step + 1);
        } else {
            completeOnboarding();
        }
    };

    const slide = SLIDES[step];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={
                    isDark
                        ? [colors.background, colors.card, '#1A1A1A']
                        : [colors.background, colors.surface, '#ECE2D7']
                }
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <View style={styles.content}>
                <Animated.View
                    key={'icon-' + step}
                    entering={FadeInDown.springify().mass(0.8)}
                    exiting={FadeOutDown.duration(200)}
                    style={[styles.emojiContainer, { overflow: 'hidden' }]}
                >
                    <View style={[StyleSheet.absoluteFillObject, isOlderIOS && { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]} />
                    <GlassView style={StyleSheet.absoluteFillObject} colorScheme={isDark ? 'dark' : 'light'} />
                    <Text style={styles.emoji}>{slide.emoji}</Text>
                </Animated.View>

                <Animated.Text
                    key={'title-' + step}
                    entering={FadeInDown.delay(100).springify()}
                    style={[styles.title, { color: colors.text }]}
                >
                    {t(slide.titleKey)}
                </Animated.Text>

                <Animated.Text
                    key={'subtitle-' + step}
                    entering={FadeInDown.delay(200).springify()}
                    style={[styles.subtitle, { color: colors.secondaryText }]}
                >
                    {t(slide.subtitleKey)}
                </Animated.Text>
            </View>

            <View style={styles.bottom}>
                {/* Dots */}
                <View style={styles.dots}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                { backgroundColor: colors.border },
                                step === index && [styles.activeDot, { backgroundColor: colors.primary }],
                            ]}
                        />
                    ))}
                </View>

                {/* Next Button */}
                <PrimaryButton
                    label={
                        step === SLIDES.length - 1
                            ? t('onboarding.getStarted', 'Get Started')
                            : t('onboarding.next', 'Next')
                    }
                    onPress={nextStep}
                />

                {/* Skip */}
                <View style={styles.skipContainer}>
                    {step < SLIDES.length - 1 ? (
                        <Pressable onPress={completeOnboarding} style={({ pressed }) => [
                            styles.skipButton,
                            pressed && { opacity: 0.7 }
                        ]}>
                            <Text style={[styles.skipText, { color: colors.secondaryText }]}>
                                {t('onboarding.skip', 'Skip')}
                            </Text>
                        </Pressable>
                    ) : (
                        <View style={styles.skipPlaceholder} />
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 80,
    },
    emojiContainer: {
        width: 140,
        height: 140,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    emoji: {
        fontSize: 72,
    },
    title: {
        ...Typography.screenTitle,
        fontSize: 34,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitle: {
        ...Typography.heroSubtitle,
        textAlign: 'center',
        lineHeight: 28,
        fontWeight: '500',
    },
    bottom: {
        alignItems: 'center',
        paddingBottom: 48,
        paddingHorizontal: Layout.screenPadding + 4,
    },
    dots: {
        flexDirection: 'row',
        marginBottom: 36,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    activeDot: {
        width: 28,
        borderRadius: 4,
    },
    skipContainer: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipButton: {
        padding: 12,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'System',
    },
    skipPlaceholder: {
        height: 48,
    },
});
