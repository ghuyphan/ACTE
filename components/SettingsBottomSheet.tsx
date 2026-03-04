import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { GlassView } from 'expo-glass-effect';
import React, { forwardRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export type SettingsBottomSheetProps = {
    children: React.ReactNode;
    onClose?: () => void;
};

const SettingsBottomSheet = forwardRef<BottomSheetModal, SettingsBottomSheetProps>(
    ({ children, onClose }, ref) => {
        const { colors, isDark } = useTheme();

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    appearsOnIndex={0}
                    disappearsOnIndex={-1}
                    pressBehavior="close"
                />
            ),
            []
        );

        const renderBackground = useCallback(
            ({ style }: any) => (
                <View style={[style, styles.glassContainer]}>
                    <GlassView
                        style={StyleSheet.absoluteFillObject}
                        colorScheme={isDark ? 'dark' : 'light'}
                    />
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />
                </View>
            ),
            [isDark]
        );

        const handleSheetChanges = useCallback((index: number) => {
            if (index === -1 && onClose) {
                onClose();
            }
        }, [onClose]);

        return (
            <BottomSheetModal
                ref={ref}
                enableDynamicSizing={true}
                enablePanDownToClose={true}
                backdropComponent={renderBackdrop}
                backgroundComponent={renderBackground}
                handleIndicatorStyle={{ backgroundColor: colors.border }}
                onChange={handleSheetChanges}
            >
                <BottomSheetView style={styles.contentContainer}>
                    {children}
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

const styles = StyleSheet.create({
    contentContainer: {
        padding: 24,
        paddingBottom: 40,
    },
    glassContainer: {
        borderRadius: 24,
        overflow: 'hidden',
    },
});

SettingsBottomSheet.displayName = 'SettingsBottomSheet';

export default SettingsBottomSheet;
