import React from 'react';
import { render } from '@testing-library/react-native';
import PolaroidExportView from '../components/notes/detail/PolaroidExportView';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/notes/NoteStickerCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockNoteStickerCanvas() {
    return <View testID="mock-note-sticker-canvas" />;
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

describe('PolaroidExportView', () => {
  it('keeps sticker and doodle overlays behind text content for text-note exports', () => {
    const note = {
      id: 'note-export-1',
      type: 'text',
      content: 'Layered export text',
      caption: null,
      photoLocalUri: null,
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: 'Cafe',
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.4, 0.4] }]),
      hasStickers: true,
      stickerPlacementsJson: JSON.stringify([
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
      ]),
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: null,
    } as const;

    const view = render(
      <PolaroidExportView
        note={note as any}
        fallbackLocationLabel="Unknown place"
      />
    );

    expect(view.getByTestId('polaroid-export-sticker-overlay').props.style).toEqual(
      expect.objectContaining({ zIndex: 0 })
    );
    expect(view.getByTestId('polaroid-export-doodle-overlay').props.style).toEqual(
      expect.objectContaining({ zIndex: 0 })
    );
    expect(view.getByTestId('polaroid-export-text-content').props.style).toEqual(
      expect.objectContaining({ zIndex: 1 })
    );
    expect(view.getByTestId('mock-note-sticker-canvas')).toBeTruthy();
  });
});
