import { existsSync } from 'node:fs';
import type { ExpoConfig } from 'expo/config';

const googleMapsAndroidApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ?? '82e9519b-f89b-466e-af4d-697349535c13';
const easUpdateUrl = `https://u.expo.dev/${easProjectId}`;
const rootGoogleServicesFile = './google-services.json';
const nativeAndroidGoogleServicesFile = './android/app/google-services.json';
const rootGoogleServiceInfoPlist = './GoogleService-Info.plist';
const nativeIosGoogleServiceInfoPlist = './ios/Noto/GoogleService-Info.plist';
const androidGoogleServicesFile = existsSync(rootGoogleServicesFile)
  ? rootGoogleServicesFile
  : existsSync(nativeAndroidGoogleServicesFile)
    ? nativeAndroidGoogleServicesFile
    : undefined;
const iosGoogleServicesFile = existsSync(rootGoogleServiceInfoPlist)
  ? rootGoogleServiceInfoPlist
  : existsSync(nativeIosGoogleServiceInfoPlist)
    ? nativeIosGoogleServiceInfoPlist
    : undefined;
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/i, '')}`
  : '';
const notoSansFontDefinitions = [
  {
    path: './node_modules/@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf',
    weight: 400,
  },
  {
    path: './node_modules/@expo-google-fonts/noto-sans/500Medium/NotoSans_500Medium.ttf',
    weight: 500,
  },
  {
    path: './node_modules/@expo-google-fonts/noto-sans/600SemiBold/NotoSans_600SemiBold.ttf',
    weight: 600,
  },
  {
    path: './node_modules/@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf',
    weight: 700,
  },
  {
    path: './node_modules/@expo-google-fonts/noto-sans/800ExtraBold/NotoSans_800ExtraBold.ttf',
    weight: 800,
  },
  {
    path: './node_modules/@expo-google-fonts/noto-sans/900Black/NotoSans_900Black.ttf',
    weight: 900,
  },
] as const;

const config = {
  name: 'Noto',
  slug: 'noto',
  version: '1.0.0',
  runtimeVersion: {
    policy: 'appVersion',
  },
  orientation: 'portrait',
  icon: './assets/images/icon/icon-default.png',
  scheme: 'noto',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    enabled: true,
    url: easUpdateUrl,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.acte.app',
    icon: './Untitled.icon',
    googleServicesFile: iosGoogleServicesFile,
  },
  android: {
    package: 'com.acte.app',
    googleServicesFile: androidGoogleServicesFile,
    adaptiveIcon: {
      backgroundColor: '#F7F2EB',
      foregroundImage: './assets/images/icon/icon-android-foreground.png',
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
          image: './assets/images/icon/icon-dark.png',
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
    [
      'expo-font',
      {
        ios: {
          fonts: notoSansFontDefinitions.map((font) => font.path),
        },
        android: {
          fonts: [
            {
              fontFamily: 'Noto Sans',
              fontDefinitions: notoSansFontDefinitions,
            },
          ],
        },
      },
    ],
    'expo-image',
    'expo-web-browser',
  ].filter(Boolean),
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: easProjectId,
    },
  },
} as ExpoConfig;

export default config;
