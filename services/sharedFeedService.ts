import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Note, NoteType } from './database';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { readPhotoAsBase64, writePhotoFromBase64 } from './photoStorage';
import { getPublicUserProfile, upsertPublicUserProfile } from './publicProfileService';
import { getFirestore } from '../utils/firebase';

export interface FriendConnection {
  userId: string;
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
  friendedAt: string;
  lastSharedAt: string | null;
  createdByInviteId: string | null;
  createdByInviteToken: string | null;
}

export interface FriendInvite {
  id: string;
  inviterUid: string;
  inviterDisplayNameSnapshot: string | null;
  inviterPhotoURLSnapshot: string | null;
  token: string;
  createdAt: string;
  revokedAt: string | null;
  acceptedByUid: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  url: string;
}

export interface SharedPost {
  id: string;
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  audienceUserIds: string[];
  type: NoteType;
  text: string;
  photoLocalUri: string | null;
  photoRemoteBase64: string | null;
  placeName: string | null;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SharedFeedSnapshot {
  friends: FriendConnection[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
}

interface SubscribeToSharedFeedOptions {
  onSnapshot: (snapshot: SharedFeedSnapshot) => void;
  onError?: (error: unknown) => void;
}

interface FriendConnectionRecord {
  userId: string;
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
  friendedAt: string;
  lastSharedAt: string | null;
  createdByInviteId: string | null;
  createdByInviteToken: string | null;
}

interface FriendInviteRecord {
  inviterUid: string;
  inviterDisplayNameSnapshot: string | null;
  inviterPhotoURLSnapshot: string | null;
  token: string;
  createdAt: string;
  revokedAt: string | null;
  acceptedByUid: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
}

interface SharedPostRecord {
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  audienceUserIds: string[];
  type: NoteType;
  text: string;
  photoRemoteBase64: string | null;
  placeName: string | null;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const ACTIVE_FRIEND_INVITE_QUERY_LIMIT = 50;

function requireFirestore() {
  const firestore = getFirestore();
  if (!firestore) {
    throw new Error('Shared feed is unavailable in this build.');
  }

  return firestore;
}

function getNowIso() {
  return new Date().toISOString();
}

function getDisplayName(user: FirebaseAuthTypes.User) {
  return user.displayName?.trim() || user.email?.trim() || 'Noto user';
}

function isInviteActive(record: FriendInviteRecord, nowMs = Date.now()) {
  return (
    !record.revokedAt &&
    !record.acceptedByUid &&
    (!record.expiresAt || new Date(record.expiresAt).getTime() > nowMs)
  );
}

async function getFriendInviteDocumentId(userUid: string) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `noto-friend-invite:${userUid}`
  );

  return `friend-invite-${digest.slice(0, 24)}`;
}

function buildInviteUrl(inviteId: string, token: string) {
  return Linking.createURL('/friends/join', {
    queryParams: {
      inviteId,
      invite: token,
    },
  });
}

function mapInvite(id: string, record: FriendInviteRecord): FriendInvite {
  return {
    id,
    inviterUid: record.inviterUid,
    inviterDisplayNameSnapshot: record.inviterDisplayNameSnapshot ?? null,
    inviterPhotoURLSnapshot: record.inviterPhotoURLSnapshot ?? null,
    token: record.token,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt ?? null,
    acceptedByUid: record.acceptedByUid ?? null,
    acceptedAt: record.acceptedAt ?? null,
    expiresAt: record.expiresAt ?? null,
    url: buildInviteUrl(id, record.token),
  };
}

function parseInvitePayload(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { inviteId: '', token: '' };
  }

  const parsed = Linking.parse(trimmed);
  const maybeInviteId = parsed.queryParams?.inviteId;
  const maybeToken = parsed.queryParams?.invite;

  if (typeof maybeInviteId === 'string' && maybeInviteId.trim()) {
    return {
      inviteId: maybeInviteId.trim(),
      token: typeof maybeToken === 'string' ? maybeToken.trim() : '',
    };
  }

  return {
    inviteId: '',
    token: trimmed,
  };
}

async function serializeSharedPhoto(photoUri?: string | null) {
  if (!photoUri?.trim()) {
    return null;
  }

  return readPhotoAsBase64(photoUri);
}

