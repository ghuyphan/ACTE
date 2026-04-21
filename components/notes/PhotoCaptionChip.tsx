import { BlurView } from 'expo-blur';
import React, { type RefObject } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Typography } from '../../constants/theme';
import { glassTokens } from '../ui/glassTokens';

type PhotoCaptionChipProps = {
  caption: string;
  color: string;
  isDark: boolean;
  blurTargetRef?: RefObject<View | null>;
  numberOfLines?: number;
  overlayStyle?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export default function PhotoCaptionChip({
  caption,
  color,
  isDark,
  blurTargetRef,
  numberOfLines = 1,
  overlayStyle,
  fieldStyle,
  textStyle,
  testID,
}: PhotoCaptionChipProps) {
  const normalizedCaption = caption.trim();

  if (!normalizedCaption) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
      <View
        style={[
          styles.field,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.42)',
          },
          fieldStyle,
        ]}
      >
        <BlurView
          pointerEvents="none"
          intensity={36}
          tint={isDark ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={3}
          blurTarget={blurTargetRef}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? 'rgba(22,22,24,0.42)' : 'rgba(255,255,255,0.36)',
            },
          ]}
        />
        <Text
          testID={testID}
          style={[styles.text, { color }, textStyle]}
          numberOfLines={numberOfLines}
        >
          {normalizedCaption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    alignItems: 'center',
  },
  field: {
    maxWidth: '72%',
    minHeight: glassTokens.compactControlHeight,
    borderRadius: glassTokens.compactControlRadius,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  text: {
    flexShrink: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: Typography.body.fontFamily,
  },
});
