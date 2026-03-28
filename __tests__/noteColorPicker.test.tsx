import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NoteColorPicker from '../components/ui/NoteColorPicker';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      text: '#1C1C1E',
      primary: '#FFC107',
      border: '#E5E5EA',
      secondaryText: '#8E8E93',
    },
  }),
}));

describe('NoteColorPicker', () => {
  it('routes locked premium swatches to the lock handler instead of selecting them', () => {
    const onSelectColor = jest.fn();
    const onLockedColorPress = jest.fn();
    const { getByTestId } = render(
      <NoteColorPicker
        selectedColor="marigold-glow"
        onSelectColor={onSelectColor}
        lockedColorIds={['holo-foil']}
        onLockedColorPress={onLockedColorPress}
        testIDPrefix="picker"
      />
    );

    fireEvent.press(getByTestId('picker-holo-foil'));

    expect(onLockedColorPress).toHaveBeenCalledWith('holo-foil');
    expect(onSelectColor).not.toHaveBeenCalled();
  });

  it('still allows preview-only hologram swatches to be selected even when they are otherwise locked', () => {
    const onSelectColor = jest.fn();
    const onLockedColorPress = jest.fn();
    const { getByTestId } = render(
      <NoteColorPicker
        selectedColor="marigold-glow"
        onSelectColor={onSelectColor}
        lockedColorIds={['holo-foil']}
        previewOnlyColorIds={['holo-foil']}
        onLockedColorPress={onLockedColorPress}
        testIDPrefix="picker"
      />
    );

    fireEvent.press(getByTestId('picker-holo-foil'));

    expect(onSelectColor).toHaveBeenCalledWith('holo-foil');
    expect(onLockedColorPress).not.toHaveBeenCalled();
  });
});
