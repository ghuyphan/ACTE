import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import {
  NOTE_COLOR_PRESETS,
  getAppThemeCaptureNoteColorId,
  getPickerNoteColorId,
  getNoteColorCardGradient,
  resolveConcreteThemeNoteColorId,
  isPremiumNoteColor,
} from '../../services/noteAppearance';
import PremiumNoteFinishOverlay from './PremiumNoteFinishOverlay';

interface NoteColorPickerProps {
  label?: string;
  selectedColor: string | null | undefined;
  onSelectColor: (nextColor: string | null) => void;
  testIDPrefix?: string;
  compact?: boolean;
  lockedColorIds?: string[];
  previewOnlyColorIds?: string[];
  onLockedColorPress?: (colorId: string) => void;
}

export default function NoteColorPicker({
  label,
  selectedColor,
  onSelectColor,
  testIDPrefix,
  compact = false,
  lockedColorIds = [],
  previewOnlyColorIds = [],
  onLockedColorPress,
}: NoteColorPickerProps) {
  const { t } = useTranslation();
  const { appTheme, colors, isDark } = useTheme();
  const lockedColorSet = new Set(lockedColorIds);
  const previewOnlyColorSet = new Set(previewOnlyColorIds);
  const visualSelectedColor =
    selectedColor != null
      ? getPickerNoteColorId(selectedColor)
      : getAppThemeCaptureNoteColorId(appTheme);

  return (
    <View style={[styles.section, compact ? styles.sectionCompact : null]}>
      {label ? (
        <Text style={[styles.label, { color: colors.secondaryText }]}>{label}</Text>
      ) : null}
      <View style={styles.swatchGrid}>
        {NOTE_COLOR_PRESETS.map((preset, index) => {
          const gradient = getNoteColorCardGradient(preset.id, {
            colorScheme: isDark ? 'dark' : 'light',
          }) ?? preset.card;
          const selected = preset.id === visualSelectedColor;
          const previewOnly = previewOnlyColorSet.has(preset.id);
          const locked = lockedColorSet.has(preset.id) && !selected && !previewOnly;
          const premium = isPremiumNoteColor(preset.id);

          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t('capture.noteColorOptionA11y', {
                defaultValue: '{{label}} {{index}}{{premium}}',
                index: index + 1,
                label: label ?? t('capture.noteColor', 'Card color'),
                premium: premium ? `, ${t('plus.badge', 'Plus')}` : '',
              })}
              onPress={() => {
                if (locked) {
                  onLockedColorPress?.(preset.id);
                  return;
                }

                onSelectColor(
                  resolveConcreteThemeNoteColorId(
                    preset.id,
                    isDark ? 'dark' : 'light'
                  ) ?? preset.id
                );
              }}
              style={[
                styles.swatchButton,
                {
                  borderColor: selected
                    ? colors.primary
                    : locked || previewOnly
                      ? colors.primary + '66'
                      : colors.border,
                  transform: [{ scale: selected ? 1.06 : 1 }],
                  opacity: locked ? 0.84 : 1,
                },
              ]}
              testID={testIDPrefix ? `${testIDPrefix}-${preset.id}` : undefined}
            >
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.swatchFill}
              >
                {premium ? <PremiumNoteFinishOverlay noteColor={preset.id} /> : null}
              </LinearGradient>
              {premium ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.premiumBadge,
                    {
                      backgroundColor: locked
                        ? 'rgba(28,28,30,0.72)'
                        : previewOnly
                          ? 'rgba(28,28,30,0.82)'
                          : 'rgba(255,255,255,0.84)',
                    },
                  ]}
                >
                  <Ionicons
                    name={locked ? 'lock-closed' : previewOnly ? 'eye-outline' : 'sparkles'}
                    size={10}
                    color={locked || previewOnly ? '#FFFFFF' : colors.primary}
                  />
                </View>
              ) : null}
              {selected ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.selectedDot,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.98)',
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionCompact: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swatchFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 15,
  },
  selectedDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  premiumBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
