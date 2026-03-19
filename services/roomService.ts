import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import {
  collection,
  deleteDoc,
  doc,
  FirebaseFirestoreTypes,
  getDoc,
  getDocs,
  limit,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
} from '@react-native-firebase/firestore';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Note } from './database';
import {
  clearCachedRoom,
  getCachedRoomMembers,
  getCachedRoomPosts,
  getCachedRooms,
  replaceCachedRoomMembers,
  replaceCachedRoomPosts,
  replaceCachedRooms,
  RoomMember,
  RoomPost,
  RoomRole,
  RoomSummary,
  setCachedRoomReadState,
  upsertCachedRoom,
} from './roomCache';
import { readPhotoAsBase64, writePhotoFromBase64 } from './photoStorage';
import { getFirestore } from '../utils/firebase';

export interface RoomInvite {
  id: string;
  roomId: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  url: string;
}

interface RoomRecord {
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  lastPostAt: string | null;
  coverPhotoUrl?: string | null;
}

interface RoomMembershipRecord {
  roomId: string;
  userId: string;
  role: RoomRole;
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
  joinedAt: string;
  lastReadAt: string | null;
  joinedViaInviteId?: string | null;
  joinedViaInviteToken?: string | null;
}

interface RoomMembershipIndexRecord {
  roomId: string;
  joinedAt: string;
  role: RoomRole;
}

interface RoomPostRecord {
  roomId: string;
  authorId: string;
  authorDisplayName: string | null;
  origin: RoomPost['origin'];
  type: RoomPost['type'];
  text: string;
  photoRemoteBase64: string | null;
  placeName: string | null;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface RoomInviteRecord {
  roomId: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

type FirestoreDocument = FirebaseFirestoreTypes.DocumentData;
type FirestoreSnapshot = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirestoreDocument>;

export interface RoomDetails {
  room: RoomSummary;
  members: RoomMember[];
  posts: RoomPost[];
  activeInvite: RoomInvite | null;
}

export interface CreateRoomPostInput {
  text?: string;
  placeName?: string | null;
  photoLocalUri?: string | null;
}

export function getRoomErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : null;
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'Shared rooms are unavailable right now.';

  if (code === 'firestore/permission-denied' || message.includes('permission-denied')) {
    return 'Shared rooms need Firestore security rules before this action can work in production.';
  }

  if (code === 'firestore/unavailable') {
    return 'Firestore is unavailable right now. Check your connection and try again.';
  }

  return message;
}

function getNowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
}

function requireFirestore() {
  const firestore = getFirestore();
  if (!firestore) {
    throw new Error('Rooms are unavailable in this build.');
  }

  return firestore;
}

function getDisplayName(user: FirebaseAuthTypes.User) {
  return user.displayName?.trim() || user.email?.trim() || 'Noto user';
}

function parseInvitePayload(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return {
      roomId: '',
      inviteId: '',
      token: '',
    };
  }

  const parsed = Linking.parse(trimmed);
  const maybeRoomId = parsed.queryParams?.roomId;
  const maybeInviteId = parsed.queryParams?.inviteId;
  const maybeToken = parsed.queryParams?.invite;

  if (
    typeof maybeRoomId === 'string' &&
    maybeRoomId.trim() &&
    typeof maybeInviteId === 'string' &&
    maybeInviteId.trim()
  ) {
    return {
      roomId: maybeRoomId.trim(),
      inviteId: maybeInviteId.trim(),
      token: typeof maybeToken === 'string' ? maybeToken.trim() : '',
    };
  }

  return {
    roomId: '',
    inviteId: '',
    token: '',
  };
}

function mapRoomSummary(
  roomId: string,
  roomRecord: RoomRecord,
  role: RoomRole,
  memberCount: number,
  lastPostPreview: string | null
): RoomSummary {
  return {
    id: roomId,
    name: roomRecord.name,
    ownerId: roomRecord.ownerId,
    createdAt: roomRecord.createdAt,
    updatedAt: roomRecord.updatedAt,
    lastPostAt: roomRecord.lastPostAt ?? null,
    coverPhotoUrl: roomRecord.coverPhotoUrl ?? null,
    currentUserRole: role,
    memberCount,
    lastPostPreview,
  };
}

