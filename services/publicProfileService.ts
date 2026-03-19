import { doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import { getFirestore } from '../utils/firebase';

export interface PublicUserProfile {
  displayName: string | null;
  photoURL: string | null;
  updatedAt: string;
}

export interface PublicProfileSnapshot {
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
}

export function buildPublicProfileSnapshot(input: {
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
}): PublicProfileSnapshot {
  return {
    displayNameSnapshot: input.displayName?.trim() || null,
    photoURLSnapshot: input.photoURL ?? null,
  };
}

export async function upsertPublicUserProfile(input: {
  userUid: string;
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
}) {
  const firestore = getFirestore();
  if (!firestore) {
    return;
  }

  const now = new Date().toISOString();
  const { displayNameSnapshot, photoURLSnapshot } = buildPublicProfileSnapshot(input);

  await setDoc(
    doc(firestore, 'publicUserProfiles', input.userUid),
    {
      displayName: displayNameSnapshot,
      photoURL: photoURLSnapshot,
      updatedAt: now,
    } satisfies PublicUserProfile,
    { merge: true }
  );
}

export async function getPublicUserProfile(userUid: string): Promise<PublicProfileSnapshot> {
  const firestore = getFirestore();
  if (!firestore) {
    return {
      displayNameSnapshot: null,
      photoURLSnapshot: null,
    };
  }

  const snapshot = await getDoc(doc(firestore, 'publicUserProfiles', userUid));
  if (!snapshot.exists()) {
    return {
      displayNameSnapshot: null,
      photoURLSnapshot: null,
    };
  }

  const data = snapshot.data() as Partial<PublicUserProfile>;
  return buildPublicProfileSnapshot({
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
  });
}
