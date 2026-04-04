import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function AppBottomSheet({
  androidDynamicSizing = true,
  androidDisablePanningWhenKeyboardHidden = false,
  androidInitialIndex = 0,
  androidKeyboardBehavior = 'interactive',
  androidRestoreInitialSnapOnKeyboardHide = false,
  androidMaxDynamicContentSize,
  androidSnapPoints,
  children,
  contentContainerStyle,
  detached = false,
  dismissible = true,
  onClose,
  topInset = 0,
  visible,
  wrapContentInView = true,
}: {
  androidDynamicSizing?: boolean;
  androidDisablePanningWhenKeyboardHidden?: boolean;
  androidInitialIndex?: number;
  androidKeyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  androidRestoreInitialSnapOnKeyboardHide?: boolean;
  androidMaxDynamicContentSize?: number;
  androidSnapPoints?: (number | string)[];
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
  const keyboardWasVisibleRef = useRef(false);
  const ignoreNextDismissRef = useRef(false);
  const previousModalConfigKeyRef = useRef<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { colors, isDark } = useTheme();
  const backgroundColor = detached ? colors.surface : colors.card;
  const backdropOpacity = isDark ? 0.52 : 0.38;
  const panningEnabled = !androidDisablePanningWhenKeyboardHidden || keyboardVisible;
  const modalConfigKey = [
    detached ? 'detached' : 'edge',
    wrapContentInView ? 'wrapped' : 'scrollable',
    androidDynamicSizing ? 'dynamic' : 'fixed',
    androidKeyboardBehavior,
    androidInitialIndex,
    androidRestoreInitialSnapOnKeyboardHide ? 'restore' : 'no-restore',
    ...(androidSnapPoints?.map((point) => String(point)) ?? ['no-snap-points']),
  ].join(':');

  if (
    visible &&
    previousModalConfigKeyRef.current !== null &&
    previousModalConfigKeyRef.current !== modalConfigKey
  ) {
    ignoreNextDismissRef.current = true;
  }

  previousModalConfigKeyRef.current = modalConfigKey;

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (visible) {
      requestAnimationFrame(() => {
        modalRef.current?.present();
      });
      return;
    }

    modalRef.current?.dismiss();
  }, [modalConfigKey, visible]);

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

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !visible ||
      (!androidRestoreInitialSnapOnKeyboardHide && !androidDisablePanningWhenKeyboardHidden)
    ) {
      keyboardWasVisibleRef.current = false;
      setKeyboardVisible(false);
      return;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardWasVisibleRef.current = true;
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);

      if (!keyboardWasVisibleRef.current) {
        return;
      }

      keyboardWasVisibleRef.current = false;
      requestAnimationFrame(() => {
        modalRef.current?.snapToIndex(androidInitialIndex);
      });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      keyboardWasVisibleRef.current = false;
      setKeyboardVisible(false);
    };
  }, [
    androidDisablePanningWhenKeyboardHidden,
    androidInitialIndex,
    androidRestoreInitialSnapOnKeyboardHide,
    visible,
  ]);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !visible ||
      !androidDisablePanningWhenKeyboardHidden ||
      keyboardVisible
    ) {
      return;
    }

    requestAnimationFrame(() => {
      modalRef.current?.snapToIndex(androidInitialIndex);
    });
  }, [androidDisablePanningWhenKeyboardHidden, androidInitialIndex, keyboardVisible, visible]);

  if (Platform.OS !== 'android') {
    return null;
  }

  return (
    <BottomSheetModal
      key={modalConfigKey}
      ref={modalRef}
      index={androidInitialIndex}
      detached={detached}
      bottomInset={detached ? 16 : 0}
      topInset={topInset}
      enableDynamicSizing={androidDynamicSizing}
      maxDynamicContentSize={androidMaxDynamicContentSize}
      snapPoints={androidSnapPoints}
      enableContentPanningGesture={panningEnabled}
      enableHandlePanningGesture={panningEnabled}
      enableOverDrag={false}
      enablePanDownToClose={dismissible}
      keyboardBehavior={androidKeyboardBehavior}
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
      onDismiss={() => {
        if (ignoreNextDismissRef.current) {
          ignoreNextDismissRef.current = false;
          return;
        }

        onClose();
      }}
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
