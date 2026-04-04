import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import {
  PlanTier,
  REVENUECAT_OFFERING_ID,
  REVENUECAT_PRO_ENTITLEMENT_ID,
  getRevenueCatApiKey,
  getPhotoNoteLimitForTier,
  isRevenueCatConfigured,
} from '../constants/subscription';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';
import { getSupabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';

export interface SubscriptionActionResult {
  status: 'success' | 'cancelled' | 'unavailable' | 'error';
  message?: string;
  customerInfo?: CustomerInfo;
}

interface SubscriptionContextValue {
  tier: PlanTier;
  isReady: boolean;
  isConfigured: boolean;
  isPurchaseAvailable: boolean;
  isPurchaseInFlight: boolean;
  hasProEntitlement: boolean;
  canImportFromLibrary: boolean;
  photoNoteLimit: number | null;
  remotePhotoNoteCount: number | null;
  isRemotePhotoNoteCountReady: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  availablePackages: PurchasesPackage[];
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  lifetimePackage: PurchasesPackage | null;
  plusPriceLabel: string | null;
  plusPackageTitle: string | null;
  purchasePackage: (pkg: PurchasesPackage | null) => Promise<SubscriptionActionResult>;
  purchasePlus: () => Promise<SubscriptionActionResult>;
  restorePurchases: () => Promise<SubscriptionActionResult>;
  presentPaywall: () => Promise<PAYWALL_RESULT | null>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT | null>;
  presentCustomerCenter: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);
const SUBSCRIPTION_SNAPSHOT_KEY_PREFIX = 'subscription.snapshot.';

interface SubscriptionSnapshot {
  tier: PlanTier;
  remotePhotoNoteCount: number | null;
  plusPriceLabel: string | null;
  plusPackageTitle: string | null;
  cachedAt: string;
}

function getTierFromCustomerInfo(customerInfo: CustomerInfo | null): PlanTier {
  if (customerInfo?.entitlements.active?.[REVENUECAT_PRO_ENTITLEMENT_ID]) {
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

function getPurchaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Purchase failed.');
  }

  return 'Purchase failed.';
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
  const { isOnline } = useConnectivity();
  const isConfigured = isRevenueCatConfigured();
  const revenueCatApiKey = getRevenueCatApiKey();
  const [isReady, setIsReady] = useState(() => !isConfigured);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [isPurchaseInFlight, setIsPurchaseInFlight] = useState(false);
  const [remotePhotoNoteCount, setRemotePhotoNoteCount] = useState<number | null>(null);
  const [isRemotePhotoNoteCountReady, setIsRemotePhotoNoteCountReady] = useState(false);
  const [cachedSnapshot, setCachedSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const isConfiguredRef = useRef(false);
  const isInitializedRef = useRef(false);
  const currentRevenueCatUserIdRef = useRef<string | null>(null);
  const snapshotStorageKey = `${SUBSCRIPTION_SNAPSHOT_KEY_PREFIX}${user?.uid ?? 'anonymous'}`;

  const loadRevenueCatState = useCallback(async () => {
    if (!isConfiguredRef.current || !isOnline) {
      return;
    }

    const [offerings, customerInfo] = await Promise.all([
      Purchases.getOfferings(),
      Purchases.getCustomerInfo(),
    ]);

    const offering =
      (REVENUECAT_OFFERING_ID
        ? offerings.all[REVENUECAT_OFFERING_ID]
        : offerings.current) ?? offerings.current ?? null;

    setCurrentOffering(offering);
    setCustomerInfo(customerInfo);
  }, [isOnline]);

  useEffect(() => {
    getPersistentItem(snapshotStorageKey)
      .then((rawValue) => {
        if (!rawValue) {
          setCachedSnapshot(null);
          return;
        }

        const parsed = JSON.parse(rawValue) as SubscriptionSnapshot;
        setCachedSnapshot(parsed);
        if (parsed.remotePhotoNoteCount !== null) {
          setRemotePhotoNoteCount((current) => current ?? parsed.remotePhotoNoteCount);
          setIsRemotePhotoNoteCountReady(true);
        }
      })
      .catch((error) => {
        console.warn('[subscription] Failed to load cached subscription snapshot:', error);
      });
  }, [snapshotStorageKey]);

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
      setCustomerInfo(customerInfo);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    if (!isOnline) {
      setIsReady(true);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    }

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
  }, [isConfigured, isOnline, loadRevenueCatState, revenueCatApiKey]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const supabase = getSupabase();
    const cachedRemotePhotoNoteCount = cachedSnapshot?.remotePhotoNoteCount ?? null;
    if (!user || !supabase) {
      setRemotePhotoNoteCount(cachedRemotePhotoNoteCount);
      setIsRemotePhotoNoteCountReady(true);
      return;
    }

    setRemotePhotoNoteCount(cachedRemotePhotoNoteCount);

    if (!isOnline) {
      setIsRemotePhotoNoteCountReady(cachedRemotePhotoNoteCount !== null);
      return;
    }

    setIsRemotePhotoNoteCountReady(cachedRemotePhotoNoteCount !== null);

    let active = true;
    const channel = supabase
      .channel(`user-usage:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_usage',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const nextCount =
            typeof payload.new === 'object' && payload.new && 'photo_note_count' in payload.new
              ? (payload.new as { photo_note_count?: unknown }).photo_note_count
              : null;
          setIsRemotePhotoNoteCountReady(true);
          setRemotePhotoNoteCount(
            typeof nextCount === 'number' && Number.isFinite(nextCount) ? nextCount : null
          );
        }
      )
      .subscribe();

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('user_usage')
          .select('photo_note_count')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (error) {
          throw error;
        }

        const nextCount = data?.photo_note_count;
        setIsRemotePhotoNoteCountReady(true);
        setRemotePhotoNoteCount(
          typeof nextCount === 'number' && Number.isFinite(nextCount) ? nextCount : null
        );
      } catch (error: unknown) {
        console.warn('[subscription] Failed to load remote usage:', error);
        if (active) {
          setIsRemotePhotoNoteCountReady(cachedRemotePhotoNoteCount !== null);
        }
      }
    })();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authReady, cachedSnapshot?.remotePhotoNoteCount, isOnline, user]);

  useEffect(() => {
    if (!isConfigured || !authReady || !isOnline) {
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
          setCustomerInfo(result.customerInfo);
        } else {
          const customerInfo = await Purchases.logOut();
          setCustomerInfo(customerInfo);
        }

        await loadRevenueCatState();
      } catch (error) {
        console.warn('[subscription] Failed to refresh RevenueCat user state:', error);
      }
    })();
  }, [authReady, isConfigured, isOnline, loadRevenueCatState, user?.uid]);

  const tier = customerInfo ? getTierFromCustomerInfo(customerInfo) : cachedSnapshot?.tier ?? 'free';
  const selectedPackage = selectPreferredPackage(currentOffering);
  const availablePackages = currentOffering?.availablePackages ?? [];
  const monthlyPackage =
    availablePackages.find((item) => item.packageType === PACKAGE_TYPE.MONTHLY) ?? null;
  const annualPackage =
    availablePackages.find((item) => item.packageType === PACKAGE_TYPE.ANNUAL) ?? null;
  const lifetimePackage =
    availablePackages.find((item) => item.packageType === PACKAGE_TYPE.LIFETIME) ?? null;

  useEffect(() => {
    const nextSnapshot: SubscriptionSnapshot = {
      tier,
      remotePhotoNoteCount,
      plusPriceLabel: selectedPackage?.product.priceString ?? cachedSnapshot?.plusPriceLabel ?? null,
      plusPackageTitle: getPlusOfferingLabel(selectedPackage) ?? cachedSnapshot?.plusPackageTitle ?? null,
      cachedAt: new Date().toISOString(),
    };

    setCachedSnapshot(nextSnapshot);
    void setPersistentItem(snapshotStorageKey, JSON.stringify(nextSnapshot)).catch((error) => {
      console.warn('[subscription] Failed to persist subscription snapshot:', error);
    });
  }, [remotePhotoNoteCount, selectedPackage, snapshotStorageKey, tier]);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage | null): Promise<SubscriptionActionResult> => {
      if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured || !pkg || !isOnline) {
        return { status: 'unavailable' };
      }

      setIsPurchaseInFlight(true);
      try {
        const result = await Purchases.purchasePackage(pkg);
        setCustomerInfo(result.customerInfo);
        return { status: 'success', customerInfo: result.customerInfo };
      } catch (error) {
        if (isPurchaseCancelled(error)) {
          return { status: 'cancelled' };
        }

        console.warn('[subscription] Purchase failed:', error);
        return { status: 'error', message: getPurchaseErrorMessage(error) };
      } finally {
        setIsPurchaseInFlight(false);
      }
    },
    [isConfigured, isOnline]
  );

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      tier,
      isReady,
      isConfigured,
      isPurchaseAvailable:
        (Platform.OS === 'ios' || Platform.OS === 'android') &&
        isConfigured &&
        isOnline &&
        availablePackages.length > 0,
      isPurchaseInFlight,
      hasProEntitlement: tier === 'plus',
      canImportFromLibrary: tier === 'plus',
      photoNoteLimit: getPhotoNoteLimitForTier(tier),
      remotePhotoNoteCount: remotePhotoNoteCount ?? cachedSnapshot?.remotePhotoNoteCount ?? null,
      isRemotePhotoNoteCountReady,
      customerInfo,
      currentOffering,
      availablePackages,
      monthlyPackage,
      annualPackage,
      lifetimePackage,
      plusPriceLabel: selectedPackage?.product.priceString ?? cachedSnapshot?.plusPriceLabel ?? null,
      plusPackageTitle: getPlusOfferingLabel(selectedPackage) ?? cachedSnapshot?.plusPackageTitle ?? null,
      purchasePackage,
      purchasePlus: async () => {
        if (!selectedPackage) {
          return { status: 'unavailable' };
        }

        return purchasePackage(selectedPackage);
      },
      restorePurchases: async () => {
        if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured || !isOnline) {
          return { status: 'unavailable' };
        }

        setIsPurchaseInFlight(true);
        try {
          const customerInfo = await Purchases.restorePurchases();
          setCustomerInfo(customerInfo);
          return { status: 'success', customerInfo };
        } catch (error) {
          console.warn('[subscription] Restore failed:', error);
          return { status: 'error', message: getPurchaseErrorMessage(error) };
        } finally {
          setIsPurchaseInFlight(false);
        }
      },
      presentPaywall: async () => {
        if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured || !isOnline) {
          return null;
        }

        try {
          return await RevenueCatUI.presentPaywall({
            offering: currentOffering ?? undefined,
            displayCloseButton: true,
          });
        } catch (error) {
          console.warn('[subscription] Paywall presentation failed:', error);
          return null;
        }
      },
      presentPaywallIfNeeded: async () => {
        if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured || !isOnline) {
          return null;
        }

        try {
          return await RevenueCatUI.presentPaywallIfNeeded({
            requiredEntitlementIdentifier: REVENUECAT_PRO_ENTITLEMENT_ID,
            offering: currentOffering ?? undefined,
            displayCloseButton: true,
          });
        } catch (error) {
          console.warn('[subscription] Conditional paywall presentation failed:', error);
          return null;
        }
      },
      presentCustomerCenter: async () => {
        if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !isConfigured || !isOnline) {
          return;
        }

        try {
          await RevenueCatUI.presentCustomerCenter({
            callbacks: {
              onRestoreCompleted: ({ customerInfo }) => {
                setCustomerInfo(customerInfo);
              },
              onRestoreFailed: ({ error }) => {
                console.warn('[subscription] Customer Center restore failed:', error);
              },
            },
          });
        } catch (error) {
          console.warn('[subscription] Customer Center presentation failed:', error);
        }
      },
      refreshSubscription: async () => {
        if (!isConfigured || !isOnline) {
          return;
        }

        await loadRevenueCatState();
      },
    }),
    [
      annualPackage,
      availablePackages,
      cachedSnapshot,
      currentOffering,
      customerInfo,
      isConfigured,
      isOnline,
      isPurchaseInFlight,
      isReady,
      lifetimePackage,
      loadRevenueCatState,
      monthlyPackage,
      purchasePackage,
      remotePhotoNoteCount,
      isRemotePhotoNoteCountReady,
      selectedPackage,
      tier,
    ]
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
