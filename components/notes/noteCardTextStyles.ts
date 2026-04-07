import { StyleSheet } from 'react-native';
import { Typography } from '../../constants/theme';

export function getNoteCardTextSizeStyle(text: string) {
  if (text.length > 200) {
    return noteCardTextStyles.memoryTextSmall;
  }

  if (text.length > 100) {
    return noteCardTextStyles.memoryTextMedium;
  }

  return null;
}

export const noteCardTextStyles = StyleSheet.create({
  memoryText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
    textAlign: 'center',
    fontFamily: Typography.body.fontFamily,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 1,
  },
  memoryTextMedium: {
    fontSize: 18,
    lineHeight: 26,
  },
  memoryTextSmall: {
    fontSize: 16,
    lineHeight: 22,
  },
});
