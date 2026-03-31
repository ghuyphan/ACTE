import React from 'react';
import { render } from '@testing-library/react-native';
import TextMemoryCard from '../components/TextMemoryCard';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/DynamicStickerCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockDynamicStickerCanvas() {
    return <View testID="mock-dynamic-sticker-canvas" />;
  };
});

jest.mock('../components/NoteDoodleCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockNoteDoodleCanvas() {
    return <View testID="mock-note-doodle-canvas" />;
  };
});

jest.mock('../components/ui/PremiumNoteFinishOverlay', () => {
  const React = require('react');
  return function MockPremiumNoteFinishOverlay() {
    return null;
  };
});

describe('TextMemoryCard', () => {
  it('renders the water overlay for explicit water color presets', () => {
    const { getByTestId } = render(
      <TextMemoryCard text="Ocean memory" noteColor="sky-blue" />
    );

    expect(getByTestId('text-memory-card-water-overlay')).toBeTruthy();
    expect(getByTestId('text-memory-card-water-line')).toBeTruthy();
  });

  it('does not render the water overlay for standard warm presets', () => {
    const { queryByTestId } = render(
      <TextMemoryCard text="Sunset memory" noteColor="sunset-coral" />
    );

    expect(queryByTestId('text-memory-card-water-overlay')).toBeNull();
    expect(queryByTestId('text-memory-card-water-line')).toBeNull();
  });
});
