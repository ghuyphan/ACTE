import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import Reanimated from 'react-native-reanimated';
import type { CaptureCardAnimatedStyle, CaptureCardColors } from './captureShared';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { styles } from './captureCardStyles';

interface CaptureSaveButtonProps {
  accessibilityHint?: string;
  accessibilityLabel: string;
  animatedSaveHaloStyle: CaptureCardAnimatedStyle;
  animatedSaveIconStyle: CaptureCardAnimatedStyle;
  animatedSaveInnerStyle: CaptureCardAnimatedStyle;
  animatedSaveSpinnerStyle: CaptureCardAnimatedStyle;
  animatedSaveSuccessStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  isSaveBusy: boolean;
  isSaveDisabled: boolean;
  isSaveSuccessful: boolean;
  onSaveNote: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  savePressAnimatedStyle: CaptureCardAnimatedStyle;
}

export function CaptureSaveButton({
  accessibilityHint,
  accessibilityLabel,
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
  animatedSaveSpinnerStyle,
  animatedSaveSuccessStyle,
  colors,
  isSaveBusy,
  isSaveDisabled,
  isSaveSuccessful,
  onSaveNote,
  onPressIn,
  onPressOut,
  savePressAnimatedStyle,
}: CaptureSaveButtonProps) {
  return (
    <CaptureAnimatedPressable
      testID="capture-save-button"
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        busy: isSaveBusy,
        disabled: isSaveDisabled,
        selected: isSaveSuccessful,
      }}
      onPress={onSaveNote}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isSaveDisabled}
      pressedScale={0.985}
      disabledOpacity={isSaveBusy || isSaveSuccessful ? 1 : 0.72}
      style={[
        styles.shutterOuter,
        {
          borderColor: colors.border,
        },
      ]}
    >
      <Reanimated.View style={savePressAnimatedStyle}>
        <Reanimated.View
          style={[
            styles.shutterInner,
            styles.saveInner,
            { backgroundColor: colors.primary },
            animatedSaveInnerStyle,
          ]}
        >
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.saveHalo,
              {
                backgroundColor: colors.primary,
              },
              animatedSaveHaloStyle,
            ]}
          />
          <Reanimated.View
            testID="capture-save-button-icon"
            pointerEvents="none"
            style={[styles.captureToggleIconLayer, animatedSaveIconStyle]}
          >
            <Ionicons
              name="paper-plane"
              size={22}
              color="#FFFFFF"
            />
          </Reanimated.View>
          <Reanimated.View
            testID="capture-save-button-spinner"
            pointerEvents="none"
            style={[styles.captureToggleIconLayer, animatedSaveSpinnerStyle]}
          >
            <ActivityIndicator
              testID="capture-save-button-spinner-indicator"
              size="small"
              color="#FFFFFF"
              animating={isSaveBusy}
            />
          </Reanimated.View>
          <Reanimated.View
            testID="capture-save-button-success-icon"
            pointerEvents="none"
            style={[styles.captureToggleIconLayer, animatedSaveSuccessStyle]}
          >
            <Ionicons
              name="checkmark"
              size={27}
              color="#FFFFFF"
            />
          </Reanimated.View>
        </Reanimated.View>
      </Reanimated.View>
    </CaptureAnimatedPressable>
  );
}
