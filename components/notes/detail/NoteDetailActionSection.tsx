import { Ionicons } from '@expo/vector-icons';
import { type TFunction } from 'i18next';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Typography } from '../../../constants/theme';
import { AnimatedActionButton } from './NoteDetailPrimitives';

type NoteDetailActionSectionProps = {
    colors: {
        danger: string;
        primary: string;
        secondaryText: string;
        success: string;
    };
    editingHintAnimatedStyle: any;
    editIconAnimatedStyle: any;
    isDark: boolean;
    isDeleting: boolean;
    isEditing: boolean;
    onDelete: () => void;
    onPrimaryPress: () => void;
    onShare: () => void;
    saveIconAnimatedStyle: any;
    t: TFunction;
};

export default function NoteDetailActionSection({
    colors,
    editingHintAnimatedStyle,
    editIconAnimatedStyle,
    isDark,
    isDeleting,
    isEditing,
    onDelete,
    onPrimaryPress,
    onShare,
    saveIconAnimatedStyle,
    t,
}: NoteDetailActionSectionProps) {
    const actionButtonBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const hintBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const hintBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';

    return (
        <>
            <Animated.View style={styles.actionRow}>
                <AnimatedActionButton
                    onPress={onPrimaryPress}
                    testID="note-detail-edit"
                    style={[styles.actionBtn, { backgroundColor: actionButtonBackground }]}
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
                    style={[styles.actionBtn, { backgroundColor: actionButtonBackground }]}
                    delay={140}
                    disabled={isDeleting}
                >
                    <Ionicons name="share-outline" size={20} color={colors.secondaryText} />
                </AnimatedActionButton>

                <AnimatedActionButton
                    onPress={onDelete}
                    testID="note-detail-delete"
                    style={[styles.actionBtn, { backgroundColor: actionButtonBackground }]}
                    delay={180}
                    disabled={isDeleting}
                >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </AnimatedActionButton>
            </Animated.View>

            {isEditing ? (
                <Animated.View style={editingHintAnimatedStyle}>
                    <View
                        style={[
                            styles.editingHintCard,
                            {
                                backgroundColor: hintBackground,
                                borderColor: hintBorder,
                            },
                        ]}
                    >
                        <Ionicons name="create-outline" size={16} color={colors.primary} />
                        <Text style={[styles.editingHintText, { color: colors.secondaryText }]}>
                            {t('noteDetail.editingHint', 'Editing mode: update note, doodle, and place')}
                        </Text>
                    </View>
                </Animated.View>
            ) : null}
        </>
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
    editingHintCard: {
        marginTop: 8,
        marginBottom: 20,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    editingHintText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 18,
        fontFamily: Typography.body.fontFamily,
    },
});
