import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import AppBottomSheet from '../components/sheets/AppBottomSheet';

let latestBottomSheetModalProps: Record<string, unknown> | null = null;
let mockBottomSheetModalMethods: { dismiss: jest.Mock; present: jest.Mock } | null = null;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  const BottomSheetModal = React.forwardRef(function MockBottomSheetModal(props: any, ref: any) {
    latestBottomSheetModalProps = props;
    mockBottomSheetModalMethods = {
      dismiss: jest.fn(),
      present: jest.fn(),
    };
    React.useImperativeHandle(ref, () => ({
      dismiss: mockBottomSheetModalMethods?.dismiss,
      present: mockBottomSheetModalMethods?.present,
    }));
    return <View>{props.children}</View>;
  });

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal,
    BottomSheetView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#E5E5EA',
      card: '#FFFFFF',
      secondaryText: '#8E8E93',
      surface: '#FFFFFF',
    },
    isDark: false,
  }),
}));

describe('AppBottomSheet', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    latestBottomSheetModalProps = null;
    mockBottomSheetModalMethods = null;
    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
  });

  it('omits an out-of-range initial index when there is only one snap point', () => {
    render(
      <AppBottomSheet
        visible={false}
        onClose={jest.fn()}
        androidInitialIndex={1}
        androidDynamicSizing={false}
        androidSnapPoints={[420]}
      >
        <View />
      </AppBottomSheet>
    );

    expect(latestBottomSheetModalProps).not.toBeNull();
    expect(latestBottomSheetModalProps?.index).toBeUndefined();
    expect(latestBottomSheetModalProps?.snapPoints).toEqual([420]);
    expect(latestBottomSheetModalProps?.stackBehavior).toBe('push');
  });

  it('omits a positive initial index when snap points are dynamic', () => {
    render(
      <AppBottomSheet
        visible={false}
        onClose={jest.fn()}
        androidInitialIndex={1}
      >
        <View />
      </AppBottomSheet>
    );

    expect(latestBottomSheetModalProps).not.toBeNull();
    expect(latestBottomSheetModalProps?.index).toBeUndefined();
    expect(latestBottomSheetModalProps?.snapPoints).toBeUndefined();
  });

  it('preserves a valid non-zero initial index when multiple snap points exist', () => {
    render(
      <AppBottomSheet
        visible={false}
        onClose={jest.fn()}
        androidInitialIndex={1}
        androidDynamicSizing={false}
        androidSnapPoints={[320, 520]}
      >
        <View />
      </AppBottomSheet>
    );

    expect(latestBottomSheetModalProps?.index).toBe(1);
    expect(latestBottomSheetModalProps?.snapPoints).toEqual([320, 520]);
  });

  it('dismisses programmatically when visibility turns off without firing onClose again', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <AppBottomSheet visible onClose={onClose}>
        <View />
      </AppBottomSheet>
    );

    expect(mockBottomSheetModalMethods?.present).toHaveBeenCalledTimes(1);

    rerender(
      <AppBottomSheet visible={false} onClose={onClose}>
        <View />
      </AppBottomSheet>
    );

    expect(mockBottomSheetModalMethods?.dismiss).toHaveBeenCalledTimes(1);
    (latestBottomSheetModalProps?.onDismiss as (() => void) | undefined)?.();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('re-presents itself after dismiss callbacks while non-dismissible and still visible', () => {
    const onClose = jest.fn();
    render(
      <AppBottomSheet visible dismissible={false} onClose={onClose}>
        <View />
      </AppBottomSheet>
    );

    (latestBottomSheetModalProps?.onDismiss as (() => void) | undefined)?.();

    expect(onClose).not.toHaveBeenCalled();
    expect(mockBottomSheetModalMethods?.present).toHaveBeenCalledTimes(2);
  });
});
