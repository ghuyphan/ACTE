import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
  WebBrowserPresentationStyle: {
    AUTOMATIC: 'automatic',
  },
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => undefined),
    signIn: jest.fn(async () => ({ type: 'success', data: { idToken: 'test-token' } })),
    signOut: jest.fn(async () => undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');

  return {
    FlashList: React.forwardRef((props: any, ref: any) =>
      React.createElement(FlatList, { ...props, ref })
    ),
  };
});

jest.mock('react-native-mmkv', () => ({
  MMKV: class MockMMKV {
    private store = new Map<string, string>();

    getString(key: string) {
      return this.store.get(key);
    }

    set(key: string, value: string) {
      this.store.set(key, value);
    }

    delete(key: string) {
      this.store.delete(key);
    }
  },
}));

jest.mock('@react-native-community/netinfo', () => {
  let listener: ((state: any) => void) | null = null;
  const defaultState = {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: null,
  };

  return {
    __esModule: true,
    default: {
      addEventListener: jest.fn((callback: (state: any) => void) => {
        listener = callback;
        callback(defaultState);
        return () => {
          listener = null;
        };
      }),
      fetch: jest.fn(async () => defaultState),
      refresh: jest.fn(async () => defaultState),
      __emit(state: any) {
        listener?.({ ...defaultState, ...state });
      },
    },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  const createGestureChain = () => {
    const chain = {
      runOnJS: () => chain,
      enabled: () => chain,
      maxPointers: () => chain,
      minDistance: () => chain,
      shouldCancelWhenOutside: () => chain,
      onBegin: () => chain,
      onUpdate: () => chain,
      onFinalize: () => chain,
    };

    return chain;
  };

  return {
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement(View, props, children),
    GestureDetector: ({ children, ...props }: any) => React.createElement(View, props, children),
    Gesture: {
      Pan: () => createGestureChain(),
    },
  };
});

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const createPath = () => ({
    commands: [] as Array<unknown>,
    moveTo(x: number, y: number) {
      this.commands.push(['M', x, y]);
      return this;
    },
    lineTo(x: number, y: number) {
      this.commands.push(['L', x, y]);
      return this;
    },
    quadTo(x1: number, y1: number, x2: number, y2: number) {
      this.commands.push(['Q', x1, y1, x2, y2]);
      return this;
    },
    addCircle(x: number, y: number, r: number) {
      this.commands.push(['C', x, y, r]);
      return this;
    },
  });

  return {
    Canvas: ({ children, ...props }: any) => React.createElement(View, props, children),
    Path: () => null,
    Circle: () => null,
    usePathValue: () => createPath(),
    Skia: {
      Path: {
        Make: () => createPath(),
      },
    },
  };
});

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