async function getRoomMemberCount(roomId: string) {
  const firestore = requireFirestore();
  const snapshot = await getDocs(collection(firestore, 'rooms', roomId, 'members'));
  return snapshot.docs.length;
}

async function getLatestPostPreview(roomId: string) {
  const firestore = requireFirestore();
  const snapshot = await getDocs(
    query(collection(firestore, 'rooms', roomId, 'posts'), orderBy('createdAt', 'desc'), limit(1))
  );
  const latestDoc = snapshot.docs[0];
  if (!latestDoc) {
    return null;
  }

  const latestData = latestDoc.data() as Partial<RoomPostRecord>;
  if (latestData.type === 'photo') {
    return 'Photo';
  }

  return typeof latestData.text === 'string' && latestData.text.trim()
    ? latestData.text.trim()
    : null;
}

async function getActiveInviteRecord(roomId: string): Promise<RoomInvite | null> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(
    query(collection(firestore, 'rooms', roomId, 'invites'), orderBy('createdAt', 'desc'), limit(10))
  );

  const inviteDoc = snapshot.docs
    .map((item: FirestoreSnapshot) => ({ id: item.id, ...(item.data() as RoomInviteRecord) }))
    .find(
      (item: RoomInviteRecord & { id: string }) =>
        !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now())
    );

  if (!inviteDoc) {
    return null;
  }

  return {
    id: inviteDoc.id,
    roomId,
    token: inviteDoc.token,
    createdBy: inviteDoc.createdBy,
    createdAt: inviteDoc.createdAt,
    expiresAt: inviteDoc.expiresAt ?? null,
    revokedAt: inviteDoc.revokedAt ?? null,
    url: Linking.createURL('/rooms/join', {
      queryParams: {
        roomId,
        inviteId: inviteDoc.id,
        invite: inviteDoc.token,
      },
    }),
  };
}

async function serializeRoomPostPhoto(photoLocalUri?: string | null) {
  if (!photoLocalUri) {
    return null;
  }

  return readPhotoAsBase64(photoLocalUri);
}

async function hydrateRoomPostPhoto(postId: string, photoRemoteBase64?: string | null) {
  if (!photoRemoteBase64) {
    return null;
  }

  return writePhotoFromBase64(`room-post-${postId}`, photoRemoteBase64);
}

async function fetchRoomRecord(roomId: string) {
  const firestore = requireFirestore();
  const roomSnapshot = await getDoc(doc(firestore, 'rooms', roomId));
  if (!roomSnapshot.exists()) {
    return null;
  }

  return roomSnapshot.data() as RoomRecord;
}

async function ensureMembership(roomId: string, userUid: string) {
  const firestore = requireFirestore();
  const membershipSnapshot = await getDoc(doc(firestore, 'rooms', roomId, 'members', userUid));
  if (!membershipSnapshot.exists()) {
    throw new Error('You no longer have access to this room.');
  }

  return membershipSnapshot.data() as RoomMembershipRecord;
}

