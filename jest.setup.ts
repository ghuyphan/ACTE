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

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///tmp/noto-polaroid.png'),
  releaseCapture: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockIcon = ({ name, children, ...props }: any) =>
    React.createElement(Text, props, children ?? name ?? 'icon');

  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
  };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return ({ name, children, ...props }: any) =>
    React.createElement(Text, props, children ?? name ?? 'icon');
});

jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    VideoView: ({ children, ...props }: any) => React.createElement(View, props, children),
    useVideoPlayer: (_source: unknown, setup?: (player: any) => void) => {
      const player = {
        loop: false,
        muted: false,
        volume: 1,
        currentTime: 0,
        play: jest.fn(),
        pause: jest.fn(),
        replay: jest.fn(),
      };
      setup?.(player);
      return player;
    },
  };
}, { virtual: true });

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

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { FlatList, ScrollView, TextInput, View } = require('react-native');

  const BottomSheetModal = React.forwardRef(({ children }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
    }));

    return React.createElement(View, null, children);
  });

  const BottomSheetBackdrop = ({ children }: any) => React.createElement(View, null, children);
  const BottomSheetView = ({ children, ...props }: any) => React.createElement(View, props, children);
  const BottomSheetModalProvider = ({ children }: any) => React.createElement(View, null, children);
  const BottomSheetFlatList = React.forwardRef((props: any, ref: any) =>
    React.createElement(FlatList, { ...props, ref })
  );
  const BottomSheetScrollView = React.forwardRef((props: any, ref: any) =>
    React.createElement(ScrollView, { ...props, ref })
  );
  const BottomSheetTextInput = React.forwardRef((props: any, ref: any) =>
    React.createElement(TextInput, { ...props, ref })
  );

  return {
    BottomSheetBackdrop,
    BottomSheetFlatList,
    BottomSheetModal,
    BottomSheetModalProvider,
    BottomSheetScrollView,
    BottomSheetTextInput,
    BottomSheetView,
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

  const createGestureChain = (kind = 'generic', gestures: any[] = []) => {
    const handlers: Record<string, ((...args: any[]) => any) | undefined> = {};
    const config: Record<string, unknown> = {};
    const chain = {
      kind,
      gestures,
      handlers,
      config,
      runOnJS: (value: unknown) => {
        config.runOnJS = value;
        return chain;
      },
      enabled: (value: unknown) => {
        config.enabled = value;
        return chain;
      },
      maxDuration: (value: unknown) => {
        config.maxDuration = value;
        return chain;
      },
      maxDistance: (value: unknown) => {
        config.maxDistance = value;
        return chain;
      },
      numberOfTaps: (value: unknown) => {
        config.numberOfTaps = value;
        return chain;
      },
      maxPointers: (value: unknown) => {
        config.maxPointers = value;
        return chain;
      },
      activeOffsetX: (value: unknown) => {
        config.activeOffsetX = value;
        return chain;
      },
      minDistance: (value: unknown) => {
        config.minDistance = value;
        return chain;
      },
      activeOffsetY: (value: unknown) => {
        config.activeOffsetY = value;
        return chain;
      },
      failOffsetY: (value: unknown) => {
        config.failOffsetY = value;
        return chain;
      },
      failOffsetX: (value: unknown) => {
        config.failOffsetX = value;
        return chain;
      },
      shouldCancelWhenOutside: (value: unknown) => {
        config.shouldCancelWhenOutside = value;
        return chain;
      },
      onBegin: (handler: (...args: any[]) => any) => {
        handlers.onBegin = handler;
        return chain;
      },
      onUpdate: (handler: (...args: any[]) => any) => {
        handlers.onUpdate = handler;
        return chain;
      },
      onEnd: (handler: (...args: any[]) => any) => {
        handlers.onEnd = handler;
        return chain;
      },
      onFinalize: (handler: (...args: any[]) => any) => {
        handlers.onFinalize = handler;
        return chain;
      },
    };

    return chain;
  };

  return {
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement(View, props, children),
    GestureDetector: ({ children, ...props }: any) => React.createElement(View, props, children),
    Gesture: {
      Tap: () => createGestureChain('tap'),
      Pan: () => createGestureChain('pan'),
      Pinch: () => createGestureChain('pinch'),
      Rotation: () => createGestureChain('rotation'),
      Exclusive: (...gestures: any[]) => createGestureChain('exclusive', gestures),
      Simultaneous: (...gestures: any[]) => createGestureChain('simultaneous', gestures),
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
    ColorMatrix: ({ children, ...props }: any) => React.createElement(View, props, children),
    Group: ({ children, ...props }: any) => React.createElement(View, props, children),
    Image: ({ children, ...props }: any) => React.createElement(View, props, children),
    Paint: ({ children, ...props }: any) => React.createElement(View, props, children),
    BlendColor: ({ children, ...props }: any) => React.createElement(View, props, children),
    Path: () => null,
    Circle: () => null,
    useImage: () => ({ width: 1, height: 1 }),
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
  Reanimated.SensorType = {
    GRAVITY: 'GRAVITY',
    ACCELEROMETER: 'ACCELEROMETER',
  };
  Reanimated.useAnimatedSensor = () => ({
    sensor: {
      value: { x: 0, y: 0, z: 0 },
    },
  });
  Reanimated.useFrameCallback = () => ({
    setActive: () => undefined,
  });

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

require('./constants/i18n');

const originalConsoleWarn = console.warn;
type ConsoleMethod = 'warn' | 'error';

const allowedConsolePatterns: Array<{ method: ConsoleMethod; pattern: RegExp }> = [
  {
    method: 'warn',
    pattern: /^\[auth\] Failed to /,
  },
  {
    method: 'warn',
    pattern: /^\[social-push\] /,
  },
  {
    method: 'warn',
    pattern: /^\[widgetService\] /,
  },
  {
    method: 'warn',
    pattern: /^Failed to claim social notification event;/,
  },
  {
    method: 'warn',
    pattern: /^Failed to reserve social notification recipients;/,
  },
  {
    method: 'warn',
    pattern: /^Expo social notification delivery failed;/,
  },
  {
    method: 'warn',
    pattern: /^Live photo capture failed:/,
  },
  {
    method: 'warn',
    pattern: /^Sticker paste failed:/,
  },
  {
    method: 'warn',
    pattern: /^\[notes\] Initial /,
  },
  {
    method: 'warn',
    pattern: /^Failed to sync geofence regions/,
  },
  {
    method: 'warn',
    pattern: /^Widget geofence refresh failed:/,
  },
  {
    method: 'warn',
    pattern: /^Geofencing is limited to /,
  },
  {
    method: 'error',
    pattern: /^Failed to load notes:/,
  },
  {
    method: 'error',
    pattern: /^delete-account failed:/,
  },
  {
    method: 'error',
    pattern: /^cleanup-sticker-assets failed:/,
  },
  {
    method: 'error',
    pattern: /^send-social-notifications failed:/,
  },
];

type NotoConsoleGuardState = typeof globalThis & {
  __notoAllowedConsolePatterns?: Array<{ method: ConsoleMethod; pattern: RegExp }>;
  __notoUnexpectedConsoleMessages?: string[];
  allowConsoleMessagesForTest?: (patterns: Array<{ method: ConsoleMethod; pattern: RegExp }>) => void;
};

(globalThis as NotoConsoleGuardState).allowConsoleMessagesForTest = (patterns) => {
  const state = globalThis as NotoConsoleGuardState;
  state.__notoAllowedConsolePatterns = [
    ...(state.__notoAllowedConsolePatterns ?? []),
    ...patterns,
  ];
};

function formatConsoleArg(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isAllowedConsoleMessage(method: ConsoleMethod, args: unknown[]) {
  const message = args.map(formatConsoleArg).join(' ');
  const state = globalThis as NotoConsoleGuardState;
  return [
    ...allowedConsolePatterns,
    ...(state.__notoAllowedConsolePatterns ?? []),
  ].some(
    (entry) => entry.method === method && entry.pattern.test(message)
  );
}

beforeEach(() => {
  const unexpectedMessages: string[] = [];
  const previousWarn = console.warn;
  const previousError = console.error;
  const forwardAllowedWarn = jest.isMockFunction(previousWarn) ? previousWarn : null;
  const forwardAllowedError = jest.isMockFunction(previousError) ? previousError : null;

  jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (isAllowedConsoleMessage('warn', args)) {
      forwardAllowedWarn?.(...args);
      return;
    }

    unexpectedMessages.push(`console.warn: ${args.map(formatConsoleArg).join(' ')}`);
  });

  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (isAllowedConsoleMessage('error', args)) {
      forwardAllowedError?.(...args);
      return;
    }

    unexpectedMessages.push(`console.error: ${args.map(formatConsoleArg).join(' ')}`);
  });

  (globalThis as typeof globalThis & { __notoUnexpectedConsoleMessages?: string[] })
    .__notoUnexpectedConsoleMessages = unexpectedMessages;
});

afterEach(() => {
  const state = globalThis as NotoConsoleGuardState;
  const unexpectedMessages = state.__notoUnexpectedConsoleMessages ?? [];
  delete state.__notoUnexpectedConsoleMessages;
  delete state.__notoAllowedConsolePatterns;
  if (jest.isMockFunction(console.warn)) {
    (console.warn as jest.Mock).mockRestore();
  }
  if (jest.isMockFunction(console.error)) {
    (console.error as jest.Mock).mockRestore();
  }

  if (unexpectedMessages.length > 0) {
    originalConsoleWarn(unexpectedMessages.join('\n\n'));
    throw new Error(
      `Unexpected console output in test. Add an explicit allowlist entry or fix the source:\n\n${unexpectedMessages.join('\n\n')}`
    );
  }
});
