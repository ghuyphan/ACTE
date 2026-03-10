import firebaseApp from '@react-native-firebase/app';
import authModule from '@react-native-firebase/auth';
import firestoreModule from '@react-native-firebase/firestore';

export function hasFirebaseApp(): boolean {
  try {
    const apps = (firebaseApp as unknown as { apps?: unknown[] }).apps;
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

export function getFirebaseAuth() {
  if (!hasFirebaseApp()) {
    return null;
  }

  try {
    return authModule();
  } catch {
    return null;
  }
}

export function getFirestore() {
  if (!hasFirebaseApp()) {
    return null;
  }

  try {
    return firestoreModule();
  } catch {
    return null;
  }
}

export { firebaseApp };
