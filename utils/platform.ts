import { Platform } from 'react-native';

// Checks if the active device is running an iOS version <= 18, 
// where advanced materials like 'systemChromeMaterial' or certain UIVisualEffectView behaviors
// may fail or appear completely transparent.
export const isOlderIOS = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) <= 18;

// Native tab search input in Expo Router requires iOS 26+ behavior.
export const isIOS26OrNewer = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
