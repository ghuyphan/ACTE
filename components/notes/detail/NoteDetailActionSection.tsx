import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AnimatedActionButton } from './NoteDetailPrimitives';
import { getNoteDetailTheme, type NoteDetailColors } from './noteDetailTheme';
import PolaroidCaptureButton from './PolaroidCaptureButton';

type NoteDetailActionSectionProps = {
    colors: NoteDetailColors;
    editIconAnimatedStyle: any;
    isDeleting: boolean;
    isDownloadingPolaroid: boolean;
    isEditing: boolean;
    onDownloadPolaroid: () => void;
    onPrimaryPress: () => void;
    saveIconAnimatedStyle: any;
};

export default function NoteDetailActionSection({
    colors,
    editIconAnimatedStyle,
    isDeleting,
    isDownloadingPolaroid,
    isEditing,
    onDownloadPolaroid,
    onPrimaryPress,
    saveIconAnimatedStyle,
}: NoteDetailActionSectionProps) {
    const noteDetailTheme = getNoteDetailTheme(colors);
    const successColor = colors.success ?? colors.primary;

    return (
        <Animated.View style={styles.actionRow}>
            <AnimatedActionButton
                onPress={onPrimaryPress}
                testID="note-detail-edit"
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: noteDetailTheme.actionSurface,
                        borderColor: noteDetailTheme.actionBorder,
                    },
                ]}
                delay={100}
                disabled={isDeleting}
            >
                <View style={styles.editIconStack}>
                    <Animated.View style={[styles.editIconLayer, editIconAnimatedStyle]}>
                        <Ionicons
                            name="create-outline"
                            size={20}
                            color={colors.secondaryText}
                        />
                    </Animated.View>
                    <Animated.View style={[styles.editIconLayer, saveIconAnimatedStyle]}>
                        <Ionicons
                            name="checkmark"
                            size={20}
                            color={successColor}
                        />
                    </Animated.View>
                </View>
            </AnimatedActionButton>

            {!isEditing ? (
                <AnimatedActionButton
                    onPress={onDownloadPolaroid}
                    testID="note-detail-download-polaroid"
                    style={[
                        styles.actionBtn,
                        {
                            backgroundColor: noteDetailTheme.actionSurface,
                            borderColor: noteDetailTheme.actionBorder,
                        },
                    ]}
                    delay={140}
                    disabled={isDeleting || isDownloadingPolaroid}
                >
                    <PolaroidCaptureButton
                        color={colors.secondaryText}
                        isCapturing={isDownloadingPolaroid}
                    />
                </AnimatedActionButton>
            ) : null}

        </Animated.View>
    );
}

const styles = StyleSheet.create({
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
    },
    actionBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editIconStack: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editIconLayer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