async function hydrateSharedPostPhoto(postId: string, photoRemoteBase64?: string | null) {
  if (!photoRemoteBase64?.trim()) {
    return null;
  }

  return writePhotoFromBase64(`shared-post-${postId}`, photoRemoteBase64);
}

async function mapSharedPost(id: string, record: SharedPostRecord): Promise<SharedPost> {
  const photoLocalUri =
    record.type === 'photo'
      ? await hydrateSharedPostPhoto(id, record.photoRemoteBase64)
      : null;

  return {
    id,
    authorUid: record.authorUid,
    authorDisplayName: record.authorDisplayName ?? null,
    authorPhotoURLSnapshot: record.authorPhotoURLSnapshot ?? null,
    audienceUserIds: Array.isArray(record.audienceUserIds) ? record.audienceUserIds : [],
    type: record.type,
    text: record.text ?? '',
    photoLocalUri,
    photoRemoteBase64: record.photoRemoteBase64 ?? null,
    placeName: record.placeName ?? null,
    sourceNoteId: record.sourceNoteId ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}

async function getUserProfileSnapshot(userUid: string) {
  return getPublicUserProfile(userUid);
}

async function getFriendsForUser(userUid: string) {
  const firestore = requireFirestore();
  const snapshot = await getDocs(
    query(collection(firestore, 'users', userUid, 'friends'), orderBy('friendedAt', 'asc'))
  );

  return snapshot.docs.map((item: { id: string; data: () => unknown }) => {
    const data = item.data() as FriendConnectionRecord;
    return {
      userId: data.userId ?? item.id,
      displayNameSnapshot: data.displayNameSnapshot ?? null,
      photoURLSnapshot: data.photoURLSnapshot ?? null,
      friendedAt: data.friendedAt,
      lastSharedAt: data.lastSharedAt ?? null,
      createdByInviteId: data.createdByInviteId ?? null,
      createdByInviteToken: data.createdByInviteToken ?? null,
    } satisfies FriendConnection;
  });
}

export function getSharedFeedErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : null;
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'Shared moments are unavailable right now.';

  if (code === 'firestore/permission-denied' || message.includes('permission-denied')) {
    return 'Shared moments need Firestore security rules before this action can work in production.';
  }

  if (code === 'firestore/unavailable') {
    return 'Firestore is unavailable right now. Check your connection and try again.';
  }

  if (code === 'firestore/failed-precondition' || message.includes('requires an index')) {
    return 'Shared moments need Firestore indexes before this screen can finish loading. Deploy the shared feed indexes and try again in a minute.';
  }

  return message;
}

export async function getActiveFriendInvite(user: FirebaseAuthTypes.User): Promise<FriendInvite | null> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'friendInvites'),
      where('inviterUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(ACTIVE_FRIEND_INVITE_QUERY_LIMIT)
    )
  );

  const inviteDoc = snapshot.docs
    .map((item: { id: string; data: () => unknown }) => ({
      id: item.id,
      ...(item.data() as FriendInviteRecord),
    }))
    .find((item: FriendInviteRecord) => isInviteActive(item));

  return inviteDoc ? mapInvite(inviteDoc.id, inviteDoc) : null;
}

