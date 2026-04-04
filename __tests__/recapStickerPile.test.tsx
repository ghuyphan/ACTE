import React from 'react';
import { render } from '@testing-library/react-native';
import RecapStickerPile from '../components/notes/recap/RecapStickerPile';
import { useStickerPhysics } from '../hooks/useStickerPhysics';

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Canvas: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Group: ({ children }: any) => <>{children}</>,
    Image: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    PathOp: {
      Difference: 'difference',
    },
    Skia: {
      Path: {
        Make: () => ({
          addRRect: jest.fn(),
          addRect: jest.fn(),
          addCircle: jest.fn(),
          op: jest.fn(),
        }),
      },
    },
    useImage: jest.fn(() => ({ mock: 'image' })),
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Image: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#ffffff',
      border: '#e5e5ea',
      primary: '#f59e0b',
      primarySoft: '#fef3c7',
      secondaryText: '#6b7280',
    },
  }),
}));

jest.mock('../hooks/useStickerPhysics', () => ({
  useStickerPhysics: jest.fn(() => ({ value: [] })),
}));

const mockedUseStickerPhysics = useStickerPhysics as jest.MockedFunction<typeof useStickerPhysics>;

const recapItems = [
  {
    key: 'stamp-1',
    kind: 'sticker' as const,
    previewUri: 'file:///stamp-1.png',
    count: 1,
    assetWidth: 240,
    assetHeight: 320,
    renderMode: 'stamp' as const,
  },
  {
    key: 'photo-1',
    kind: 'photo' as const,
    previewUri: 'file:///photo-1.jpg',
    count: 1,
  },
];

const manyRecapItems = Array.from({ length: 14 }, (_, index) => ({
  key: `item-${index + 1}`,
  kind: (index % 3 === 0 ? 'photo' : 'sticker') as 'photo' | 'sticker',
  previewUri: `file:///item-${index + 1}.png`,
  count: 1,
  assetWidth: 220,
  assetHeight: 280,
  renderMode: (index % 4 === 0 ? 'stamp' : 'default') as 'stamp' | 'default',
}));

const hugeRecapItems = Array.from({ length: 80 }, (_, index) => ({
  key: `huge-item-${index + 1}`,
  kind: (index % 4 === 0 ? 'photo' : 'sticker') as 'photo' | 'sticker',
  previewUri: `file:///huge-item-${index + 1}.png`,
  count: 1,
  assetWidth: 220,
  assetHeight: 280,
  renderMode: (index % 5 === 0 ? 'stamp' : 'default') as 'stamp' | 'default',
}));

describe('RecapStickerPile', () => {
  beforeEach(() => {
    mockedUseStickerPhysics.mockClear();
  });

  it('keeps recap physics active by default with sensor-driven motion enabled', () => {
    render(<RecapStickerPile items={recapItems} />);

    expect(mockedUseStickerPhysics).toHaveBeenCalledWith(
      expect.objectContaining({
        sensorDriven: true,
        collisionResponse: 'gentle',
        isActive: true,
        placements: expect.arrayContaining([
          expect.objectContaining({
            id: 'stamp-1',
            renderMode: 'stamp',
          }),
        ]),
      })
    );
  });

  it('lets callers disable recap physics entirely when needed', () => {
    render(<RecapStickerPile items={recapItems} physicsEnabled={false} />);

    expect(mockedUseStickerPhysics).toHaveBeenCalledWith(
      expect.objectContaining({
        sensorDriven: true,
        collisionResponse: 'gentle',
        isActive: false,
        placements: [],
      })
    );
  });

  it('renders every recap item and keeps all of them in live physics', () => {
    const view = render(<RecapStickerPile items={manyRecapItems} />);

    manyRecapItems.forEach((item) => {
      expect(view.getByTestId(`notes-recap-item-${item.key}`)).toBeTruthy();
    });

    const latestCall = mockedUseStickerPhysics.mock.calls.at(-1)?.[0];
    expect(latestCall?.placements).toHaveLength(manyRecapItems.length);
    expect(latestCall?.placements.map((placement) => placement.id)).toEqual(
      manyRecapItems.map((item) => item.key)
    );
  });

  it('scales huge recap piles down more aggressively while keeping every item live', () => {
    render(<RecapStickerPile items={manyRecapItems} />);
    const mediumCall = mockedUseStickerPhysics.mock.calls.at(-1)?.[0];

    const view = render(<RecapStickerPile items={hugeRecapItems} />);
    hugeRecapItems.forEach((item) => {
      expect(view.getByTestId(`notes-recap-item-${item.key}`)).toBeTruthy();
    });

    const hugeCall = mockedUseStickerPhysics.mock.calls.at(-1)?.[0];
    expect(hugeCall?.placements).toHaveLength(hugeRecapItems.length);
    expect(hugeCall?.placements.map((placement) => placement.id)).toEqual(
      hugeRecapItems.map((item) => item.key)
    );

    const mediumMaxScale = Math.max(...(mediumCall?.placements ?? []).map((placement) => placement.scale));
    const hugeMaxScale = Math.max(...(hugeCall?.placements ?? []).map((placement) => placement.scale));
    expect(hugeMaxScale).toBeLessThan(mediumMaxScale);
  });
});
