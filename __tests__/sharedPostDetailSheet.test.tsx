import React from 'react';
import { render } from '@testing-library/react-native';
import SharedPostDetailSheet from '../components/shared/SharedPostDetailSheet';

const mockSharedPosts: any[] = [];

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'me' } }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    sharedPosts: mockSharedPosts,
    deleteSharedPostById: jest.fn(),
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#FFC107',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      danger: '#FF3B30',
      card: '#FFFFFF',
      border: '#E5E5EA',
    },
  }),
}));

jest.mock('../components/home/MemoryCardPrimitives', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    SharedPostMemoryCard: ({ post }: any) => <Text>{post.text}</Text>,
  };
});

jest.mock('../components/sheets/AppSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockAppSheet({ children }: { children?: React.ReactNode }) {
    return <View>{children}</View>;
  };
});

function createSharedPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shared-1',
    authorUid: 'friend-1',
    authorDisplayName: 'Lan',
    audienceUserIds: ['me'],
    type: 'text',
    text: 'Shared note',
    photoPath: null,
    photoLocalUri: null,
    placeName: 'District 3',
    sourceNoteId: 'note-1',
    createdAt: '2026-04-10T02:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

describe('SharedPostDetailSheet', () => {
  beforeEach(() => {
    mockSharedPosts.splice(0, mockSharedPosts.length);
  });

  it('shows the shared author as a handle in the detail info row', () => {
    mockSharedPosts.push(createSharedPost({ authorDisplayName: 'Lan' }));

    const { getByText, queryByText } = render(
      <SharedPostDetailSheet
        postId="shared-1"
        visible
        onClose={jest.fn()}
      />
    );

    expect(getByText('@Lan')).toBeTruthy();
    expect(queryByText('Lan')).toBeNull();
  });

  it('does not add a duplicate handle prefix when the author already has one', () => {
    mockSharedPosts.push(createSharedPost({ authorDisplayName: '@Lan' }));

    const { getByText, queryByText } = render(
      <SharedPostDetailSheet
        postId="shared-1"
        visible
        onClose={jest.fn()}
      />
    );

    expect(getByText('@Lan')).toBeTruthy();
    expect(queryByText('@@Lan')).toBeNull();
  });
});
