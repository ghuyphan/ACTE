import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  Reanimated.default.call = () => undefined;
  Reanimated.CurvedTransition.easingX = () => Reanimated.CurvedTransition;
  Reanimated.CurvedTransition.easingY = () => Reanimated.CurvedTransition;
  Reanimated.CurvedTransition.easingWidth = () => Reanimated.CurvedTransition;
  Reanimated.CurvedTransition.easingHeight = () => Reanimated.CurvedTransition;

  return Reanimated;
});

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(async () => undefined),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest.fn(async () => ({ current: null, all: {} })),
    getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
    purchasePackage: jest.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
    restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
    logIn: jest.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
    logOut: jest.fn(async () => ({ entitlements: { active: {} } })),
  },
  LOG_LEVEL: {
    DEBUG: 'DEBUG',
    ERROR: 'ERROR',
  },
  PACKAGE_TYPE: {
    ANNUAL: 'ANNUAL',
    MONTHLY: 'MONTHLY',
    THREE_MONTH: 'THREE_MONTH',
    SIX_MONTH: 'SIX_MONTH',
    TWO_MONTH: 'TWO_MONTH',
    WEEKLY: 'WEEKLY',
    LIFETIME: 'LIFETIME',
  },
}));

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
