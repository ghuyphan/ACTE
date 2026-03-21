import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { AppUser, getUserDisplayName } from '../utils/appUser';
import { getSupabase } from '../utils/supabase';
import { Note } from './database';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import {
  clearCachedRoom,
  clearCachedRoomInvite,
  getCachedRoomMembers,
  getCachedRoomInvite,
  getCachedRoomPosts,
  getCachedRooms,
  getRoomsCacheLastUpdatedAt,
  replaceCachedRoomMembers,
  replaceCachedRoomPosts,
  replaceCachedRooms,
  RoomMember,
  RoomPost,
  RoomRole,
  RoomSummary,
  setCachedRoomReadState,
  upsertCachedRoom,
  upsertCachedRoomInvite,
} from './roomCache';
import { deletePhotoFromStorage, downloadPhotoFromStorage, ROOM_POST_MEDIA_BUCKET, uploadPhotoToStorage } from './remoteMedia';

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
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  last_post_at: string | null;
  cover_photo_path: string | null;
}

interface RoomMembershipRecord {
  room_id: string;
  user_id: string;
  role: RoomRole;
  display_name_snapshot: string | null;
  photo_url_snapshot: string | null;
  joined_at: string;
  last_read_at: string | null;
  joined_via_invite_id?: string | null;
  joined_via_invite_token?: string | null;
}

interface RoomPostRecord {
  id: string;
  room_id: string;
  author_user_id: string;
  author_display_name: string | null;
  origin: RoomPost['origin'];
  type: RoomPost['type'];
  text: string;
  photo_path: string | null;
  place_name: string | null;
  source_note_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RoomInviteRecord {
  id: string;
  room_id: string;
  token: string;
  created_by_user_id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

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
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : 'Shared rooms are unavailable right now.';
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('permission') || normalizedMessage.includes('policy')) {
    return 'Shared rooms need Supabase policies before this action can work in production.';
  }

  if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
    return 'Supabase is unavailable right now. Check your connection and try again.';
  }

  return message;
}

function getNowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
}

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Rooms are unavailable in this build.');
  }

  return supabase;
}

function getDisplayName(user: AppUser) {
  return getUserDisplayName(user);
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
  roomRecord: RoomRecord,
  role: RoomRole,
  memberCount: number,
  lastPostPreview: string | null
): RoomSummary {
  return {
    id: roomRecord.id,
    name: roomRecord.name,
    ownerId: roomRecord.owner_user_id,
    createdAt: roomRecord.created_at,
    updatedAt: roomRecord.updated_at,
    lastPostAt: roomRecord.last_post_at ?? null,
    coverPhotoUrl: roomRecord.cover_photo_path ?? null,
    currentUserRole: role,
    memberCount,
    lastPostPreview,
  };
}

function mapRoomInvite(record: RoomInviteRecord): RoomInvite {
  return {
    id: record.id,
    roomId: record.room_id,
    token: record.token,
    createdBy: record.created_by_user_id,
    createdAt: record.created_at,
    expiresAt: record.expires_at ?? null,
    revokedAt: record.revoked_at ?? null,
    url: Linking.createURL('/rooms/join', {
      queryParams: {
        roomId: record.room_id,
        inviteId: record.id,
        invite: record.token,
      },
    }),
  };
}

async function hydrateRoomPostPhoto(postId: string, photoPath?: string | null) {
  if (!photoPath?.trim()) {
    return null;
  }

  return downloadPhotoFromStorage(
    ROOM_POST_MEDIA_BUCKET,
    photoPath,
    `room-post-${postId}`
  );
}

async function fetchRoomRecord(roomId: string) {
  const { data, error } = await requireSupabase()
    .from('rooms')
    .select('id, name, owner_user_id, created_at, updated_at, last_post_at, cover_photo_path')
    .eq('id', roomId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RoomRecord | null) ?? null;
}

async function ensureMembership(roomId: string, userUid: string) {
  const { data, error } = await requireSupabase()
    .from('room_members')
    .select(
      'room_id, user_id, role, display_name_snapshot, photo_url_snapshot, joined_at, last_read_at, joined_via_invite_id, joined_via_invite_token'
    )
    .eq('room_id', roomId)
    .eq('user_id', userUid)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('You no longer have access to this room.');
  }

  return data as RoomMembershipRecord;
}