async function updateMembershipIndex(
  userUid: string,
  roomId: string,
  record: RoomMembershipIndexRecord | null
) {
  const firestore = requireFirestore();
  const indexRef = doc(firestore, 'users', userUid, 'roomMemberships', roomId);
  if (!record) {
    await deleteDoc(indexRef);
    return;
  }

  await setDoc(
    indexRef,
    {
      ...record,
      syncedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function buildRoomSummary(roomId: string, role: RoomRole) {
  const roomRecord = await fetchRoomRecord(roomId);
  if (!roomRecord) {
    return null;
  }

  const [memberCount, lastPostPreview] = await Promise.all([
    getRoomMemberCount(roomId),
    getLatestPostPreview(roomId),
  ]);

  return mapRoomSummary(roomId, roomRecord, role, memberCount, lastPostPreview);
}

export async function loadCachedRooms(userUid: string) {
  return getCachedRooms(userUid);
}

export async function loadCachedRoomDetails(userUid: string, roomId: string): Promise<RoomDetails | null> {
  const rooms = await getCachedRooms(userUid);
  const room = rooms.find((item) => item.id === roomId);
  if (!room) {
    return null;
  }

  const [members, posts] = await Promise.all([
    getCachedRoomMembers(userUid, roomId),
    getCachedRoomPosts(userUid, roomId),
  ]);

  return {
    room,
    members,
    posts,
    activeInvite: null,
  };
}

export async function refreshRooms(user: FirebaseAuthTypes.User): Promise<RoomSummary[]> {
  const firestore = requireFirestore();
  const membershipSnapshot = await getDocs(collection(firestore, 'users', user.uid, 'roomMemberships'));
  const roomIds = membershipSnapshot.docs.map((item: FirestoreSnapshot) => {
    const data = item.data() as RoomMembershipIndexRecord;
    return {
      roomId: item.id,
      role: data.role ?? 'member',
    };
  });

  const rooms = (
    await Promise.all(
      roomIds.map(async ({ roomId, role }: { roomId: string; role: RoomRole }) =>
        buildRoomSummary(roomId, role)
      )
    )
  ).filter(Boolean) as RoomSummary[];

  await replaceCachedRooms(user.uid, rooms);
  return rooms;
}

export async function getRoomDetails(
  user: FirebaseAuthTypes.User,
  roomId: string
): Promise<RoomDetails> {
  const membership = await ensureMembership(roomId, user.uid);
  const room = await buildRoomSummary(roomId, membership.role);
  if (!room) {
    throw new Error('Room not found.');
  }

  const firestore = requireFirestore();
  const [memberSnapshot, postSnapshot, activeInvite] = await Promise.all([
    getDocs(query(collection(firestore, 'rooms', roomId, 'members'), orderBy('joinedAt', 'asc'))),
    getDocs(query(collection(firestore, 'rooms', roomId, 'posts'), orderBy('createdAt', 'desc'))),
    membership.role === 'owner' ? getActiveInviteRecord(roomId) : Promise.resolve(null),
  ]);

  const members = memberSnapshot.docs.map((item: FirestoreSnapshot) => {
    const data = item.data() as RoomMembershipRecord;
    return {
      roomId,
      userId: item.id,
      role: data.role,
      displayNameSnapshot: data.displayNameSnapshot ?? null,
      photoURLSnapshot: data.photoURLSnapshot ?? null,
      joinedAt: data.joinedAt,
      lastReadAt: data.lastReadAt ?? null,
    } satisfies RoomMember;
  });

  const posts = await Promise.all(
    postSnapshot.docs.map(async (item: FirestoreSnapshot) => {
      const data = item.data() as RoomPostRecord;
      const photoLocalUri = await hydrateRoomPostPhoto(item.id, data.photoRemoteBase64);
      return {
        id: item.id,
        roomId,
        authorId: data.authorId,
        authorDisplayName: data.authorDisplayName ?? null,
        origin: data.origin,
        type: data.type,
        text: data.text ?? '',
        photoLocalUri,
        photoRemoteBase64: data.photoRemoteBase64 ?? null,
        placeName: data.placeName ?? null,
        sourceNoteId: data.sourceNoteId ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt ?? null,
      } satisfies RoomPost;
    })
  );

  await upsertCachedRoom(user.uid, room);
  await replaceCachedRoomMembers(user.uid, roomId, members);
  await replaceCachedRoomPosts(user.uid, roomId, posts);
  await setCachedRoomReadState(user.uid, roomId, getNowIso());
  await updateDoc(doc(firestore, 'rooms', roomId, 'members', user.uid), {
    lastReadAt: getNowIso(),
  }).catch(() => undefined);

  return {
    room,
    members,
    posts,
    activeInvite,
  };
}

export async function createRoom(user: FirebaseAuthTypes.User, name: string) {
  const firestore = requireFirestore();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Enter a room name.');
  }

  const roomId = generateId('room');
  const now = getNowIso();
  const roomRecord: RoomRecord = {
    name: normalizedName,
    ownerId: user.uid,
    createdAt: now,
    updatedAt: now,
    lastPostAt: null,
    coverPhotoUrl: null,
  };
  const membership: RoomMembershipRecord = {
    roomId,
    userId: user.uid,
    role: 'owner',
    displayNameSnapshot: getDisplayName(user),
    photoURLSnapshot: user.photoURL ?? null,
    joinedAt: now,
    lastReadAt: now,
    joinedViaInviteId: null,
    joinedViaInviteToken: null,
  };

  await setDoc(doc(firestore, 'rooms', roomId), {
    ...roomRecord,
    syncedAt: serverTimestamp(),
  });
  await setDoc(doc(firestore, 'rooms', roomId, 'members', user.uid), membership);
  await updateMembershipIndex(user.uid, roomId, {
    roomId,
    joinedAt: now,
    role: 'owner',
  });

  const room = mapRoomSummary(roomId, roomRecord, 'owner', 1, null);
  await upsertCachedRoom(user.uid, room);
  await replaceCachedRoomMembers(user.uid, roomId, [membership]);
  await replaceCachedRoomPosts(user.uid, roomId, []);
  await setCachedRoomReadState(user.uid, roomId, now);

  return room;
}

export async function renameRoom(
  user: FirebaseAuthTypes.User,
  roomId: string,
  nextName: string
): Promise<RoomSummary> {
  const membership = await ensureMembership(roomId, user.uid);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can rename this room.');
  }

  const normalizedName = nextName.trim();
  if (!normalizedName) {
    throw new Error('Enter a room name.');
  }

  const now = getNowIso();
  await updateDoc(doc(requireFirestore(), 'rooms', roomId), {
    name: normalizedName,
    updatedAt: now,
    syncedAt: serverTimestamp(),
  });

  const updatedRoom = await buildRoomSummary(roomId, membership.role);
  if (!updatedRoom) {
    throw new Error('Room not found.');
  }

  await upsertCachedRoom(user.uid, updatedRoom);
  return updatedRoom;
}

export async function createRoomInvite(user: FirebaseAuthTypes.User, roomId: string): Promise<RoomInvite> {
  const membership = await ensureMembership(roomId, user.uid);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can create invites.');
  }

  const inviteId = generateId('invite');
  const token = Crypto.randomUUID();
  const now = getNowIso();
  await setDoc(doc(requireFirestore(), 'rooms', roomId, 'invites', inviteId), {
    roomId,
    token,
    createdBy: user.uid,
    createdAt: now,
    expiresAt: null,
    revokedAt: null,
  } satisfies RoomInviteRecord);

  return {
    id: inviteId,
    roomId,
    token,
    createdBy: user.uid,
    createdAt: now,
    expiresAt: null,
    revokedAt: null,
    url: Linking.createURL('/rooms/join', {
      queryParams: {
        roomId,
        inviteId,
        invite: token,
      },
    }),
  };
}

