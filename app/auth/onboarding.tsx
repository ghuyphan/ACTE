import { GlassView } from '../../components/ui/GlassView';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeInDown,
    FadeOutDown,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { getPersistentItem, setPersistentItem } from '../../utils/appStorage';
import { isOlderIOS } from '../../utils/platform';

const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

const SLIDES = [
    { emoji: '🧅', titleKey: 'onboarding.title1', subtitleKey: 'onboarding.subtitle1' },
    { emoji: '📍', titleKey: 'onboarding.title2', subtitleKey: 'onboarding.subtitle2' },
    { emoji: '💛', titleKey: 'onboarding.title3', subtitleKey: 'onboarding.subtitle3' },
];

const DOT_SIZE = 8;
const ACTIVE_DOT_WIDTH = 28;

type PaginationDotProps = {
    activeColor: string;
    inactiveColor: string;
    isActive: boolean;
};

function PaginationDot({ activeColor, inactiveColor, isActive }: PaginationDotProps) {
    const animatedStyle = useAnimatedStyle(
        () => ({
            width: withSpring(isActive ? ACTIVE_DOT_WIDTH : DOT_SIZE, {
                damping: 18,
                mass: 0.7,
                stiffness: 220,
            }),
            opacity: withTiming(isActive ? 1 : 0.7, { duration: 180 }),
            backgroundColor: withTiming(isActive ? activeColor : inactiveColor, { duration: 220 }),
            transform: [
                {
                    scale: withSpring(isActive ? 1 : 0.92, {
                        damping: 18,
                        mass: 0.7,
                        stiffness: 220,
                    }),
                },
            ],
        }),
        [activeColor, inactiveColor, isActive]
    );

    return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [isCompleting, setIsCompleting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (user) {
            router.replace('/');
            return;
        }

        void getPersistentItem(HAS_LAUNCHED_KEY)
            .then((hasLaunched) => {
                if (!cancelled && hasLaunched === 'true') {
                    router.replace('/');
                }
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [router, user]);

    const completeOnboarding = async () => {
        if (isCompleting) {
            return;
        }

        setIsCompleting(true);
        await setPersistentItem(HAS_LAUNCHED_KEY, 'true').catch((error) => {
            console.warn('Failed to persist onboarding state:', error);
        });

        // Let the pressed/loading state paint before mounting the tabs tree.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                router.replace('/');
            });
        });
    };

    const nextStep = () => {
        if (isCompleting) {
            return;
        }

        if (step < SLIDES.length - 1) {
            setStep(step + 1);
        } else {
            void completeOnboarding();
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
                style={StyleSheet.absoluteFill}
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
                    <View style={[StyleSheet.absoluteFill, isOlderIOS && { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]} />
                    <GlassView style={StyleSheet.absoluteFill} colorScheme={isDark ? 'dark' : 'light'} />
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
                        <PaginationDot
                            key={index}
                            activeColor={colors.primary}
                            inactiveColor={colors.border}
                            isActive={step === index}
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
                    disabled={isCompleting}
                    loading={isCompleting}
                    onPress={nextStep}
                />

                {/* Skip */}
                <View style={styles.skipContainer}>
                    {step < SLIDES.length - 1 ? (
                        <Pressable disabled={isCompleting} onPress={() => {
                            void completeOnboarding();
                        }} style={({ pressed }) => [
                            styles.skipButton,
                            isCompleting && { opacity: 0.5 },
                            pressed && !isCompleting && { opacity: 0.7 }
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
        alignItems: 'center',
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
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
        fontFamily: 'Noto Sans',
    },
    skipPlaceholder: {
        height: 48,
    },
});
