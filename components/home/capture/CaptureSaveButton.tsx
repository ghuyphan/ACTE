import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import Reanimated from 'react-native-reanimated';
import type { CaptureCardAnimatedStyle, CaptureCardColors } from './captureShared';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { styles } from './captureCardStyles';

interface CaptureSaveButtonProps {
  animatedSaveHaloStyle: CaptureCardAnimatedStyle;
  animatedSaveIconStyle: CaptureCardAnimatedStyle;
  animatedSaveInnerStyle: CaptureCardAnimatedStyle;
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
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
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
      onPress={onSaveNote}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isSaveDisabled}
      pressedScale={0.985}
      disabledOpacity={isSaveDisabled ? 0.72 : 1}
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
          {isSaveBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Reanimated.View style={animatedSaveIconStyle}>
              <Ionicons
                name="paper-plane"
                size={22}
                color="#FFFFFF"
              />
            </Reanimated.View>
          )}
        </Reanimated.View>
      </Reanimated.View>
    </CaptureAnimatedPressable>
  );
}
