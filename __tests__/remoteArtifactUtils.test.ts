import {
  buildNewRemoteArtifacts,
  buildRemovedRemoteArtifacts,
  getRemotePairedVideoPath,
  normalizeRemoteEntityIds,
} from '../services/remoteArtifactUtils';

function createPlacement(id: string, remotePath: string) {
  return {
    id: `placement-${id}`,
    assetId: `asset-${id}`,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    asset: {
      id: `asset-${id}`,
      ownerUid: 'user-1',
      localUri: `file:///tmp/${id}.png`,
      remotePath,
      mimeType: 'image/png',
      width: 128,
      height: 128,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: null,
      source: 'import' as const,
    },
  };
}

describe('remoteArtifactUtils', () => {
  it('builds the paired video path using the local file extension', () => {
    expect(getRemotePairedVideoPath('user-1/note-1', 'file:///clip.mov')).toBe(
      'user-1/note-1.motion.mov'
    );
    expect(getRemotePairedVideoPath('user-1/note-1', null)).toBe('user-1/note-1.motion.mp4');
  });

  it('normalizes and de-duplicates remote ids', () => {
    expect(normalizeRemoteEntityIds([' post-1 ', null, 'post-2', 'post-1', ''])).toEqual([
      'post-1',
      'post-2',
    ]);
  });

  it('computes newly added remote artifacts', () => {
    expect(
      buildNewRemoteArtifacts(
        {
          photoPath: ' next/photo.jpg ',
          pairedVideoPath: 'next/video.mov',
          stickerPlacementsJson: JSON.stringify([
            createPlacement('a', ' sticker-a.png '),
            createPlacement('b', 'sticker-b.png'),
          ]),
        },
        {
          photoPath: 'previous/photo.jpg',
          pairedVideoPath: 'next/video.mov',
          stickerPlacementsJson: JSON.stringify([createPlacement('b', 'sticker-b.png')]),
        }
      )
    ).toEqual({
      photoPath: 'next/photo.jpg',
      pairedVideoPath: null,
      stickerPaths: ['sticker-a.png'],
    });
  });

  it('computes removed remote artifacts', () => {
    expect(
      buildRemovedRemoteArtifacts(
        {
          photoPath: 'previous/photo.jpg',
          pairedVideoPath: 'previous/video.mov',
          stickerPlacementsJson: JSON.stringify([
            createPlacement('a', 'sticker-a.png'),
            createPlacement('b', 'sticker-b.png'),
          ]),
        },
        {
          photoPath: 'previous/photo.jpg',
          pairedVideoPath: ' next/video.mov ',
          stickerPlacementsJson: JSON.stringify([createPlacement('b', 'sticker-b.png')]),
        }
      )
    ).toEqual({
      photoPath: null,
      pairedVideoPath: 'previous/video.mov',
      stickerPaths: ['sticker-a.png'],
    });
  });
});
