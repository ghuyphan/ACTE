import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { NOTE_COLOR_PRESETS, getNoteColorCardGradient } from '../../services/noteAppearance';

interface NoteColorPickerProps {
  label?: string;
  selectedColor: string | null | undefined;
  onSelectColor: (nextColor: string | null) => void;
  autoLabel?: string;
  includeAutoOption?: boolean;
  testIDPrefix?: string;
  compact?: boolean;
}

export default function NoteColorPicker({
  label,
  selectedColor,
  onSelectColor,
  autoLabel = 'Auto',
  includeAutoOption = false,
  testIDPrefix,
  compact = false,
}: NoteColorPickerProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.section, compact ? styles.sectionCompact : null]}>
      {label ? (
        <Text style={[styles.label, { color: colors.secondaryText }]}>{label}</Text>
      ) : null}
      <View style={styles.swatchGrid}>
        {includeAutoOption ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedColor == null }}
            accessibilityLabel={autoLabel}
            onPress={() => onSelectColor(null)}
            style={[
              styles.autoButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor:
                  selectedColor == null ? colors.primary : colors.border,
              },
            ]}
            testID={testIDPrefix ? `${testIDPrefix}-auto` : undefined}
          >
            <Text
              style={[
                styles.autoButtonText,
                { color: selectedColor == null ? colors.primary : colors.text },
              ]}
            >
              {autoLabel}
            </Text>
          </Pressable>
        ) : null}

        {NOTE_COLOR_PRESETS.map((preset, index) => {
          const gradient = getNoteColorCardGradient(preset.id) ?? preset.card;
          const selected = preset.id === selectedColor;

          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label ?? autoLabel} ${index + 1}`}
              onPress={() => onSelectColor(preset.id)}
              style={[
                styles.swatchButton,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  transform: [{ scale: selected ? 1.06 : 1 }],
                },
              ]}
              testID={testIDPrefix ? `${testIDPrefix}-${preset.id}` : undefined}
            >
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.swatchFill}
              />
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
  autoButton: {
    minWidth: 54,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
  },
  selectedDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
