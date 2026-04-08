import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

const mockAuthState = {
  isReady: true,
  user: null as { id: string; uid: string } | null,
};
const mockConnectivityState = {
  status: 'online',
  isOnline: true,
  isInternetReachable: true,
  lastChangedAt: null as string | null,
};

const mockSubscriptionConfig = {
  testApiKey: '',
  iosApiKey: '',
  androidApiKey: 'android-key',
};
const mockRemoteUsage = {
  photoNoteCount: null as number | null,
};
const mockRemoveChannel = jest.fn<Promise<string>, [unknown]>(async () => 'ok');
type MockSupabaseChannel = {
  on: jest.MockedFunction<
    (
      type: string,
      filter: unknown,
      callback: (payload: { new: { photo_note_count: number | null } }) => void
    ) => MockSupabaseChannel
  >;
  subscribe: jest.MockedFunction<() => MockSupabaseChannel>;
};
type MockUserUsageQuery = {
  select: jest.MockedFunction<() => MockUserUsageQuery>;
  eq: jest.MockedFunction<(field: string, value: unknown) => MockUserUsageQuery>;
  maybeSingle: jest.MockedFunction<
    () => Promise<{ data: { photo_note_count: number | null }; error: null }>
  >;
};

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockConnectivityState,
}));

const mockSupabaseChannel = {} as MockSupabaseChannel;
mockSupabaseChannel.on = jest.fn<MockSupabaseChannel, [string, unknown, (payload: { new: { photo_note_count: number | null } }) => void]>(
  () => mockSupabaseChannel
);
mockSupabaseChannel.subscribe = jest.fn<MockSupabaseChannel, []>(() => mockSupabaseChannel);

const mockUserUsageQuery = {} as MockUserUsageQuery;
mockUserUsageQuery.select = jest.fn<MockUserUsageQuery, []>(() => mockUserUsageQuery);
mockUserUsageQuery.eq = jest.fn<MockUserUsageQuery, [string, unknown]>(() => mockUserUsageQuery);
mockUserUsageQuery.maybeSingle = jest.fn(async () => ({
    data: {
      photo_note_count: mockRemoteUsage.photoNoteCount,
    },
    error: null,
  }));

jest.mock('../utils/supabase', () => ({
  getSupabase: () => ({
    channel: jest.fn(() => mockSupabaseChannel),
    removeChannel: (channel: unknown) => mockRemoveChannel(channel),
    from: jest.fn(() => mockUserUsageQuery),
  }),
}));

jest.mock('../constants/subscription', () => {
  const { Platform } = require('react-native');

  return {
    FREE_PHOTO_NOTE_LIMIT: 10,
    PLUS_PHOTO_NOTE_LIMIT: null,
    REVENUECAT_PRO_ENTITLEMENT_ID: 'noto_pro',
    REVENUECAT_OFFERING_ID: 'default',
    getRevenueCatApiKey: (platformOS = Platform.OS) => {
      if (mockSubscriptionConfig.testApiKey.trim().length > 0) {
        return mockSubscriptionConfig.testApiKey;
      }

      if (platformOS === 'ios') {
        return mockSubscriptionConfig.iosApiKey;
      }

      if (platformOS === 'android') {
        return mockSubscriptionConfig.androidApiKey;
      }

      return '';
    },
    isRevenueCatConfigured: (platformOS = Platform.OS) => {
      if (mockSubscriptionConfig.testApiKey.trim().length > 0) {
        return true;
      }

      if (platformOS === 'ios') {
        return mockSubscriptionConfig.iosApiKey.trim().length > 0;
      }

      if (platformOS === 'android') {
        return mockSubscriptionConfig.androidApiKey.trim().length > 0;
      }

      return false;
    },
    getPhotoNoteLimitForTier: (tier: 'free' | 'plus') => (tier === 'plus' ? null : 10),
  };
});

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  PAYWALL_RESULT: {
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
  },
  default: {
    presentPaywall: jest.fn(async () => 'PURCHASED'),
    presentPaywallIfNeeded: jest.fn(async () => 'PURCHASED'),
    presentCustomerCenter: jest.fn(async () => undefined),
  },
}));

import { SubscriptionProvider, useSubscription } from '../hooks/useSubscription';

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
const mockRevenueCatUI = RevenueCatUI as jest.Mocked<typeof RevenueCatUI>;

const monthlyPackage = {
  packageType: PACKAGE_TYPE.MONTHLY,
  identifier: 'plus_monthly',
  product: {
    priceString: '$4.99',
    title: 'Monthly Plus',
  },
} as any;

const wrapper = ({ children }: { children: ReactNode }) => (
  <SubscriptionProvider>{children}</SubscriptionProvider>
);

function setPlatformOS(nextOS: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => nextOS,
  });
}

