import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Typography } from '../../constants/theme';

type PhotoCaptionChipProps = {
  caption: string;
  color: string;
  isDark: boolean;
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
            backgroundColor: isDark ? 'rgba(20,20,20,0.5)' : 'rgba(255,255,255,0.72)',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.42)',
          },
          fieldStyle,
        ]}
      >
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
    minHeight: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    flexShrink: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: Typography.body.fontFamily,
  },
});
