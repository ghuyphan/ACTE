import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import PhotoMediaView from '../components/notes/PhotoMediaView';

const mockImpactAsync = jest.fn();
const mockUseReducedMotion = jest.fn(() => false);
const mockPlayers: {
  loop: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  addListener: jest.Mock;
  __emit: (eventName: 'playToEnd') => void;
}[] = [];

jest.mock('expo-video', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  return {
    VideoView: ({ children, ...props }: any) => React.createElement(View, props, children),
    useVideoPlayer: (_source: unknown, setup?: (player: any) => void) => {
      const playerRef = React.useRef(null as any);

      if (!playerRef.current) {
        const listeners = new Map<string, Set<() => void>>();
        playerRef.current = {
          loop: false,
          muted: false,
          volume: 1,
          currentTime: 0,
          play: jest.fn(),
          pause: jest.fn(),
          addListener: jest.fn((eventName: string, listener: () => void) => {
            const eventListeners = listeners.get(eventName) ?? new Set<() => void>();
            eventListeners.add(listener);
            listeners.set(eventName, eventListeners);
            return {
              remove: () => {
                eventListeners.delete(listener);
              },
            };
          }),
          __emit: (eventName: string) => {
            listeners.get(eventName)?.forEach((listener) => listener());
          },
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

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe('PhotoMediaView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayers.length = 0;
    mockUseReducedMotion.mockReturnValue(false);
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

  it('ignores preview gestures when playback is disabled', () => {
    const { getByLabelText } = render(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
        enablePlayback={false}
      />
    );

    const previewSurface = getByLabelText('Preview live photo motion');
    const player = mockPlayers[0];

    fireEvent(previewSurface, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(player.play).not.toHaveBeenCalled();
  });

  it('auto previews once for an active card and resets when playback ends', () => {
    const { rerender } = render(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
        enablePlayback={false}
        autoPreviewOnceOnEnable={false}
      />
    );

    const player = mockPlayers[0];

    rerender(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
        enablePlayback
        autoPreviewOnceOnEnable
      />
    );

    act(() => {
      jest.advanceTimersByTime(419);
    });
    expect(player.play).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).not.toHaveBeenCalled();

    act(() => {
      player.__emit('playToEnd');
    });
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.currentTime).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(player.play).toHaveBeenCalledTimes(1);

    rerender(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
        enablePlayback={false}
        autoPreviewOnceOnEnable={false}
      />
    );

    rerender(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
        enablePlayback
        autoPreviewOnceOnEnable
      />
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('skips auto preview when reduced motion is enabled', () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <PhotoMediaView
        imageUrl="file:///captured-photo.jpg"
        isLivePhoto
        pairedVideoUri="file:///captured-photo.mov"
        autoPreviewOnceOnEnable
      />
    );

    const player = mockPlayers[0];

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(player.play).not.toHaveBeenCalled();
  });

  it('recovers when a prior preview missed press-out cleanup', () => {
    const { getByLabelText } = render(
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

    fireEvent(previewSurface, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(170);
    });

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(2);
  });
});