async function getRoomMemberCount(roomId: string) {
  const { count, error } = await requireSupabase()
    .from('room_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('room_id', roomId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getLatestPostPreview(roomId: string) {
  const { data, error } = await requireSupabase()
    .from('room_posts')
    .select('type, text')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const latestData = data?.[0] as { type?: string; text?: string } | undefined;
  if (!latestData) {
    return null;
  }

  if (latestData.type === 'photo') {
    return 'Photo';
  }

  return typeof latestData.text === 'string' && latestData.text.trim()
    ? latestData.text.trim()
    : null;
}

async function getActiveInviteRecord(roomId: string): Promise<RoomInvite | null> {
  const { data, error } = await requireSupabase()
    .from('room_invites')
    .select('id, room_id, token, created_by_user_id, created_at, expires_at, revoked_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  const invite = ((data ?? []) as RoomInviteRecord[]).find(
    (item) => !item.revoked_at && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now())
  );

  return invite ? mapRoomInvite(invite) : null;
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

  return mapRoomSummary(roomRecord, role, memberCount, lastPostPreview);
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

  const [members, posts, activeInvite] = await Promise.all([
    getCachedRoomMembers(userUid, roomId),
    getCachedRoomPosts(userUid, roomId),
    getCachedRoomInvite(userUid, roomId),
  ]);

  return {
    room,
    members,
    posts,
    activeInvite,
  };
}

export async function loadRoomsCacheLastUpdatedAt(userUid: string) {
  return getRoomsCacheLastUpdatedAt(userUid);
}

export async function refreshRooms(user: AppUser): Promise<RoomSummary[]> {
  const { data, error } = await requireSupabase()
    .from('room_members')
    .select('room_id, role')
    .eq('user_id', user.id);

  if (error) {
    throw error;
  }

  const roomIds = (data ?? []) as Array<{ room_id: string; role: RoomRole }>;
  const rooms = (
    await Promise.all(
      roomIds.map(async ({ room_id, role }) => buildRoomSummary(room_id, role ?? 'member'))
    )
  ).filter(Boolean) as RoomSummary[];

  await replaceCachedRooms(user.id, rooms);
  return rooms;
}

export async function getRoomDetails(
  user: AppUser,
  roomId: string
): Promise<RoomDetails> {
  const membership = await ensureMembership(roomId, user.id);
  const room = await buildRoomSummary(roomId, membership.role);
  if (!room) {
    throw new Error('Room not found.');
  }

  const [memberResponse, postResponse, activeInvite] = await Promise.all([
    requireSupabase()
      .from('room_members')
      .select(
        'room_id, user_id, role, display_name_snapshot, photo_url_snapshot, joined_at, last_read_at'
      )
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true }),
    requireSupabase()
      .from('room_posts')
      .select(
        'id, room_id, author_user_id, author_display_name, origin, type, text, photo_path, place_name, source_note_id, created_at, updated_at'
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: false }),
    membership.role === 'owner' ? getActiveInviteRecord(roomId) : Promise.resolve(null),
  ]);

  if (memberResponse.error) {
    throw memberResponse.error;
  }

  if (postResponse.error) {
    throw postResponse.error;
  }

  const members = ((memberResponse.data ?? []) as RoomMembershipRecord[]).map((item) => ({
    roomId,
    userId: item.user_id,
    role: item.role,
    displayNameSnapshot: item.display_name_snapshot ?? null,
    photoURLSnapshot: item.photo_url_snapshot ?? null,
    joinedAt: item.joined_at,
    lastReadAt: item.last_read_at ?? null,
  }));

  const posts = await Promise.all(
    ((postResponse.data ?? []) as RoomPostRecord[]).map(async (item) => {
      const photoLocalUri = await hydrateRoomPostPhoto(item.id, item.photo_path);
      return {
        id: item.id,
        roomId,
        authorId: item.author_user_id,
        authorDisplayName: item.author_display_name ?? null,
        origin: item.origin,
        type: item.type,
        text: item.text ?? '',
        photoLocalUri,
        photoRemoteBase64: null,
        placeName: item.place_name ?? null,
        sourceNoteId: item.source_note_id ?? null,
        createdAt: item.created_at,
        updatedAt: item.updated_at ?? null,
      } satisfies RoomPost;
    })
  );

  await upsertCachedRoom(user.id, room);
  await replaceCachedRoomMembers(user.id, roomId, members);
  await replaceCachedRoomPosts(user.id, roomId, posts);
  if (activeInvite) {
    await upsertCachedRoomInvite(user.id, activeInvite);
  } else {
    await clearCachedRoomInvite(user.id, roomId);
  }
  await setCachedRoomReadState(user.id, roomId, getNowIso());
  await requireSupabase()
    .from('room_members')
    .update({ last_read_at: getNowIso() })
    .eq('room_id', roomId)
    .eq('user_id', user.id);

  return {
    room,
    members,
    posts,
    activeInvite,
  };
}