describe('useSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOS('android');
    mockAuthState.isReady = true;
    mockAuthState.user = null;
    mockConnectivityState.status = 'online';
    mockConnectivityState.isOnline = true;
    mockConnectivityState.isInternetReachable = true;
    mockConnectivityState.lastChangedAt = null;
    mockRemoteUsage.photoNoteCount = null;
    mockSubscriptionConfig.testApiKey = '';
    mockSubscriptionConfig.iosApiKey = '';
    mockSubscriptionConfig.androidApiKey = 'android-key';

    mockPurchases.getOfferings.mockResolvedValue({
      current: {
        identifier: 'default',
        availablePackages: [monthlyPackage],
      },
      all: {
        default: {
          identifier: 'default',
          availablePackages: [monthlyPackage],
        },
      },
    } as any);
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    } as any);
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: {
        entitlements: { active: { noto_pro: {} } },
      },
    } as any);
    mockPurchases.restorePurchases.mockResolvedValue({
      entitlements: { active: { noto_pro: {} } },
    } as any);
    mockPurchases.logIn.mockResolvedValue({
      customerInfo: {
        entitlements: { active: {} },
      },
    } as any);
    mockPurchases.logOut.mockResolvedValue({
      entitlements: { active: {} },
    } as any);
  });

  it('supports Android purchases when RevenueCat is configured', async () => {
    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.isConfigured).toBe(true);
      expect(hook.result.current.isPurchaseAvailable).toBe(true);
    });

    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'android-key',
    });
    expect(hook.result.current.plusPriceLabel).toBe('$4.99');

    let purchaseResult!: { status: string; message?: string };
    await act(async () => {
      purchaseResult = await hook.result.current.purchasePlus();
    });

    expect(purchaseResult.status).toBe('success');
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(monthlyPackage);

    let restoreResult!: { status: string; message?: string };
    await act(async () => {
      restoreResult = await hook.result.current.restorePurchases();
    });

    expect(restoreResult.status).toBe('success');
    expect(mockPurchases.restorePurchases).toHaveBeenCalled();
  });

  it('keeps Android purchases unavailable when RevenueCat is not configured', async () => {
    mockSubscriptionConfig.androidApiKey = '';

    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    expect(hook.result.current.isConfigured).toBe(false);
    expect(hook.result.current.isPurchaseAvailable).toBe(false);
    expect(mockPurchases.configure).not.toHaveBeenCalled();

    const purchaseResult = await hook.result.current.purchasePlus();
    expect(purchaseResult).toEqual({ status: 'unavailable' });

    const restoreResult = await hook.result.current.restorePurchases();
    expect(restoreResult).toEqual({ status: 'unavailable' });
  });

  it('surfaces the remote photo note count from Supabase usage data', async () => {
    mockAuthState.user = { id: 'user-1', uid: 'user-1' };
    mockRemoteUsage.photoNoteCount = 7;

    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.remotePhotoNoteCount).toBe(7);
    });
  });

  it('reloads offerings after an anonymous offline launch reconnects', async () => {
    mockConnectivityState.status = 'offline';
    mockConnectivityState.isOnline = false;
    mockConnectivityState.isInternetReachable = false;

    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.isPurchaseAvailable).toBe(false);
    });

    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();

    await act(async () => {
      mockConnectivityState.status = 'online';
      mockConnectivityState.isOnline = true;
      mockConnectivityState.isInternetReachable = true;
      hook.rerender({});
    });

    await waitFor(() => {
      expect(hook.result.current.isPurchaseAvailable).toBe(true);
      expect(hook.result.current.plusPriceLabel).toBe('$4.99');
    });
  });

  it('keeps the last known entitlement while the device is offline', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: { noto_pro: {} } },
    } as any);

    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.tier).toBe('plus');
      expect(hook.result.current.hasProEntitlement).toBe(true);
    });

    await act(async () => {
      mockConnectivityState.status = 'offline';
      mockConnectivityState.isOnline = false;
      mockConnectivityState.isInternetReachable = false;
      hook.rerender({});
    });

    expect(hook.result.current.tier).toBe('plus');
    expect(hook.result.current.hasProEntitlement).toBe(true);
  });

  it('reports restore as inactive when no plus entitlement is found', async () => {
    mockPurchases.restorePurchases.mockResolvedValue({
      entitlements: { active: {} },
    } as any);

    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    let restoreResult!: { status: string; message?: string };
    await act(async () => {
      restoreResult = await hook.result.current.restorePurchases();
    });

    expect(restoreResult.status).toBe('inactive');
    expect(restoreResult.message).toBe('No active Noto Plus purchase was found to restore.');
    expect(hook.result.current.tier).toBe('free');
  });

  it('presents RevenueCat paywall and customer center helpers', async () => {
    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    await act(async () => {
      expect(await hook.result.current.presentPaywallIfNeeded()).toBe('PURCHASED');
      await hook.result.current.presentCustomerCenter();
    });

    expect(mockRevenueCatUI.presentPaywallIfNeeded).toHaveBeenCalled();
    expect(mockRevenueCatUI.presentCustomerCenter).toHaveBeenCalled();
  });
});
