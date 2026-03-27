import type { ExpoConfig } from 'expo/config';

const googleMapsAndroidApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/i, '')}`
  : '';

const config = {
  name: 'Noto',
  slug: 'noto',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon/icon-default.png',
  scheme: 'noto',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.acte.app',
    icon: './Untitled.icon',
  },
  android: {
    package: 'com.acte.app',
    adaptiveIcon: {
      backgroundColor: '#F7F2EB',
      foregroundImage: './assets/images/icon/icon-default.png',
      monochromeImage: './assets/images/icon/icon-tinted-light.png',
    },
    predictiveBackGestureEnabled: false,
    config: googleMapsAndroidApiKey
      ? {
          googleMaps: {
            apiKey: googleMapsAndroidApiKey,
          },
        }
      : undefined,
  },
  web: {
    output: 'static',
    favicon: './assets/images/icon/icon-default.png',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Noto to use your location to save and find your nearby memories.',
        locationAlwaysPermission:
          'Allow Noto to use your location in the background so it can remind you when you return to saved places.',
        locationWhenInUsePermission:
          'Allow Noto to use your location so you can attach notes to the places you visit.',
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/icon/icon-default.png',
        imageWidth: 120,
        resizeMode: 'contain',
        backgroundColor: '#F7F2EB',
        dark: {
          image: './assets/images/icon/icon-default.png',
          backgroundColor: '#F7F2EB',
        },
      },
    ],
    'expo-sqlite',
    googleIosUrlScheme
      ? [
          '@react-native-google-signin/google-signin',
          {
            iosUrlScheme: googleIosUrlScheme,
          },
        ]
      : null,
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
        faceIDPermission: 'Allow Noto to securely access your saved account session.',
      },
    ],
    './plugins/withExpoWidgetsBundleFix.js',
    [
      'expo-widgets',
      {
        widgets: [
          {
            name: 'LocketWidget',
            module: './widgets/LocketWidget.tsx',
            targetName: 'ExpoWidgetsTarget',
            displayName: 'Memories',
            description: 'See your nearby memory from your Home Screen or Lock Screen.',
            supportedFamilies: [
              'systemSmall',
              'systemMedium',
              'systemLarge',
              'accessoryInline',
              'accessoryCircular',
              'accessoryRectangular',
            ],
          },
        ],
      },
    ],
    './plugins/withCustomWidgetSwift.js',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Noto to use your camera so you can save photo memories.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Noto to access your photo library so you can save memories from your existing photos.',
        microphonePermission: false,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
        },
      },
    ],
    'expo-font',
    'expo-image',
    'expo-web-browser',
  ].filter(Boolean),
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
} as ExpoConfig;

export default config;
