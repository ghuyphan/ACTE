import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

export default function AppBottomSheet({
  children,
  contentContainerStyle,
  detached = true,
  dismissible = true,
  onClose,
  topInset = 0,
  visible,
}: {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  detached?: boolean;
  dismissible?: boolean;
  onClose: () => void;
  topInset?: number;
  visible: boolean;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (visible) {
      modalRef.current?.present();
      return;
    }

    modalRef.current?.dismiss();
  }, [visible]);

  if (Platform.OS !== 'android') {
    return null;
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      detached={detached}
      bottomInset={insets.bottom + 12}
      topInset={topInset}
      enableDynamicSizing
      enablePanDownToClose={dismissible}
      android_keyboardInputMode="adjustResize"
      backgroundStyle={[
        styles.background,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: `${colors.secondaryText}66` }]}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.32}
          pressBehavior={dismissible ? 'close' : 'none'}
        />
      )}
      onDismiss={onClose}
      style={detached ? styles.detached : undefined}
    >
      <BottomSheetView style={contentContainerStyle}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    borderRadius: 28,
    borderWidth: 1,
  },
  detached: {
    marginHorizontal: 12,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
});
