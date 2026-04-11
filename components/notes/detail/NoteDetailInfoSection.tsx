import { Ionicons } from '@expo/vector-icons';
import { type TFunction } from 'i18next';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Note } from '../../../services/database';
import { NOTE_RADIUS_OPTIONS, formatRadiusLabel } from '../../../constants/noteRadius';
import { Typography } from '../../../constants/theme';
import NoteColorPicker from '../../ui/NoteColorPicker';

type NoteDetailInfoSectionProps = {
    colors: {
        border: string;
        primary: string;
        secondaryText: string;
        text: string;
    };
    dateStr: string;
    editLocation: string;
    editNoteColor: string | null;
    editRadius: number;
    inputComponent: any;
    isDark: boolean;
    isEditing: boolean;
    locationInputRef: any;
    locationSelection?: { start: number; end: number };
    lockedPremiumNoteColorIds: string[];
    note: Note;
    onChangeLocationText: (value: string) => void;
    onFocusLocation: () => void;
    onLockedColorPress: () => void;
    onLocationSelectionChange: (event: any) => void;
    onSelectColor: (nextColor: string | null) => void;
    onSelectRadius: (nextRadius: number) => void;
    previewOnlyNoteColorIds: string[];
    t: TFunction;
};

export default function NoteDetailInfoSection({
    colors,
    dateStr,
    editLocation,
    editNoteColor,
    editRadius,
    inputComponent: InputComponent,
    isDark,
    isEditing,
    locationInputRef,
    locationSelection,
    lockedPremiumNoteColorIds,
    note,
    onChangeLocationText,
    onFocusLocation,
    onLockedColorPress,
    onLocationSelectionChange,
    onSelectColor,
    onSelectRadius,
    previewOnlyNoteColorIds,
    t,
}: NoteDetailInfoSectionProps) {
    return (
        <View style={styles.infoSection}>
            {isEditing ? (
                <>
                    <View style={styles.editMetaSection}>
                        <Text style={[styles.editFieldLabel, { color: colors.secondaryText }]}>
                            {t('noteDetail.locationField', 'Place')}
                        </Text>
                        <View
                            style={[
                                styles.infoRow,
                                styles.infoRowEditing,
                                {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.58)',
                                    borderColor: `${colors.primary}66`,
                                },
                            ]}
                        >
                            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                            <InputComponent
                                ref={locationInputRef}
                                testID="note-detail-location-input"
                                style={[styles.editLocationInput, { color: colors.text }]}
                                value={editLocation}
                                onChangeText={onChangeLocationText}
                                onFocus={onFocusLocation}
                                onSelectionChange={onLocationSelectionChange}
                                editable
                                placeholder={t('noteDetail.editLocation', 'Edit location name...')}
                                placeholderTextColor={colors.secondaryText}
                                maxLength={100}
                                selectionColor={colors.primary}
                                selection={locationSelection}
                            />
                            <Ionicons name="create-outline" size={16} color={colors.primary} />
                        </View>
                    </View>

                    {note.type === 'text' ? (
                        <View style={styles.editMetaSection}>
                            <NoteColorPicker
                                label={t('noteDetail.colorField', 'Color')}
                                selectedColor={editNoteColor}
                                onSelectColor={onSelectColor}
                                lockedColorIds={lockedPremiumNoteColorIds}
                                previewOnlyColorIds={previewOnlyNoteColorIds}
                                onLockedColorPress={onLockedColorPress}
                                testIDPrefix="note-detail-color"
                            />
                        </View>
                    ) : null}

                    <View style={styles.editMetaSection}>
                        <Text style={[styles.editFieldLabel, { color: colors.secondaryText }]}>
                            {t('capture.radiusLabel', 'Reminder radius')}
                        </Text>
                        <View style={styles.radiusChipsRow}>
                            {NOTE_RADIUS_OPTIONS.map((option) => {
                                const isSelected = editRadius === option;
                                return (
                                    <Pressable
                                        key={option}
                                        testID={`note-detail-radius-${option}`}
                                        style={[
                                            styles.radiusChip,
                                            {
                                                backgroundColor: isSelected ? `${colors.primary}20` : 'transparent',
                                                borderColor: isSelected ? colors.primary : colors.border,
                                            },
                                        ]}
                                        onPress={() => onSelectRadius(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.radiusChipText,
                                                { color: isSelected ? colors.primary : colors.secondaryText },
                                            ]}
                                        >
                                            {formatRadiusLabel(option)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </>
            ) : (
                <>
                    <View style={styles.infoRow}>
                        <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                        <Text
                            style={[styles.infoText, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {note.locationName || t('noteDetail.unknownLocation', 'Unknown Location')}
                        </Text>
                    </View>

                    <View style={styles.infoRowRadius}>
                        <Ionicons name="radio-outline" size={20} color={colors.secondaryText} />
                        <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                            {t('noteDetail.radiusValue', { value: formatRadiusLabel(note.radius) })}
                        </Text>
                    </View>
                </>
            )}

            <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color={colors.secondaryText} />
                <Text style={[styles.infoText, { color: colors.secondaryText }]}>{dateStr}</Text>
            </View>

            <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={colors.secondaryText} />
                <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                    {note.latitude.toFixed(5)}, {note.longitude.toFixed(5)}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    infoSection: {
        gap: 14,
    },
    editMetaSection: {
        gap: 8,
    },
    editFieldLabel: {
        fontSize: 14,
        fontFamily: Typography.body.fontFamily,
        marginBottom: -2,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoRowEditing: {
        minHeight: 54,
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    infoRowRadius: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    infoText: {
        fontSize: 16,
        lineHeight: 22,
        fontFamily: Typography.body.fontFamily,
        flex: 1,
    },
    editLocationInput: {
        flex: 1,
        fontSize: 16,
        lineHeight: 22,
        fontFamily: Typography.body.fontFamily,
        fontWeight: '700',
        paddingVertical: 0,
        minHeight: 22,
    },
    radiusChipsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        flex: 1,
    },
    radiusChip: {
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    radiusChipText: {
        fontSize: 14,
        lineHeight: 18,
        fontFamily: Typography.button.fontFamily,
    },
});