export async function createRoom(user: AppUser, name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Enter a room name.');
  }

  const roomId = generateId('room');
  const { error } = await requireSupabase().rpc('create_room_with_owner', {
    room_id: roomId,
    room_name: normalizedName,
  });

  if (error) {
    throw error;
  }

  const now = getNowIso();
  const room = {
    id: roomId,
    name: normalizedName,
    ownerId: user.id,
    createdAt: now,
    updatedAt: now,
    lastPostAt: null,
    coverPhotoUrl: null,
    currentUserRole: 'owner' as RoomRole,
    memberCount: 1,
    lastPostPreview: null,
  };
  const membership: RoomMember = {
    roomId,
    userId: user.id,
    role: 'owner',
    displayNameSnapshot: getDisplayName(user),
    photoURLSnapshot: user.photoURL ?? null,
    joinedAt: now,
    lastReadAt: now,
  };

  await upsertCachedRoom(user.id, room);
  await replaceCachedRoomMembers(user.id, roomId, [membership]);
  await replaceCachedRoomPosts(user.id, roomId, []);
  await clearCachedRoomInvite(user.id, roomId);
  await setCachedRoomReadState(user.id, roomId, now);

  return room;
}

export async function renameRoom(
  user: AppUser,
  roomId: string,
  nextName: string
): Promise<RoomSummary> {
  const membership = await ensureMembership(roomId, user.id);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can rename this room.');
  }

  const normalizedName = nextName.trim();
  if (!normalizedName) {
    throw new Error('Enter a room name.');
  }

  const now = getNowIso();
  const { error } = await requireSupabase()
    .from('rooms')
    .update({
      name: normalizedName,
      updated_at: now,
    })
    .eq('id', roomId);

  if (error) {
    throw error;
  }

  const updatedRoom = await buildRoomSummary(roomId, membership.role);
  if (!updatedRoom) {
    throw new Error('Room not found.');
  }

  await upsertCachedRoom(user.id, updatedRoom);
  return updatedRoom;
}

export async function createRoomInvite(user: AppUser, roomId: string): Promise<RoomInvite> {
  const membership = await ensureMembership(roomId, user.id);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can create invites.');
  }

  const inviteId = generateId('invite');
  const token = Crypto.randomUUID();
  const now = getNowIso();
  const record: RoomInviteRecord = {
    id: inviteId,
    room_id: roomId,
    token,
    created_by_user_id: user.id,
    created_at: now,
    expires_at: null,
    revoked_at: null,
  };

  const { error } = await requireSupabase().from('room_invites').insert(record);
  if (error) {
    throw error;
  }

  const nextInvite = mapRoomInvite(record);
  await upsertCachedRoomInvite(user.id, nextInvite);
  return nextInvite;
}

export async function revokeRoomInvite(
  user: AppUser,
  roomId: string,
  inviteId: string
): Promise<void> {
  const membership = await ensureMembership(roomId, user.id);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can revoke invites.');
  }

  const { error } = await requireSupabase()
    .from('room_invites')
    .update({
      revoked_at: getNowIso(),
    })
    .eq('id', inviteId)
    .eq('room_id', roomId);

  if (error) {
    throw error;
  }

  await clearCachedRoomInvite(user.id, roomId);
}

