// Mock GoogleSignin for Expo Go preview
const statusCodes = { SIGN_IN_CANCELLED: 1, IN_PROGRESS: 2, PLAY_SERVICES_NOT_AVAILABLE: 3 };
const GoogleSignin = {
    configure: () => { },
    hasPlayServices: async () => true,
    signIn: async () => ({ user: { name: 'Demo User' } }),
};

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

export default function LoginScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [isSigninInProgress, setIsSigninInProgress] = useState(false);

    const signIn = async () => {
        try {
            setIsSigninInProgress(true);
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            console.log('User signed in:', userInfo);
            router.replace('/(tabs)');
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('User cancelled the login flow');
            } else {
                console.log('Error:', error);
            }
        } finally {
            setIsSigninInProgress(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>{t('auth.title')}</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{t('auth.subtitle')}</Text>
            </View>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
                <Pressable
                    style={[styles.googleButton, { backgroundColor: colors.text }]}
                    onPress={signIn}
                    disabled={isSigninInProgress}
                >
                    <Text style={[styles.googleButtonText, { color: colors.background }]}>
                        {isSigninInProgress ? t('auth.signingIn') : t('auth.signInGoogle')}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 24,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 42,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 17,
        textAlign: 'center',
        lineHeight: 24,
    },
    bottom: {
        width: '100%',
    },
    googleButton: {
        paddingVertical: 16,
        borderRadius: 999,
        width: '100%',
        alignItems: 'center',
    },
    googleButtonText: {
        fontSize: 17,
        fontWeight: '700',
    },
});
