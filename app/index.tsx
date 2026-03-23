import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { getPersistentItem } from '../utils/appStorage';

const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

export default function Index() {
    const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
    const { colors } = useTheme();

    useEffect(() => {
        async function checkFirstLaunch() {
            try {
                const hasLaunched = await getPersistentItem(HAS_LAUNCHED_KEY);
                if (hasLaunched === 'true') {
                    setIsFirstLaunch(false);
                } else {
                    setIsFirstLaunch(true);
                }
            } catch {
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

    return <Redirect href="/(tabs)" />;
}
