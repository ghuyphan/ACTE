import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export default function LoginScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const { user, isReady, isAvailable, signIn } = useAuth();
    const insets = useSafeAreaInsets();
    const [isSigninInProgress, setIsSigninInProgress] = useState(false);
    const [authMessage, setAuthMessage] = useState<string | null>(null);

    const handleSignIn = async () => {
        setAuthMessage(null);
        setIsSigninInProgress(true);
        const result = await signIn();
        setIsSigninInProgress(false);

        if (result.status === 'success') {
            router.replace('/(tabs)');
            return;
        }

        if (result.status === 'cancelled') {
            return;
        }

        setAuthMessage(
            result.message ?? t('auth.signInFailed', 'Unable to sign in right now. Please try again later.')
        );
    };

    const gradientColors: [string, string, string] = isDark
        ? [colors.background, colors.card, '#1A1A1A']
        : [colors.background, colors.surface, '#ECE2D7'];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={gradientColors}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <View style={[styles.content, { paddingTop: insets.top }]}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="heart" size={64} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{t('auth.title', 'Charmly')}</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    {t('auth.subtitle', 'So you never forget what she likes')}
                </Text>
                {!isAvailable ? (
                    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.infoTitle, { color: colors.text }]}>
                            {t('auth.localModeTitle', 'Local mode is ready')}
                        </Text>
                        <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                            {t(
                                'auth.localModeMsg',
                                'This build is using local-first mode. You can keep capturing notes without signing in.'
                            )}
                        </Text>
                    </View>
                ) : null}
                {user ? (
                    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.infoTitle, { color: colors.text }]}>
                            {t('auth.signedInAs', 'Signed in as')}
                        </Text>
                        <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                            {user.displayName || user.email || t('settings.login', 'Sign In')}
                        </Text>
                    </View>
                ) : null}
                {authMessage ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{authMessage}</Text>
                ) : null}
            </View>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
                {!isAvailable ? (
                    <PrimaryButton
                        label={t('auth.continueLocal', 'Continue in local mode')}
                        onPress={() => router.replace('/(tabs)')}
                        variant="neutral"
                    />
                ) : user ? (
                    <>
                        <PrimaryButton
                            label={t('settings.manageAccount', 'Manage account')}
                            onPress={() => router.replace('/auth/profile' as Href)}
                            variant="neutral"
                            style={styles.bottomButton}
                        />
                        <PrimaryButton
                            label={t('auth.continueApp', 'Continue to Charmly')}
                            onPress={() => router.replace('/(tabs)')}
                            variant="secondary"
                        />
                    </>
                ) : (
                    <PrimaryButton
                        label={
                            !isReady || isSigninInProgress
                                ? t('auth.signingIn', 'Signing in...')
                                : t('auth.signInGoogle', 'Sign in with Google')
                        }
                        onPress={handleSignIn}
                        loading={!isReady || isSigninInProgress}
                        variant="neutral"
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding + 12,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: Layout.cardRadius,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        ...Shadows.card,
    },
    title: {
        ...Typography.heroTitle,
        marginBottom: 12,
    },
    subtitle: {
        ...Typography.heroSubtitle,
        textAlign: 'center',
    },
    infoCard: {
        width: '100%',
        marginTop: 28,
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
    },
    infoTitle: {
        ...Typography.button,
        marginBottom: 8,
    },
    infoText: {
        ...Typography.body,
    },
    errorText: {
        ...Typography.body,
        marginTop: 16,
        textAlign: 'center',
    },
    bottom: {
        width: '100%',
        paddingHorizontal: Layout.screenPadding + 4,
        gap: 12,
    },
    bottomButton: {
        width: '100%',
    },
});
