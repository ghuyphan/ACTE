import type { ReactNode } from 'react';
import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import {
  environment,
  interactiveDismissDisabled,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Sheet } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import AppBottomSheet from './AppBottomSheet';

export type AppSheetAndroidPresentation = 'edge' | 'floating';
type IOSContentType = 'react-native' | 'swift-ui';

export interface AppSheetProps {
  androidDynamicSizing?: boolean;
  androidInitialIndex?: number;
  androidKeyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  androidKeyboardInputMode?: 'adjustPan' | 'adjustResize';
  androidMaxDynamicContentSize?: number;
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
  dismissible?: boolean;
  androidPresentation?: AppSheetAndroidPresentation;
  androidScrollable?: boolean;
  androidSnapPoints?: (number | string)[];
  fitToContents?: boolean;
  iosColorScheme?: 'light' | 'dark';
  iosContentType?: IOSContentType;
  iosContainerStyle?: StyleProp<ViewStyle>;
  iosGroupModifiers?: any[];
  topInset?: number;
}

export default function AppSheet({
  androidDynamicSizing = true,
  androidInitialIndex = 0,
  androidKeyboardBehavior = 'interactive',
  androidKeyboardInputMode = 'adjustResize',
  androidMaxDynamicContentSize,
  children,
  visible,
  onClose,
  dismissible = true,
  androidPresentation = 'edge',
  androidScrollable = false,
  androidSnapPoints,
  fitToContents = true,
  iosColorScheme,
  iosContentType = 'react-native',
  iosContainerStyle,
  iosGroupModifiers,
  topInset = 0,
}: AppSheetProps) {
  const { isDark } = useTheme();
  const resolvedIOSColorScheme = iosColorScheme ?? (isDark ? 'dark' : 'light');

  if (Platform.OS === 'android') {
    return (
      <AppBottomSheet
        androidDynamicSizing={androidDynamicSizing}
        androidInitialIndex={androidInitialIndex}
        androidKeyboardBehavior={androidKeyboardBehavior}
        androidKeyboardInputMode={androidKeyboardInputMode}
        androidMaxDynamicContentSize={androidMaxDynamicContentSize}
        androidSnapPoints={androidSnapPoints}
        visible={visible}
        onClose={onClose}
        dismissible={dismissible}
        detached={androidPresentation === 'floating'}
        topInset={topInset}
        wrapContentInView={!androidScrollable}
      >
        {children}
      </AppBottomSheet>
    );
  }

  const surfaceStyle = [
    styles.iosContainer,
    isOlderIOS
      ? {
          borderTopLeftRadius: Sheet.ios.legacyCornerRadius,
          borderTopRightRadius: Sheet.ios.legacyCornerRadius,
        }
      : null,
    iosContainerStyle,
  ];
  const groupModifiers: any[] = [
    ...(iosGroupModifiers ?? [
      presentationDragIndicator('visible'),
      environment('colorScheme', resolvedIOSColorScheme),
    ]),
    interactiveDismissDisabled(!dismissible),
  ];

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Host style={StyleSheet.absoluteFill} colorScheme={resolvedIOSColorScheme}>
        <BottomSheet
          isPresented={visible}
          onIsPresentedChange={(nextVisible) => {
            if (!nextVisible) {
              onClose();
            }
          }}
          fitToContents={fitToContents}
        >
          <Group modifiers={groupModifiers}>
            {iosContentType === 'swift-ui' ? (
              children
            ) : (
              <RNHostView matchContents>
                <View style={surfaceStyle}>{children}</View>
              </RNHostView>
            )}
          </Group>
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  iosContainer: {
    backgroundColor: 'transparent',
  },
});
