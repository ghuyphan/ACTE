import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { doc, onSnapshot } from '@react-native-firebase/firestore';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import {
  PlanTier,
  REVENUECAT_PLUS_ENTITLEMENT_ID,
  REVENUECAT_PLUS_OFFERING_ID,
  getRevenueCatApiKey,
  getPhotoNoteLimitForTier,
  isRevenueCatConfigured,
} from '../constants/subscription';
import { getFirestore } from '../utils/firebase';
import { useAuth } from './useAuth';

export interface SubscriptionActionResult {
  status: 'success' | 'cancelled' | 'unavailable' | 'error';
  message?: string;
}

interface SubscriptionContextValue {
  tier: PlanTier;
  isReady: boolean;
  isConfigured: boolean;
  isPurchaseAvailable: boolean;
  isPurchaseInFlight: boolean;
  canImportFromLibrary: boolean;
  photoNoteLimit: number | null;
  remotePhotoNoteCount: number | null;
  plusPriceLabel: string | null;
  plusPackageTitle: string | null;
  purchasePlus: () => Promise<SubscriptionActionResult>;
  restorePurchases: () => Promise<SubscriptionActionResult>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

function getTierFromCustomerInfo(customerInfo: CustomerInfo | null): PlanTier {
  if (customerInfo?.entitlements.active?.[REVENUECAT_PLUS_ENTITLEMENT_ID]) {
    return 'plus';
  }

  return 'free';
}

function selectPreferredPackage(offering: PurchasesOffering | null): PurchasesPackage | null {
  if (!offering) {
    return null;
  }

  const preferredOrder = [
    PACKAGE_TYPE.ANNUAL,
    PACKAGE_TYPE.MONTHLY,
    PACKAGE_TYPE.THREE_MONTH,
    PACKAGE_TYPE.SIX_MONTH,
    PACKAGE_TYPE.TWO_MONTH,
    PACKAGE_TYPE.WEEKLY,
    PACKAGE_TYPE.LIFETIME,
  ];

  for (const packageType of preferredOrder) {
    const match = offering.availablePackages.find((item) => item.packageType === packageType);
    if (match) {
      return match;
    }
  }

  return offering.availablePackages[0] ?? null;
}

function getPlusOfferingLabel(aPackage: PurchasesPackage | null) {
  if (!aPackage) {
    return null;
  }

  const title = aPackage.product.title?.trim();
  if (title) {
    return title;
  }

  return aPackage.identifier;
}

function isPurchaseCancelled(error: unknown) {
  return Boolean(
    typeof error === 'object' &&
      error &&
      'userCancelled' in error &&
      (error as { userCancelled?: boolean }).userCancelled
  );
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isReady: authReady, user } = useAuth();
  const isConfigured = isRevenueCatConfigured();
  const revenueCatApiKey = getRevenueCatApiKey();
  const [isReady, setIsReady] = useState(() => !isConfigured);
  const [tier, setTier] = useState<PlanTier>('free');
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchaseInFlight, setIsPurchaseInFlight] = useState(false);
  const [remotePhotoNoteCount, setRemotePhotoNoteCount] = useState<number | null>(null);
  const isConfiguredRef = useRef(false);
  const isInitializedRef = useRef(false);
  const currentRevenueCatUserIdRef = useRef<string | null>(null);

  const loadRevenueCatState = useCallback(async () => {
    if (!isConfiguredRef.current) {
      return;
    }

    const [offerings, customerInfo] = await Promise.all([
      Purchases.getOfferings(),
      Purchases.getCustomerInfo(),
    ]);

    const offering =
      (REVENUECAT_PLUS_OFFERING_ID
        ? offerings.all[REVENUECAT_PLUS_OFFERING_ID]
        : offerings.current) ?? offerings.current ?? null;

    setSelectedPackage(selectPreferredPackage(offering));
    setTier(getTierFromCustomerInfo(customerInfo));
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setIsReady(true);
      return;
    }

    if (isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;
    isConfiguredRef.current = true;
    Purchases.configure({
      apiKey: revenueCatApiKey,
    });

    void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

    const listener = (customerInfo: CustomerInfo) => {
      setTier(getTierFromCustomerInfo(customerInfo));
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    void loadRevenueCatState()
      .catch((error) => {
        console.warn('[subscription] Failed to initialize RevenueCat:', error);
      })
      .finally(() => {
        setIsReady(true);
      });

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [isConfigured, loadRevenueCatState, revenueCatApiKey]);

  useEffect(() => {
    const firestore = getFirestore();
    if (!authReady) {
      return;
    }

    if (!user || !firestore) {
      setRemotePhotoNoteCount(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data() as { photoNoteCount?: unknown } | undefined;
        const nextCount = data?.photoNoteCount;
        setRemotePhotoNoteCount(
          typeof nextCount === 'number' && Number.isFinite(nextCount) ? nextCount : null
        );
      },
      (error) => {
        console.warn('[subscription] Failed to observe remote usage:', error);
      }
    );

    return unsubscribe;
  }, [authReady, user]);

  useEffect(() => {
    if (!isConfigured || !authReady) {
      return;
    }

    const nextUserId = user?.uid ?? null;
    if (currentRevenueCatUserIdRef.current === nextUserId) {
      return;
    }

    currentRevenueCatUserIdRef.current = nextUserId;

    void (async () => {
      try {
        if (nextUserId) {
          const result = await Purchases.logIn(nextUserId);
          setTier(getTierFromCustomerInfo(result.customerInfo));
        } else {
          const customerInfo = await Purchases.logOut();
          setTier(getTierFromCustomerInfo(customerInfo));
        }

        await loadRevenueCatState();
      } catch (error) {
        console.warn('[subscription] Failed to refresh RevenueCat user state:', error);
      }
    })();
  }, [authReady, isConfigured, loadRevenueCatState, user?.uid]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      tier,
      isReady,
      isConfigured,
      isPurchaseAvailable: (Platform.OS === 'ios' || Platform.OS === 'android') && isConfigured && Boolean(selectedPackage),
      isPurchaseInFlight,
      canImportFromLibrary: tier === 'plus',
      photoNoteLimit: getPhotoNoteLimitForTier(tier),
      remotePhotoNoteCount,
      plusPriceLabel: selectedPackage?.product.priceString ?? null,
      plusPackageTitle: getPlusOfferingLabel(selectedPackage),
      purchasePlus: async () => {
        if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured || !selectedPackage) {
          return { status: 'unavailable' };
        }

        setIsPurchaseInFlight(true);
        try {
          const result = await Purchases.purchasePackage(selectedPackage);
          setTier(getTierFromCustomerInfo(result.customerInfo));
          return { status: 'success' };
        } catch (error) {
          if (isPurchaseCancelled(error)) {
            return { status: 'cancelled' };
          }

          console.warn('[subscription] Purchase failed:', error);
          return { status: 'error' };
        } finally {
          setIsPurchaseInFlight(false);
        }
      },
      restorePurchases: async () => {
        if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured) {
          return { status: 'unavailable' };
        }

        setIsPurchaseInFlight(true);
        try {
          const customerInfo = await Purchases.restorePurchases();
          setTier(getTierFromCustomerInfo(customerInfo));
          return { status: 'success' };
        } catch (error) {
          console.warn('[subscription] Restore failed:', error);
          return { status: 'error' };
        } finally {
          setIsPurchaseInFlight(false);
        }
      },
      refreshSubscription: async () => {
        if (!isConfigured) {
          return;
        }

        await loadRevenueCatState();
      },
    }),
    [isConfigured, isPurchaseInFlight, isReady, loadRevenueCatState, remotePhotoNoteCount, selectedPackage, tier]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }

  return context;
}
