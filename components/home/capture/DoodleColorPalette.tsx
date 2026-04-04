import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';

export interface DoodleColorPaletteProps {
  colors: string[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  buttonBackgroundColor: string;
  buttonBorderColor: string;
  selectedBorderColor: string;
  swatchBorderColor: string;
  testIDPrefix: string;
}

export const DoodleColorPalette = memo(function DoodleColorPalette({
  colors,
  selectedColor,
  onSelectColor,
  buttonBackgroundColor,
  buttonBorderColor,
  selectedBorderColor,
  swatchBorderColor,
  testIDPrefix,
}: DoodleColorPaletteProps) {
  return (
    <View style={styles.doodleColorPalette}>
      <ScrollView
        horizontal
        style={styles.doodleColorPaletteScroll}
        contentContainerStyle={styles.doodleColorPaletteContent}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {colors.map((color, index) => {
          const isSelected = selectedColor === color;

          return (
            <CaptureAnimatedPressable
              key={`${testIDPrefix}-${color}`}
              testID={`${testIDPrefix}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Doodle color ${index + 1}`}
              onPress={() => onSelectColor(color)}
              active={isSelected}
              activeScale={1}
              activeTranslateY={0}
              contentActiveScale={1}
              contentActiveTranslateY={0}
              style={[
                styles.doodleColorButton,
                {
                  backgroundColor: buttonBackgroundColor,
                  borderColor: isSelected ? selectedBorderColor : buttonBorderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.doodleColorSwatch,
                  {
                    backgroundColor: color,
                    borderColor: color.toUpperCase() === '#FFFFFF' ? swatchBorderColor : 'transparent',
                  },
                ]}
              />
            </CaptureAnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  doodleColorPalette: {
    alignSelf: 'stretch',
  },
  doodleColorPaletteScroll: {
    flexGrow: 0,
  },
  doodleColorPaletteContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  doodleColorButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doodleColorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
