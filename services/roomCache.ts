import type { RoomInvite } from './roomService';
import { getDB, withDatabaseTransaction } from './database';

export type RoomRole = 'owner' | 'member';
export type RoomPostOrigin = 'shared_note' | 'room_native';
export type RoomPostType = 'text' | 'photo';

export interface RoomSummary {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  lastPostAt: string | null;
  coverPhotoUrl: string | null;
  currentUserRole: RoomRole;
  memberCount: number;
  lastPostPreview: string | null;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  role: RoomRole;
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
  joinedAt: string;
  lastReadAt: string | null;
}

export interface RoomPost {
  id: string;
  roomId: string;
  authorId: string;
  authorDisplayName: string | null;
  origin: RoomPostOrigin;
  type: RoomPostType;
  text: string;
  photoLocalUri: string | null;
  photoRemoteBase64: string | null;
  placeName: string | null;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface RoomSummaryRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  last_post_at: string | null;
  cover_photo_url: string | null;
  current_user_role: RoomRole;
  member_count: number;
  last_post_preview: string | null;
}

interface RoomMemberRow {
  room_id: string;
  user_id: string;
  role: RoomRole;
  display_name_snapshot: string | null;
  photo_url_snapshot: string | null;
  joined_at: string;
  last_read_at: string | null;
}

interface RoomPostRow {
  id: string;
  room_id: string;
  author_id: string;
  author_display_name: string | null;
  origin: RoomPostOrigin;
  type: RoomPostType;
  text: string;
  photo_local_uri: string | null;
  photo_remote_base64: string | null;
  place_name: string | null;
  source_note_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RoomInviteRow {
  id: string;
  room_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  url: string;
}

interface CacheMetaRow {
  last_updated_at: string | null;
}

function rowToRoomSummary(row: RoomSummaryRow): RoomSummary {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPostAt: row.last_post_at,
    coverPhotoUrl: row.cover_photo_url,
    currentUserRole: row.current_user_role,
    memberCount: row.member_count,
    lastPostPreview: row.last_post_preview,
  };
}

function rowToRoomMember(row: RoomMemberRow): RoomMember {
  return {
    roomId: row.room_id,
    userId: row.user_id,
    role: row.role,
    displayNameSnapshot: row.display_name_snapshot,
    photoURLSnapshot: row.photo_url_snapshot,
    joinedAt: row.joined_at,
    lastReadAt: row.last_read_at,
  };
}

function rowToRoomPost(row: RoomPostRow): RoomPost {
  return {
    id: row.id,
    roomId: row.room_id,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    origin: row.origin,
    type: row.type,
    text: row.text,
    photoLocalUri: row.photo_local_uri,
    photoRemoteBase64: row.photo_remote_base64,
    placeName: row.place_name,
    sourceNoteId: row.source_note_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRoomInvite(row: RoomInviteRow): RoomInvite {
  return {
    id: row.id,
    roomId: row.room_id,
    token: row.token,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    url: row.url,
  };
}

export async function getCachedRooms(userUid: string): Promise<RoomSummary[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<RoomSummaryRow>(
    `SELECT *
     FROM rooms_cache
     WHERE user_uid = ?
     ORDER BY COALESCE(last_post_at, updated_at) DESC`,
    userUid
  );
  return rows.map(rowToRoomSummary);
}

export async function replaceCachedRooms(userUid: string, rooms: RoomSummary[]): Promise<void> {
  const cachedAt = new Date().toISOString();
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM rooms_cache WHERE user_uid = ?', userUid);

    for (const room of rooms) {
      await tx.runAsync(
        `INSERT INTO rooms_cache (
          user_uid,
          id,
          name,
          owner_id,
          created_at,
          updated_at,
          last_post_at,
          cover_photo_url,
          current_user_role,
          member_count,
          last_post_preview
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        room.id,
        room.name,
        room.ownerId,
        room.createdAt,
        room.updatedAt,
        room.lastPostAt,
        room.coverPhotoUrl,
        room.currentUserRole,
        room.memberCount,
        room.lastPostPreview
      );
    }

    await tx.runAsync(
      `INSERT INTO rooms_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      cachedAt
    );
  });
}

export async function upsertCachedRoom(userUid: string, room: RoomSummary): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO rooms_cache (
      user_uid,
      id,
      name,
      owner_id,
      created_at,
      updated_at,
      last_post_at,
      cover_photo_url,
      current_user_role,
      member_count,
      last_post_preview
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid, id) DO UPDATE SET
      name = excluded.name,
      owner_id = excluded.owner_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_post_at = excluded.last_post_at,
      cover_photo_url = excluded.cover_photo_url,
      current_user_role = excluded.current_user_role,
      member_count = excluded.member_count,
      last_post_preview = excluded.last_post_preview`,
    userUid,
    room.id,
    room.name,
    room.ownerId,
    room.createdAt,
    room.updatedAt,
    room.lastPostAt,
    room.coverPhotoUrl,
    room.currentUserRole,
    room.memberCount,
    room.lastPostPreview
  );
  await db.runAsync(
    `INSERT INTO rooms_cache_meta (user_uid, last_updated_at)
     VALUES (?, ?)
     ON CONFLICT(user_uid) DO UPDATE SET
       last_updated_at = excluded.last_updated_at`,
    userUid,
    new Date().toISOString()
  );
}

export async function getCachedRoomMembers(userUid: string, roomId: string): Promise<RoomMember[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<RoomMemberRow>(
    `SELECT *
     FROM room_memberships_cache
     WHERE user_uid = ? AND room_id = ?
     ORDER BY joined_at ASC`,
    userUid,
    roomId
  );
  return rows.map(rowToRoomMember);
}

export async function replaceCachedRoomMembers(
  userUid: string,
  roomId: string,
  members: RoomMember[]
): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync(
      'DELETE FROM room_memberships_cache WHERE user_uid = ? AND room_id = ?',
      userUid,
      roomId
    );

    for (const member of members) {
      await tx.runAsync(
        `INSERT INTO room_memberships_cache (
          user_uid,
          room_id,
          user_id,
          role,
          display_name_snapshot,
          photo_url_snapshot,
          joined_at,
          last_read_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        roomId,
        member.userId,
        member.role,
        member.displayNameSnapshot,
        member.photoURLSnapshot,
        member.joinedAt,
        member.lastReadAt
      );
    }
  });
}

