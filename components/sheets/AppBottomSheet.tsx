import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function AppBottomSheet({
  children,
  contentContainerStyle,
  detached = false,
  dismissible = true,
  onClose,
  topInset = 0,
  visible,
  wrapContentInView = true,
}: {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  detached?: boolean;
  dismissible?: boolean;
  onClose: () => void;
  topInset?: number;
  visible: boolean;
  wrapContentInView?: boolean;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const { colors, isDark } = useTheme();
  const backgroundColor = detached ? colors.surface : colors.card;
  const backdropOpacity = isDark ? 0.52 : 0.38;

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

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible || !dismissible) {
      return;
    }

    const backAction = () => {
      onClose();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [visible, dismissible, onClose]);

  if (Platform.OS !== 'android') {
    return null;
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      detached={detached}
      bottomInset={detached ? 16 : 0}
      topInset={topInset}
      enableDynamicSizing
      enableOverDrag={false}
      enablePanDownToClose={dismissible}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
      backgroundStyle={[
        detached ? styles.detachedBackground : styles.edgeBackground,
        isDark ? styles.darkBackground : styles.lightBackground,
        {
          backgroundColor,
          borderColor: colors.border,
        },
      ]}
      handleStyle={styles.handleContainer}
      handleIndicatorStyle={[styles.handle, { backgroundColor: `${colors.secondaryText}73` }]}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={backdropOpacity}
          pressBehavior={dismissible ? 'close' : 'none'}
        />
      )}
      onDismiss={onClose}
      style={detached ? styles.detached : styles.edge}
    >
      {wrapContentInView ? (
        <BottomSheetView style={contentContainerStyle}>{children}</BottomSheetView>
      ) : (
        children
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  edge: {
    marginHorizontal: 0,
  },
  detached: {
    marginHorizontal: 0,
  },
  edgeBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detachedBackground: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  lightBackground: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 12,
  },
  darkBackground: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 24,
  },
  handleContainer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 999,
  },
});
