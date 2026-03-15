import { getApp, getApps, ReactNativeFirebase } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore as getModularFirestore } from '@react-native-firebase/firestore';

function getDefaultFirebaseApp(): ReactNativeFirebase.FirebaseApp | null {
  try {
    const apps = getApps();
    if (!apps.length) {
      return null;
    }

    return getApp();
  } catch {
    return null;
  }
}

export function hasFirebaseApp(): boolean {
  return getDefaultFirebaseApp() !== null;
}

export function getFirebaseAuth() {
  const app = getDefaultFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    return getAuth(app);
  } catch {
    return null;
  }
}

export function getFirestore() {
  const app = getDefaultFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    return getModularFirestore(app);
  } catch {
    return null;
  }
}