export async function getCachedRoomPosts(userUid: string, roomId: string): Promise<RoomPost[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<RoomPostRow>(
    `SELECT *
     FROM room_posts_cache
     WHERE user_uid = ? AND room_id = ?
     ORDER BY created_at DESC`,
    userUid,
    roomId
  );
  return rows.map(rowToRoomPost);
}

export async function replaceCachedRoomPosts(
  userUid: string,
  roomId: string,
  posts: RoomPost[]
): Promise<void> {
  const cachedAt = new Date().toISOString();
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM room_posts_cache WHERE user_uid = ? AND room_id = ?', userUid, roomId);

    for (const post of posts) {
      await tx.runAsync(
        `INSERT INTO room_posts_cache (
          user_uid,
          room_id,
          id,
          author_id,
          author_display_name,
          origin,
          type,
          text,
          photo_local_uri,
          photo_remote_base64,
          place_name,
          source_note_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        roomId,
        post.id,
        post.authorId,
        post.authorDisplayName,
        post.origin,
        post.type,
        post.text,
        post.photoLocalUri,
        post.photoRemoteBase64,
        post.placeName,
        post.sourceNoteId,
        post.createdAt,
        post.updatedAt
      );
    }

    await tx.runAsync(
      `INSERT INTO rooms_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      cachedAt
    );
  });
}

export async function setCachedRoomReadState(
  userUid: string,
  roomId: string,
  lastReadAt: string
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO room_read_state (user_uid, room_id, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_uid, room_id) DO UPDATE SET
       last_read_at = excluded.last_read_at`,
    userUid,
    roomId,
    lastReadAt
  );
}

export async function getCachedRoomInvite(userUid: string, roomId: string): Promise<RoomInvite | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<RoomInviteRow>(
    `SELECT *
     FROM room_invites_cache
     WHERE user_uid = ? AND room_id = ?`,
    userUid,
    roomId
  );
  return row ? rowToRoomInvite(row) : null;
}

export async function upsertCachedRoomInvite(userUid: string, invite: RoomInvite): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO room_invites_cache (
        user_uid,
        room_id,
        id,
        token,
        created_by,
        created_at,
        expires_at,
        revoked_at,
        url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_uid, room_id) DO UPDATE SET
        id = excluded.id,
        token = excluded.token,
        created_by = excluded.created_by,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        revoked_at = excluded.revoked_at,
        url = excluded.url`,
      userUid,
      invite.roomId,
      invite.id,
      invite.token,
      invite.createdBy,
      invite.createdAt,
      invite.expiresAt,
      invite.revokedAt,
      invite.url
    );
    await tx.runAsync(
      `INSERT INTO rooms_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      new Date().toISOString()
    );
  });
}

export async function clearCachedRoomInvite(userUid: string, roomId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'DELETE FROM room_invites_cache WHERE user_uid = ? AND room_id = ?',
    userUid,
    roomId
  );
}

export async function getRoomsCacheLastUpdatedAt(userUid: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<CacheMetaRow>(
    `SELECT last_updated_at
     FROM rooms_cache_meta
     WHERE user_uid = ?`,
    userUid
  );
  return row?.last_updated_at ?? null;
}

export async function clearCachedRoom(userUid: string, roomId: string): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM rooms_cache WHERE user_uid = ? AND id = ?', userUid, roomId);
    await tx.runAsync(
      'DELETE FROM room_memberships_cache WHERE user_uid = ? AND room_id = ?',
      userUid,
      roomId
    );
    await tx.runAsync('DELETE FROM room_posts_cache WHERE user_uid = ? AND room_id = ?', userUid, roomId);
    await tx.runAsync('DELETE FROM room_invites_cache WHERE user_uid = ? AND room_id = ?', userUid, roomId);
    await tx.runAsync('DELETE FROM room_read_state WHERE user_uid = ? AND room_id = ?', userUid, roomId);
  });
}

export async function clearAllCachedRooms(userUid?: string | null): Promise<void> {
  if (!userUid) {
    await withDatabaseTransaction(async (tx) => {
      await tx.runAsync('DELETE FROM rooms_cache');
      await tx.runAsync('DELETE FROM room_memberships_cache');
      await tx.runAsync('DELETE FROM room_posts_cache');
      await tx.runAsync('DELETE FROM room_invites_cache');
      await tx.runAsync('DELETE FROM room_read_state');
      await tx.runAsync('DELETE FROM rooms_cache_meta');
    });
    return;
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM rooms_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM room_memberships_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM room_posts_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM room_invites_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM room_read_state WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM rooms_cache_meta WHERE user_uid = ?', userUid);
  });
}
