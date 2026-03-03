import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

export default function Index() {
    const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
    const { colors } = useTheme();

    useEffect(() => {
        async function checkFirstLaunch() {
            try {
                const hasLaunched = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
                if (hasLaunched === 'true') {
                    setIsFirstLaunch(false);
                } else {
                    setIsFirstLaunch(true);
                }
            } catch (error) {
                setIsFirstLaunch(false);
            }
        }
        checkFirstLaunch();
    }, []);

    if (isFirstLaunch === null) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isFirstLaunch) {
        return <Redirect href="/auth/onboarding" />;
    }

    // TODO: Add an auth check here later when Firebase is connected
    // If user is logged in -> Redirect to '/(tabs)'
    // Else -> Redirect to '/auth'

    return <Redirect href="/(tabs)" />;
}
