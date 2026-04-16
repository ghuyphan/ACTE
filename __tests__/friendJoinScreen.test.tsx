import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import FriendJoinScreen from '../app/friends/join';

const mockReplace = jest.fn();
const mockAuthState = {
  user: null as { uid: string } | null,
  isAuthAvailable: true,
  isReady: true,
};
const mockUseLocalSearchParams = jest.fn(() => ({
  inviteId: 'invite-1',
  invite: 'token-1',
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
    canDismiss: () => false,
    canGoBack: () => false,
    dismiss: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) => {
    const params = options?.queryParams ?? {};
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return query ? `${path}?${query}` : path;
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    findFriendByUsername: jest.fn(),
    addFriendByUsername: jest.fn(),
  }),
}));

jest.mock('../hooks/useFriendInviteJoin', () => ({
  useFriendInviteJoin: () => ({
    joining: false,
    joinInvite: jest.fn(),
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      border: '#E5E5EA',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('../components/sheets/AppSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockAppSheet({ children }: { children?: React.ReactNode }) {
    return <View>{children}</View>;
  };
});

jest.mock('../components/sheets/AppSheetScaffold', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockAppSheetScaffold({ children }: { children?: React.ReactNode }) {
    return <View>{children}</View>;
  };
});

jest.mock('../components/friends/FriendInviteJoinBody', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return function MockFriendInviteJoinBody({ onGoToAuth }: { onGoToAuth: () => void }) {
    return (
      <View>
        <Pressable testID="friend-sign-in" onPress={onGoToAuth}>
          <Text>Sign in</Text>
        </Pressable>
      </View>
    );
  };
});

describe('FriendJoinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthState.user = null;
    mockAuthState.isAuthAvailable = true;
    mockAuthState.isReady = true;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns to the invite screen after auth is required', () => {
    const { getByTestId } = render(<FriendJoinScreen />);

    fireEvent.press(getByTestId('friend-sign-in'));

    act(() => {
      jest.runAllTimers();
    });

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/auth',
      params: {
        returnTo: '/friends/join?inviteId=invite-1&invite=token-1',
      },
    });
  });

  it('does not redirect to auth while auth restoration is still settling', () => {
    mockAuthState.isReady = false;
    const { getByTestId } = render(<FriendJoinScreen />);

    fireEvent.press(getByTestId('friend-sign-in'));

    act(() => {
      jest.runAllTimers();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
