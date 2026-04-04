import { NativeModules, Platform } from 'react-native';

type AndroidSoftInputMode = 'pan' | 'resize';

type AndroidSoftInputModeModule = {
  setMode?: (mode: AndroidSoftInputMode) => Promise<boolean>;
};

function getAndroidSoftInputModeModule() {
  return (NativeModules as { NotoSoftInputModeModule?: AndroidSoftInputModeModule }).NotoSoftInputModeModule;
}

export async function setAndroidSoftInputMode(mode: AndroidSoftInputMode) {
  if (Platform.OS !== 'android') {
    return false;
  }

  const module = getAndroidSoftInputModeModule();
  if (!module?.setMode) {
    return false;
  }

  try {
    return Boolean(await module.setMode(mode));
  } catch (error) {
    console.warn(`[androidSoftInputMode] Failed to switch to ${mode}:`, error);
    return false;
  }
}
