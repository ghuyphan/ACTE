import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockImpactAsync = jest.fn();
const mockPlayers: Array<{
  loop: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
}> = [];

jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    VideoView: ({ children, ...props }: any) => React.createElement(View, props, children),
    useVideoPlayer: (_source: unknown, setup?: (player: any) => void) => {
      const playerRef = React.useRef(null as any);

      if (!playerRef.current) {
        playerRef.current = {
          loop: false,
          muted: false,
          volume: 1,
          currentTime: 0,
          play: jest.fn(),
          pause: jest.fn(),
        };

        setup?.(playerRef.current);
        mockPlayers.push(playerRef.current);
      }

      return playerRef.current;
    },
  };
}, { virtual: true });

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

import PhotoMediaView from '../components/notes/PhotoMediaView';

describe('PhotoMediaView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayers.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not pause the video again when the preview unmounts', () => {
    const { getByLabelText, unmount } = render(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
      />
    );

    const previewSurface = getByLabelText('Preview live photo motion');
    const player = mockPlayers[0];

    fireEvent(previewSurface, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(170);
    });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('light');

    fireEvent(previewSurface, 'pressOut');
    expect(player.pause).toHaveBeenCalledTimes(1);

    unmount();

    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});
