import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import AppBottomSheet from '../components/sheets/AppBottomSheet';

let latestBottomSheetModalProps: Record<string, unknown> | null = null;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  const BottomSheetModal = React.forwardRef((props: any, ref: any) => {
    latestBottomSheetModalProps = props;
    React.useImperativeHandle(ref, () => ({
      dismiss: jest.fn(),
      present: jest.fn(),
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
});