export async function joinRoomByInvite(user: AppUser, inviteValue: string) {
  const { roomId, inviteId, token } = parseInvitePayload(inviteValue);
  if (!roomId || !inviteId || !token) {
    throw new Error('Paste a valid invite link.');
  }

  const { error } = await requireSupabase().rpc('join_room_by_invite', {
    room_id: roomId,
    invite_id: inviteId,
    invite_token: token,
  });

  if (error) {
    throw error;
  }

  const details = await getRoomDetails(user, roomId);
  return details.room;
}

export async function createRoomPost(
  user: AppUser,
  roomId: string,
  input: CreateRoomPostInput
): Promise<RoomDetails> {
  const membership = await ensureMembership(roomId, user.id);
  const text = input.text?.trim() ?? '';
  const postId = generateId('room-post');
  const photoPath = await uploadPhotoToStorage(
    ROOM_POST_MEDIA_BUCKET,
    `${roomId}/${postId}`,
    input.photoLocalUri
  );

  if (!text && !photoPath) {
    throw new Error('Add a message or photo before posting.');
  }

  const now = getNowIso();
  const { error } = await requireSupabase().from('room_posts').insert({
    id: postId,
    room_id: roomId,
    author_user_id: user.id,
    author_display_name: getDisplayName(user),
    origin: 'room_native',
    type: photoPath ? 'photo' : 'text',
    text,
    photo_path: photoPath ?? null,
    place_name: input.placeName ?? null,
    source_note_id: null,
    created_at: now,
    updated_at: null,
  });

  if (error) {
    throw error;
  }

  await requireSupabase()
    .from('room_members')
    .update({ last_read_at: now })
    .eq('room_id', roomId)
    .eq('user_id', user.id);
  await setCachedRoomReadState(user.id, roomId, now);

  const room = await buildRoomSummary(roomId, membership.role);
  if (room) {
    await upsertCachedRoom(user.id, room);
  }

  return getRoomDetails(user, roomId);
}

export async function shareNoteToRoom(
  user: AppUser,
  roomId: string,
  note: Note
): Promise<RoomDetails> {
  const membership = await ensureMembership(roomId, user.id);
  const postId = generateId('room-post');
  const now = getNowIso();
  const photoPath =
    note.type === 'photo'
      ? await uploadPhotoToStorage(
          ROOM_POST_MEDIA_BUCKET,
          `${roomId}/${postId}`,
          note.photoLocalUri ?? note.content
        )
      : null;

  const { error } = await requireSupabase().from('room_posts').insert({
    id: postId,
    room_id: roomId,
    author_user_id: user.id,
    author_display_name: getDisplayName(user),
    origin: 'shared_note',
    type: note.type,
    text: note.type === 'text' ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji) : '',
    photo_path: photoPath ?? null,
    place_name: note.locationName ?? null,
    source_note_id: note.id,
    created_at: now,
    updated_at: null,
  });

  if (error) {
    throw error;
  }

  await requireSupabase()
    .from('room_members')
    .update({ last_read_at: now })
    .eq('room_id', roomId)
    .eq('user_id', user.id);
  await setCachedRoomReadState(user.id, roomId, now);

  const room = await buildRoomSummary(roomId, membership.role);
  if (room) {
    await upsertCachedRoom(user.id, room);
  }

  return getRoomDetails(user, roomId);
}

export async function removeRoomMember(
  user: AppUser,
  roomId: string,
  memberUserId: string
): Promise<void> {
  const membership = await ensureMembership(roomId, user.id);
  if (membership.role !== 'owner') {
    throw new Error('Only the room owner can remove members.');
  }

  const { error } = await requireSupabase().rpc('remove_room_member', {
    room_id: roomId,
    member_user_id: memberUserId,
  });

  if (error) {
    throw error;
  }

  if (memberUserId === user.id) {
    await clearCachedRoom(user.id, roomId);
  }
}

export async function getRoomInvite(user: AppUser, roomId: string) {
  const membership = await ensureMembership(roomId, user.id);
  if (membership.role !== 'owner') {
    return null;
  }

  return getActiveInviteRecord(roomId);
}
