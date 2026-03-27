import { Pressable, StyleSheet, Text, View } from 'react-native';

type AnchorPoint = {
  x: number;
  y: number;
};

interface StickerPastePopoverProps {
  visible: boolean;
  anchor: AnchorPoint;
  containerWidth: number;
  containerHeight: number;
  label: string;
  description?: string;
  backgroundColor: string;
  borderColor: string;
  secondaryTextColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  onPress: () => void;
  onDismiss: () => void;
  popoverTestID?: string;
  actionTestID?: string;
  dismissTestID?: string;
}

const POPOVER_WIDTH = 220;
const HORIZONTAL_PADDING = 14;
const TOP_PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function StickerPastePopover({
  visible,
  anchor,
  containerWidth,
  containerHeight,
  label,
  description,
  backgroundColor,
  borderColor,
  secondaryTextColor,
  buttonBackgroundColor,
  buttonTextColor,
  onPress,
  onDismiss,
  popoverTestID,
  actionTestID,
  dismissTestID,
}: StickerPastePopoverProps) {
  if (!visible) {
    return null;
  }

  const estimatedHeight = description ? 116 : 88;
  const left = clamp(anchor.x - POPOVER_WIDTH / 2, 16, containerWidth - POPOVER_WIDTH - 16);
  const top = clamp(anchor.y - estimatedHeight - 18, 16, containerHeight - estimatedHeight - 16);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable testID={dismissTestID} style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <View
        testID={popoverTestID}
        style={[
          styles.popover,
          {
            top,
            left,
            backgroundColor,
            borderColor,
          },
        ]}
      >
        {description ? <Text style={[styles.description, { color: secondaryTextColor }]}>{description}</Text> : null}
        <Pressable
          testID={actionTestID}
          onPress={onPress}
          style={[styles.actionButton, { backgroundColor: buttonBackgroundColor }]}
        >
          <Text style={[styles.actionLabel, { color: buttonTextColor }]}>{label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: TOP_PADDING,
    paddingBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
