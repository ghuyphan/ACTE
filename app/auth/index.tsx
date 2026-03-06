import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../hooks/useTheme';

// Configure Google Sign-In
GoogleSignin.configure({
    // IMPORTANT: Replace this with your actual Web Client ID from Firebase Console.
    // Go to Firebase Console -> Authentication -> Sign-in method -> Google -> Web SDK configuration -> Web client ID
    webClientId: '380816810604-jcr2hrg0ofnh9iblp1vd67nq294qad60.apps.googleusercontent.com',
});

export default function LoginScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const colors = Colors.dark;
    const isDark = true;
    const insets = useSafeAreaInsets();
    const [isSigninInProgress, setIsSigninInProgress] = useState(false);

    const signIn = async () => {
        try {
            setIsSigninInProgress(true);

            // 1. Check if user's device has Google Play Services (required for Android)
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // 2. Start the native Google Sign-In flow
            const response = await GoogleSignin.signIn();

            // Handle v13+ library response format where cancellations don't throw an error
            if ('type' in response && response.type === 'cancelled') {
                console.log('User cancelled the login flow');
                return;
            }

            // 3. Extract the ID Token safely by casting to 'any' to satisfy TypeScript's strict checks
            // This safely supports both v13+ (response.data.idToken) and v12- (response.idToken)
            const idToken = (response as any).data?.idToken || (response as any).idToken;

            if (!idToken) {
                throw new Error('No ID token returned from Google Sign-In');
            }

            // 4. Create a Firebase credential with the Google ID token
            const googleCredential = auth.GoogleAuthProvider.credential(idToken);

            // 5. Sign-in the user to Firebase
            await auth().signInWithCredential(googleCredential);

            console.log('User signed in to Firebase successfully!');
            router.replace('/(tabs)');
        } catch (error: any) {
            // Catch block remains for backward compatibility with v12 and below
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('User cancelled the login flow');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                console.log('Sign in is already in progress');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                console.log('Google Play Services not available or outdated');
            } else {
                console.error('Firebase Auth Error:', error);
            }
        } finally {
            setIsSigninInProgress(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={
                    isDark
                        ? [colors.background, colors.card, '#2c2c3e']
                        : ['#ffffff', '#fcfcfc', '#f0f0f5']
                }
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <View style={[styles.content, { paddingTop: insets.top }]}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#ffffff10' : '#00000008' }]}>
                    <Ionicons name="heart" size={64} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{t('auth.title', 'ACTE')}</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                    {t('auth.subtitle', 'For everything she loves.')}
                </Text>
            </View>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
                <Pressable
                    style={({ pressed }) => [
                        styles.googleButton,
                        { backgroundColor: colors.text },
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    ]}
                    onPress={signIn}
                    disabled={isSigninInProgress}
                >
                    <Ionicons name="logo-google" size={20} color={colors.background} style={styles.btnIcon} />
                    <Text style={[styles.googleButtonText, { color: colors.background }]}>
                        {isSigninInProgress ? t('auth.signingIn', 'Signing in...') : t('auth.signInGoogle', 'Continue with Google')}
                    </Text>
                </Pressable>
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
        paddingHorizontal: 32,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 12,
        fontFamily: 'System',
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 26,
        fontFamily: 'System',
    },
    bottom: {
        width: '100%',
        paddingHorizontal: 24,
    },
    googleButton: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    btnIcon: {
        marginRight: 10,
    },
    googleButtonText: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'System',
    },
});