import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE } from 'react-native-purchases';

const mockAuthState = {
  isReady: true,
  user: null as { uid: string } | null,
};

const mockSubscriptionConfig = {
  iosApiKey: '',
  androidApiKey: 'android-key',
};
const mockRemoteUsage = {
  photoNoteCount: null as number | null,
};
const mockUsageUnsubscribe = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../utils/firebase', () => ({
  getFirestore: () => ({}),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  doc: (_firestore: unknown, ...path: string[]) => ({ path }),
  onSnapshot: (_ref: unknown, onNext: (snapshot: { data: () => { photoNoteCount: number | null } }) => void) => {
    onNext({
      data: () => ({
        photoNoteCount: mockRemoteUsage.photoNoteCount,
      }),
    });

    return mockUsageUnsubscribe;
  },
}));

jest.mock('../constants/subscription', () => {
  const { Platform } = require('react-native');

  return {
    FREE_PHOTO_NOTE_LIMIT: 10,
    PLUS_PHOTO_NOTE_LIMIT: null,
    REVENUECAT_PLUS_ENTITLEMENT_ID: 'plus',
    REVENUECAT_PLUS_OFFERING_ID: '',
    getRevenueCatApiKey: (platformOS = Platform.OS) => {
      if (platformOS === 'ios') {
        return mockSubscriptionConfig.iosApiKey;
      }

      if (platformOS === 'android') {
        return mockSubscriptionConfig.androidApiKey;
      }

      return '';
    },
    isRevenueCatConfigured: (platformOS = Platform.OS) => {
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

import { SubscriptionProvider, useSubscription } from '../hooks/useSubscription';

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;

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
    mockRemoteUsage.photoNoteCount = null;
    mockSubscriptionConfig.iosApiKey = '';
    mockSubscriptionConfig.androidApiKey = 'android-key';

    mockPurchases.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [monthlyPackage],
      },
      all: {},
    } as any);
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    } as any);
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: {
        entitlements: { active: { plus: {} } },
      },
    } as any);
    mockPurchases.restorePurchases.mockResolvedValue({
      entitlements: { active: { plus: {} } },
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

    expect(purchaseResult).toEqual({ status: 'success' });
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(monthlyPackage);

    let restoreResult!: { status: string; message?: string };
    await act(async () => {
      restoreResult = await hook.result.current.restorePurchases();
    });

    expect(restoreResult).toEqual({ status: 'success' });
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

  it('surfaces the remote photo note count from Firestore usage data', async () => {
    mockAuthState.user = { uid: 'user-1' };
    mockRemoteUsage.photoNoteCount = 7;

    const hook = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.remotePhotoNoteCount).toBe(7);
    });
  });
});
