import React from 'react';
import { render } from '@testing-library/react-native';
import TextMemoryCard from '../components/notes/TextMemoryCard';

const mockDynamicStickerCanvas = jest.fn((_props?: any) => null);

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/notes/DynamicStickerCanvas', () => {
  const React = require('react');

  return function MockDynamicStickerCanvas(props: any) {
    mockDynamicStickerCanvas(props);
    return null;
  };
});

jest.mock('../components/notes/NoteDoodleCanvas', () => {
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
  const stickerPlacementsJson = JSON.stringify([
    {
      id: 'placement-1',
      assetId: 'asset-1',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      zIndex: 1,
      opacity: 1,
      asset: {
        id: 'asset-1',
        ownerUid: '__local__',
        localUri: 'file:///stickers/sticker-1.png',
        remotePath: null,
        mimeType: 'image/png',
        width: 240,
        height: 180,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: null,
        source: 'import',
      },
    },
  ]);

  beforeEach(() => {
    mockDynamicStickerCanvas.mockClear();
  });

  it('passes the water motion variant through to the sticker canvas for water presets', () => {
    render(
      <TextMemoryCard
        text="Ocean memory"
        noteColor="sky-blue"
        stickerPlacementsJson={stickerPlacementsJson}
      />
    );

    expect(mockDynamicStickerCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        motionVariant: 'water',
      })
    );
  });

  it('renders warm presets without a separate water overlay', () => {
    const { queryByTestId } = render(
      <TextMemoryCard text="Sunset memory" noteColor="sunset-coral" />
    );

    expect(queryByTestId('text-memory-card-water-overlay')).toBeNull();
  });
});
