import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendJoinScreen from '../app/friends/join';

const mockReplace = jest.fn();
const mockShowAppAlert = jest.fn();
const mockAuthState = {
  user: null as { uid: string } | null,
  isAuthAvailable: true,
  isReady: true,
};
const mockConnectivityState = {
  isOnline: true,
};
const mockUseLocalSearchParams = jest.fn<{
  inviteId?: string;
  invite?: string;
  mode?: string;
  username?: string;
}, []>(() => ({
  inviteId: 'invite-1',
  invite: 'token-1',
}));
const mockJoinInvite = jest.fn();

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

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockConnectivityState,
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
    joinInvite: (...args: unknown[]) => mockJoinInvite(...args),
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

jest.mock('../services/sharedFeedService', () => ({
  getSharedFeedErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown error',
  normalizeFriendInviteInput: (value: string) => value.trim(),
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
  const { Pressable, Text, TextInput, View } = require('react-native');
  return function MockFriendInviteJoinBody({
    inviteValue,
    mode,
    onChangeInvite,
    onChangeMode,
    onGoToAuth,
    onSubmitInvite,
    onSearchByUsername,
    isOnline,
    user,
  }: {
    inviteValue?: string;
    mode?: string;
    onChangeInvite?: (value: string) => void;
    onChangeMode?: (mode: 'username' | 'invite') => void;
    onGoToAuth: () => void;
    onSubmitInvite?: () => void;
    onSearchByUsername?: () => void;
    isOnline?: boolean;
    user?: { uid: string } | null;
  }) {
    return (
      <View>
        <Pressable testID="friend-sign-in" onPress={onGoToAuth}>
          <Text>Sign in</Text>
        </Pressable>
        <Pressable testID="friend-search" onPress={onSearchByUsername}>
          <Text>{user && isOnline === false ? 'offline' : 'search'}</Text>
        </Pressable>
        <Pressable testID="friend-mode-invite" onPress={() => onChangeMode?.('invite')}>
          <Text>Invite mode</Text>
        </Pressable>
        <Text testID="friend-mode-label">{mode}</Text>
        <TextInput
          testID="friend-invite-input"
          value={inviteValue}
          onChangeText={onChangeInvite}
        />
        <Pressable testID="friend-submit-invite" onPress={onSubmitInvite}>
          <Text>Continue</Text>
        </Pressable>
      </View>
    );
  };
});

jest.mock('../utils/alert', () => ({
  showAppAlert: (...args: unknown[]) => mockShowAppAlert(...args),
}));

describe('FriendJoinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseLocalSearchParams.mockReturnValue({
      inviteId: 'invite-1',
      invite: 'token-1',
    });
    mockAuthState.user = null;
    mockAuthState.isAuthAvailable = true;
    mockAuthState.isReady = true;
    mockConnectivityState.isOnline = true;
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

  it('does not auto-accept invite links while signed-in users are offline', () => {
    mockAuthState.user = { uid: 'user-1' };
    mockConnectivityState.isOnline = false;

    const { getByText } = render(<FriendJoinScreen />);

    expect(getByText('offline')).toBeTruthy();
    expect(mockJoinInvite).not.toHaveBeenCalled();
  });

  it('auto-prompts signed-in users when the route contains an invite', async () => {
    mockAuthState.user = { uid: 'user-1' };

    render(<FriendJoinScreen />);

    await waitFor(() => {
      expect(mockJoinInvite).toHaveBeenCalledWith('/friends/join?inviteId=invite-1&invite=token-1');
    });
  });

  it('does not auto-prompt while a signed-in user manually enters an invite', () => {
    mockAuthState.user = { uid: 'user-1' };
    mockUseLocalSearchParams.mockReturnValue({
      mode: 'invite',
    });

    const { getByTestId } = render(<FriendJoinScreen />);

    fireEvent.changeText(getByTestId('friend-invite-input'), 'token-typed-by-user');

    expect(mockJoinInvite).not.toHaveBeenCalled();
  });

  it('shows an offline alert instead of running friend search while offline', () => {
    mockAuthState.user = { uid: 'user-1' };
    mockConnectivityState.isOnline = false;

    const { getByTestId } = render(<FriendJoinScreen />);

    fireEvent.press(getByTestId('friend-search'));

    expect(mockShowAppAlert).toHaveBeenCalled();
    expect(mockJoinInvite).not.toHaveBeenCalled();
  });
});
