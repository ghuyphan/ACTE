import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function AppBottomSheet({
  children,
  contentContainerStyle,
  detached = false,
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
      android_keyboardInputMode="adjustResize"
      backgroundStyle={[
        detached ? styles.detachedBackground : styles.edgeBackground,
        {
          backgroundColor: detached ? colors.surface : colors.background,
        },
      ]}
      handleStyle={styles.handleContainer}
      handleIndicatorStyle={[styles.handle, { backgroundColor: `${colors.secondaryText}73` }]}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.38}
          pressBehavior={dismissible ? 'close' : 'none'}
        />
      )}
      onDismiss={onClose}
      style={detached ? styles.detached : styles.edge}
    >
      <BottomSheetView style={contentContainerStyle}>{children}</BottomSheetView>
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
    borderWidth: 0,
  },
  detachedBackground: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
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
