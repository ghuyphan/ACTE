import app from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// React Native Firebase automatically initializes using the native 
// google-services.json (Android) and GoogleService-Info.plist (iOS) files.
// We simply initialize the services we need and export them.

const firebaseAuth = auth();
const firebaseDb = firestore();

// Optional: Enable offline persistence explicitly (usually enabled by default on mobile)
// firebaseDb.settings({ persistence: true });

export { app, firebaseAuth as auth, firebaseDb as db };
