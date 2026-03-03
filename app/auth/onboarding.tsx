import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const { width } = Dimensions.get('window');
const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

const SLIDES = [
    { emoji: '🧅', titleKey: 'onboarding.title1', subtitleKey: 'onboarding.subtitle1' },
    { emoji: '💛', titleKey: 'onboarding.title2', subtitleKey: 'onboarding.subtitle2' },
    { emoji: '🫶', titleKey: 'onboarding.title3', subtitleKey: 'onboarding.subtitle3' },
];

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const [step, setStep] = useState(0);

    const completeOnboarding = async () => {
        await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
        router.replace('/auth');
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
            <View style={styles.content}>
                <Text style={styles.emoji}>{slide.emoji}</Text>
                <Text style={[styles.title, { color: colors.text }]}>
                    {t(slide.titleKey)}
                </Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    {t(slide.subtitleKey)}
                </Text>
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
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={nextStep}
                >
                    <Text style={[styles.buttonText, { color: isDark ? '#000' : '#fff' }]}>
                        {step === SLIDES.length - 1
                            ? t('onboarding.getStarted', 'Get Started')
                            : t('onboarding.next', 'Next')}
                    </Text>
                </Pressable>

                {/* Skip */}
                {step < SLIDES.length - 1 && (
                    <Pressable onPress={completeOnboarding} style={styles.skipButton}>
                        <Text style={[styles.skipText, { color: colors.secondaryText }]}>
                            {t('onboarding.skip', 'Skip')}
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 24,
        paddingTop: 100,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 80,
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 28,
        paddingHorizontal: 20,
    },
    bottom: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    dots: {
        flexDirection: 'row',
        marginBottom: 32,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    activeDot: {
        width: 24,
        borderRadius: 4,
    },
    button: {
        width: '100%',
        paddingVertical: 18,
        borderRadius: 999,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
    },
    skipButton: {
        marginTop: 16,
        padding: 8,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