export async function revokeRoomInvite(
  user: FirebaseAuthTypes.User,
  roomId: string,
  inviteId: string
): Promise<void> {
  const membership = await ensureMembership(roomId, user.uid);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can revoke invites.');
  }

  await updateDoc(doc(requireFirestore(), 'rooms', roomId, 'invites', inviteId), {
    revokedAt: getNowIso(),
  });
}

export async function joinRoomByInvite(user: FirebaseAuthTypes.User, inviteValue: string) {
  const { roomId, inviteId, token } = parseInvitePayload(inviteValue);
  if (!roomId || !inviteId || !token) {
    throw new Error('Paste a valid invite link.');
  }

  const firestore = requireFirestore();
  const inviteSnapshot = await getDoc(doc(firestore, 'rooms', roomId, 'invites', inviteId));
  if (!inviteSnapshot.exists()) {
    throw new Error('Invite not found.');
  }

  const invite = inviteSnapshot.data() as RoomInviteRecord;
  if (invite.revokedAt) {
    throw new Error('This invite link is no longer active.');
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw new Error('This invite link has expired.');
  }
  if (invite.token !== token) {
    throw new Error('This invite link is invalid.');
  }

  const now = getNowIso();
  const memberRecord: RoomMembershipRecord = {
    roomId,
    userId: user.uid,
    role: 'member',
    displayNameSnapshot: getDisplayName(user),
    photoURLSnapshot: user.photoURL ?? null,
    joinedAt: now,
    lastReadAt: now,
    joinedViaInviteId: inviteId,
    joinedViaInviteToken: token,
  };

  await setDoc(doc(firestore, 'rooms', roomId, 'members', user.uid), memberRecord, { merge: true });
  await updateMembershipIndex(user.uid, roomId, {
    roomId,
    joinedAt: now,
    role: 'member',
  });

  const details = await getRoomDetails(user, roomId);
  return details.room;
}