export async function refreshSharedFeed(user: FirebaseAuthTypes.User): Promise<SharedFeedSnapshot> {
  const firestore = requireFirestore();
  const friends = await getFriendsForUser(user.uid);
  const friendUids = friends.map((friend: FriendConnection) => friend.userId);
  const authorWhitelist = [user.uid, ...friendUids].slice(0, 30);

  const [activeInvite, postsSnapshot] = await Promise.all([
    getActiveFriendInvite(user),
    getDocs(
      query(
        collection(firestore, 'sharedPosts'),
        where('audienceUserIds', 'array-contains', user.uid),
        where('authorUid', 'in', authorWhitelist),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
    ),
  ]);

  const sharedPosts = await Promise.all(
    postsSnapshot.docs.map((item: { id: string; data: () => unknown }) =>
      mapSharedPost(item.id, item.data() as SharedPostRecord)
    )
  );

  return {
    friends,
    sharedPosts,
    activeInvite,
  };
}

export function subscribeToSharedFeed(
  user: FirebaseAuthTypes.User,
  { onSnapshot: handleSnapshot, onError }: SubscribeToSharedFeedOptions
) {
  const firestore = requireFirestore();
  let disposed = false;
  let latestPostsVersion = 0;
  let initialFriendsLoaded = false;
  let initialInviteLoaded = false;
  let initialPostsLoaded = false;
  let unsubscribeSharedPosts: (() => void) | null = null;
  let currentSnapshot: SharedFeedSnapshot = {
    friends: [],
    sharedPosts: [],
    activeInvite: null,
  };

  const emitIfReady = () => {
    if (disposed || !initialFriendsLoaded || !initialInviteLoaded || !initialPostsLoaded) {
      return;
    }

    handleSnapshot({
      friends: currentSnapshot.friends,
      sharedPosts: currentSnapshot.sharedPosts,
      activeInvite: currentSnapshot.activeInvite,
    });
  };

  const handleFailure = (error: unknown) => {
    if (!disposed) {
      onError?.(error);
    }
  };

  const resubscribePosts = (friends: FriendConnection[]) => {
    if (unsubscribeSharedPosts) {
      unsubscribeSharedPosts();
    }

    const friendUids = friends.map((friend: FriendConnection) => friend.userId);
    const authorWhitelist = [user.uid, ...friendUids].slice(0, 30);

    unsubscribeSharedPosts = onSnapshot(
      query(
        collection(firestore, 'sharedPosts'),
        where('audienceUserIds', 'array-contains', user.uid),
        where('authorUid', 'in', authorWhitelist),
        orderBy('createdAt', 'desc'),
        limit(20)
      ),
      async (postsSnapshot) => {
        const version = latestPostsVersion + 1;
        latestPostsVersion = version;

        try {
          const sharedPosts = await Promise.all(
            postsSnapshot.docs.map((item: { id: string; data: () => unknown }) =>
              mapSharedPost(item.id, item.data() as SharedPostRecord)
            )
          );

          if (disposed || version !== latestPostsVersion) {
            return;
          }

          currentSnapshot = {
            ...currentSnapshot,
            sharedPosts,
          };
          initialPostsLoaded = true;
          emitIfReady();
        } catch (error) {
          handleFailure(error);
        }
      },
      handleFailure
    );
  };

  const unsubscribeFriends = onSnapshot(
    query(collection(firestore, 'users', user.uid, 'friends'), orderBy('friendedAt', 'asc')),
    (friendsSnapshot) => {
      const nextFriends = friendsSnapshot.docs.map((item: { id: string; data: () => unknown }) => {
        const data = item.data() as FriendConnectionRecord;
        return {
          userId: data.userId ?? item.id,
          displayNameSnapshot: data.displayNameSnapshot ?? null,
          photoURLSnapshot: data.photoURLSnapshot ?? null,
          friendedAt: data.friendedAt,
          lastSharedAt: data.lastSharedAt ?? null,
          createdByInviteId: data.createdByInviteId ?? null,
          createdByInviteToken: data.createdByInviteToken ?? null,
        } satisfies FriendConnection;
      });

      currentSnapshot = {
        ...currentSnapshot,
        friends: nextFriends,
      };
      initialFriendsLoaded = true;

      // When friends change, we must resubscribe to posts because the authorWhitelist depends on friends.
      resubscribePosts(nextFriends);
    },
    handleFailure
  );

  const unsubscribeActiveInvite = onSnapshot(
    query(
      collection(firestore, 'friendInvites'),
      where('inviterUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(ACTIVE_FRIEND_INVITE_QUERY_LIMIT)
    ),
    (inviteSnapshot) => {
      const inviteDoc = inviteSnapshot.docs
        .map((item: { id: string; data: () => unknown }) => ({
          id: item.id,
          ...(item.data() as FriendInviteRecord),
        }))
        .find((item: FriendInviteRecord) => isInviteActive(item));

      currentSnapshot = {
        ...currentSnapshot,
        activeInvite: inviteDoc ? mapInvite(inviteDoc.id, inviteDoc) : null,
      };
      initialInviteLoaded = true;
      emitIfReady();
    },
    handleFailure
  );

  return () => {
    disposed = true;
    unsubscribeFriends();
    unsubscribeActiveInvite();
    if (unsubscribeSharedPosts) {
      unsubscribeSharedPosts();
    }
  };
}

export async function createFriendInvite(user: FirebaseAuthTypes.User): Promise<FriendInvite> {
  const firestore = requireFirestore();

  await upsertPublicUserProfile({
    userUid: user.uid,
    displayName: getDisplayName(user),
    photoURL: user.photoURL ?? null,
  });

  const existingInvite = await getActiveFriendInvite(user);
  if (existingInvite) {
    return existingInvite;
  }

  const inviteId = await getFriendInviteDocumentId(user.uid);
  const inviteRef = doc(firestore, 'friendInvites', inviteId);

  return runTransaction(firestore, async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    const currentInvite = inviteSnapshot.exists()
      ? (inviteSnapshot.data() as FriendInviteRecord)
      : null;

    if (currentInvite && isInviteActive(currentInvite)) {
      return mapInvite(inviteId, currentInvite);
    }

    const nextInvite: FriendInviteRecord = {
      inviterUid: user.uid,
      inviterDisplayNameSnapshot: getDisplayName(user),
      inviterPhotoURLSnapshot: user.photoURL ?? null,
      token: Crypto.randomUUID(),
      createdAt: getNowIso(),
      revokedAt: null,
      acceptedByUid: null,
      acceptedAt: null,
      expiresAt: null,
    };

    transaction.set(inviteRef, nextInvite);
    return mapInvite(inviteId, nextInvite);
  });
}

export async function revokeFriendInvite(user: FirebaseAuthTypes.User, inviteId: string): Promise<void> {
  const firestore = requireFirestore();
  const inviteRef = doc(firestore, 'friendInvites', inviteId);
  const inviteSnapshot = await getDoc(inviteRef);

  if (!inviteSnapshot.exists()) {
    throw new Error('Invite not found.');
  }

  const data = inviteSnapshot.data() as FriendInviteRecord;
  if (data.inviterUid !== user.uid) {
    throw new Error('Only the inviter can revoke this link.');
  }

  await updateDoc(inviteRef, {
    revokedAt: getNowIso(),
  });
}

export async function acceptFriendInvite(
  user: FirebaseAuthTypes.User,
  inviteValue: string
): Promise<FriendConnection> {
  const firestore = requireFirestore();
  const { inviteId, token } = parseInvitePayload(inviteValue);

  if (!inviteId && !token) {
    throw new Error('Paste a valid invite link.');
  }

  if (!token) {
    throw new Error('This invite link is invalid.');
  }

  let resolvedInviteId = inviteId;
  let inviteSnapshot;

  if (resolvedInviteId) {
    inviteSnapshot = await getDoc(doc(firestore, 'friendInvites', resolvedInviteId));
  } else {
    const inviteQuery = await getDocs(
      query(collection(firestore, 'friendInvites'), where('token', '==', token), limit(1))
    );
    const inviteDoc = inviteQuery.docs[0];
    if (inviteDoc) {
      resolvedInviteId = inviteDoc.id;
      inviteSnapshot = inviteDoc;
    }
  }

  if (!inviteSnapshot || !inviteSnapshot.exists()) {
    throw new Error('Invite not found.');
  }

  const invite = inviteSnapshot.data() as FriendInviteRecord;
  if (invite.revokedAt) {
    throw new Error('This invite link is no longer active.');
  }
  if (invite.acceptedByUid && invite.acceptedByUid !== user.uid) {
    throw new Error('This invite link has already been used.');
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw new Error('This invite link has expired.');
  }
  if (invite.token !== token && token) {
    throw new Error('This invite link is invalid.');
  }
  if (invite.inviterUid === user.uid) {
    throw new Error('You cannot accept your own invite.');
  }

  const now = getNowIso();
  await upsertPublicUserProfile({
    userUid: user.uid,
    displayName: getDisplayName(user),
    photoURL: user.photoURL ?? null,
  });
  const inviterProfile = await getUserProfileSnapshot(invite.inviterUid);

  const currentUserConnection: FriendConnectionRecord = {
    userId: invite.inviterUid,
    displayNameSnapshot:
      inviterProfile.displayNameSnapshot ?? invite.inviterDisplayNameSnapshot ?? null,
    photoURLSnapshot:
      inviterProfile.photoURLSnapshot ?? invite.inviterPhotoURLSnapshot ?? null,
    friendedAt: now,
    lastSharedAt: null,
    createdByInviteId: resolvedInviteId,
    createdByInviteToken: token,
  };

  const inviterConnection: FriendConnectionRecord = {
    userId: user.uid,
    displayNameSnapshot: getDisplayName(user),
    photoURLSnapshot: user.photoURL ?? null,
    friendedAt: now,
    lastSharedAt: null,
    createdByInviteId: resolvedInviteId,
    createdByInviteToken: token,
  };

  await Promise.all([
    setDoc(doc(firestore, 'users', user.uid, 'friends', invite.inviterUid), currentUserConnection, {
      merge: true,
    }),
    setDoc(doc(firestore, 'users', invite.inviterUid, 'friends', user.uid), inviterConnection, {
      merge: true,
    }),
    updateDoc(doc(firestore, 'friendInvites', resolvedInviteId), {
      acceptedByUid: user.uid,
      acceptedAt: now,
    }),
  ]);

  return {
    userId: currentUserConnection.userId,
    displayNameSnapshot: currentUserConnection.displayNameSnapshot,
    photoURLSnapshot: currentUserConnection.photoURLSnapshot,
    friendedAt: currentUserConnection.friendedAt,
    lastSharedAt: currentUserConnection.lastSharedAt,
    createdByInviteId: currentUserConnection.createdByInviteId,
    createdByInviteToken: currentUserConnection.createdByInviteToken,
  };
}

export async function removeFriend(user: FirebaseAuthTypes.User, friendUid: string): Promise<void> {
  const firestore = requireFirestore();

  await Promise.all([
    deleteDoc(doc(firestore, 'users', user.uid, 'friends', friendUid)),
    deleteDoc(doc(firestore, 'users', friendUid, 'friends', user.uid)),
  ]);
}

export async function createSharedPost(
  user: FirebaseAuthTypes.User,
  note: Note,
  audienceUserIds: string[]
): Promise<SharedPost> {
  const firestore = requireFirestore();
  const dedupedAudience = Array.from(new Set(audienceUserIds.filter(Boolean)));

  if (dedupedAudience.length <= 1) {
    throw new Error('Connect a friend before sharing moments.');
  }

  const postId = `shared-post-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
  const now = getNowIso();
  const photoRemoteBase64 =
    note.type === 'photo' ? await serializeSharedPhoto(note.photoLocalUri ?? note.content) : null;

  const record: SharedPostRecord = {
    authorUid: user.uid,
    authorDisplayName: getDisplayName(user),
    authorPhotoURLSnapshot: user.photoURL ?? null,
    audienceUserIds: dedupedAudience,
    type: note.type,
    text: note.type === 'text' ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji) : '',
    photoRemoteBase64: photoRemoteBase64 ?? null,
    placeName: note.locationName ?? null,
    sourceNoteId: note.id,
    createdAt: now,
    updatedAt: null,
  };

  await setDoc(doc(firestore, 'sharedPosts', postId), record);

  const friendRefs = dedupedAudience.filter((uid) => uid !== user.uid);
  if (friendRefs.length > 0) {
    await Promise.all(
      friendRefs.map((friendUid) =>
        updateDoc(doc(firestore, 'users', user.uid, 'friends', friendUid), {
          lastSharedAt: now,
        }).catch(() => undefined)
      )
    );
  }

  return mapSharedPost(postId, record);
}

export async function updateSharedPost(
  user: FirebaseAuthTypes.User,
  postId: string,
  note: Note
): Promise<void> {
  const firestore = requireFirestore();
  const photoRemoteBase64 =
    note.type === 'photo' ? await serializeSharedPhoto(note.photoLocalUri ?? note.content) : null;

  await updateDoc(doc(firestore, 'sharedPosts', postId), {
    text: note.type === 'text' ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji) : '',
    photoRemoteBase64: photoRemoteBase64 ?? null,
    placeName: note.locationName ?? null,
    updatedAt: getNowIso(),
    authorUid: user.uid,
  });
}

export async function findOwnedSharedPostIdsForNote(
  user: FirebaseAuthTypes.User,
  noteId: string
): Promise<string[]> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(
    query(collection(firestore, 'sharedPosts'), where('authorUid', '==', user.uid))
  );

  return snapshot.docs
    .filter((item: { data: () => unknown }) => {
      const data = item.data() as SharedPostRecord;
      return data.sourceNoteId === noteId;
    })
    .map((item: { id: string }) => item.id);
}

export async function deleteSharedPost(
  _user: FirebaseAuthTypes.User,
  postId: string
): Promise<void> {
  const firestore = requireFirestore();
  await deleteDoc(doc(firestore, 'sharedPosts', postId));
}
