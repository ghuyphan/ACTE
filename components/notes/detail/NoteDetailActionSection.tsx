import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AnimatedActionButton } from './NoteDetailPrimitives';

type NoteDetailActionSectionProps = {
    colors: {
        danger: string;
        secondaryText: string;
        success: string;
    };
    editIconAnimatedStyle: any;
    isDark: boolean;
    isDeleting: boolean;
    onDelete: () => void;
    onPrimaryPress: () => void;
    onShare: () => void;
    saveIconAnimatedStyle: any;
};

export default function NoteDetailActionSection({
    colors,
    editIconAnimatedStyle,
    isDark,
    isDeleting,
    onDelete,
    onPrimaryPress,
    onShare,
    saveIconAnimatedStyle,
}: NoteDetailActionSectionProps) {
    const actionButtonBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const actionButtonBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(43,38,33,0.12)';

    return (
        <Animated.View style={styles.actionRow}>
            <AnimatedActionButton
                onPress={onPrimaryPress}
                testID="note-detail-edit"
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: actionButtonBackground,
                        borderColor: actionButtonBorder,
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
                            color={colors.success}
                        />
                    </Animated.View>
                </View>
            </AnimatedActionButton>

            <AnimatedActionButton
                onPress={onShare}
                testID="note-detail-share"
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: actionButtonBackground,
                        borderColor: actionButtonBorder,
                    },
                ]}
                delay={140}
                disabled={isDeleting}
            >
                <Ionicons name="share-outline" size={20} color={colors.secondaryText} />
            </AnimatedActionButton>

            <AnimatedActionButton
                onPress={onDelete}
                testID="note-detail-delete"
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: actionButtonBackground,
                        borderColor: actionButtonBorder,
                    },
                ]}
                delay={180}
                disabled={isDeleting}
            >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </AnimatedActionButton>
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