export async function createRoomPost(
  user: FirebaseAuthTypes.User,
  roomId: string,
  input: CreateRoomPostInput
): Promise<RoomDetails> {
  const membership = await ensureMembership(roomId, user.uid);
  const firestore = requireFirestore();
  const text = input.text?.trim() ?? '';
  const photoRemoteBase64 = await serializeRoomPostPhoto(input.photoLocalUri);

  if (!text && !photoRemoteBase64) {
    throw new Error('Add a message or photo before posting.');
  }

  const postId = generateId('room-post');
  const now = getNowIso();
  await setDoc(doc(firestore, 'rooms', roomId, 'posts', postId), {
    roomId,
    authorId: user.uid,
    authorDisplayName: getDisplayName(user),
    origin: 'room_native',
    type: photoRemoteBase64 ? 'photo' : 'text',
    text,
    photoRemoteBase64: photoRemoteBase64 ?? null,
    placeName: input.placeName ?? null,
    sourceNoteId: null,
    createdAt: now,
    updatedAt: null,
  } satisfies RoomPostRecord);
  await updateDoc(doc(firestore, 'rooms', roomId), {
    updatedAt: now,
    lastPostAt: now,
    syncedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, 'rooms', roomId, 'members', user.uid), {
    lastReadAt: now,
  }).catch(() => undefined);
  await setCachedRoomReadState(user.uid, roomId, now);

  const room = await buildRoomSummary(roomId, membership.role);
  if (room) {
    await upsertCachedRoom(user.uid, room);
  }

  return getRoomDetails(user, roomId);
}

export async function shareNoteToRoom(
  user: FirebaseAuthTypes.User,
  roomId: string,
  note: Note
): Promise<RoomDetails> {
  const membership = await ensureMembership(roomId, user.uid);
  const firestore = requireFirestore();
  const postId = generateId('room-post');
  const now = getNowIso();
  const photoRemoteBase64 =
    note.type === 'photo' ? await serializeRoomPostPhoto(note.photoLocalUri ?? note.content) : null;

  await setDoc(doc(firestore, 'rooms', roomId, 'posts', postId), {
    roomId,
    authorId: user.uid,
    authorDisplayName: getDisplayName(user),
    origin: 'shared_note',
    type: note.type,
    text: note.type === 'text' ? note.content.trim() : '',
    photoRemoteBase64: photoRemoteBase64 ?? null,
    placeName: note.locationName ?? null,
    sourceNoteId: note.id,
    createdAt: now,
    updatedAt: null,
  } satisfies RoomPostRecord);
  await updateDoc(doc(firestore, 'rooms', roomId), {
    updatedAt: now,
    lastPostAt: now,
    syncedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, 'rooms', roomId, 'members', user.uid), {
    lastReadAt: now,
  }).catch(() => undefined);
  await setCachedRoomReadState(user.uid, roomId, now);

  const room = await buildRoomSummary(roomId, membership.role);
  if (room) {
    await upsertCachedRoom(user.uid, room);
  }

  return getRoomDetails(user, roomId);
}

export async function removeRoomMember(
  user: FirebaseAuthTypes.User,
  roomId: string,
  memberUserId: string
): Promise<void> {
  const membership = await ensureMembership(roomId, user.uid);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can remove members.');
  }

  await deleteDoc(doc(requireFirestore(), 'rooms', roomId, 'members', memberUserId));
  await updateMembershipIndex(memberUserId, roomId, null);
  if (memberUserId === user.uid) {
    await clearCachedRoom(user.uid, roomId);
  }
}

export async function getRoomInvite(user: FirebaseAuthTypes.User, roomId: string) {
  const membership = await ensureMembership(roomId, user.uid);
  if (membership.role !== 'owner') {
    return null;
  }

  return getActiveInviteRecord(roomId);
}
