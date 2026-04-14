import type { FriendConnection, FriendInvite, SharedFeedSnapshot, SharedPost } from './sharedFeedService';
import {
  clearStoredActiveInvite,
  getStoredActiveInvite,
  setStoredActiveInvite,
} from './activeInviteStorage';
import { getDB, withDatabaseTransaction } from './database';
import { hasStoredStickerPayload } from './noteStickers';
import { getUniqueNormalizedStrings } from './normalizedStrings';

interface FriendRow {
  friend_uid: string;
  username_snapshot: string | null;
  display_name_snapshot: string | null;
  photo_url_snapshot: string | null;
  friended_at: string;
  last_shared_at: string | null;
  created_by_invite_id: string | null;
}

interface SharedPostRow {
  id: string;
  author_uid: string;
  author_display_name: string | null;
  author_photo_url_snapshot: string | null;
  audience_user_ids: string;
  type: SharedPost['type'];
  text: string;
  photo_path: string | null;
  photo_local_uri: string | null;
  is_live_photo: number;
  paired_video_path: string | null;
  paired_video_local_uri: string | null;
  doodle_strokes_json: string | null;
  sticker_placements_json: string | null;
  note_color: string | null;
  place_name: string | null;
  source_note_id: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string | null;
}

interface MetaRow {
  last_updated_at: string | null;
}

function rowToFriend(row: FriendRow): FriendConnection {
  return {
    userId: row.friend_uid,
    username: row.username_snapshot,
    displayNameSnapshot: row.display_name_snapshot,
    photoURLSnapshot: row.photo_url_snapshot,
    friendedAt: row.friended_at,
    lastSharedAt: row.last_shared_at,
    createdByInviteId: row.created_by_invite_id,
  };
}

function rowToSharedPost(row: SharedPostRow): SharedPost {
  let audienceUserIds: string[] = [];

  try {
    const parsed = JSON.parse(row.audience_user_ids);
    if (Array.isArray(parsed)) {
      audienceUserIds = parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    audienceUserIds = [];
  }

  return {
    id: row.id,
    authorUid: row.author_uid,
    authorDisplayName: row.author_display_name,
    authorPhotoURLSnapshot: row.author_photo_url_snapshot,
    audienceUserIds,
    type: row.type,
    text: row.text,
    photoPath: row.photo_path,
    photoLocalUri: row.photo_local_uri,
    isLivePhoto: row.is_live_photo === 1,
    pairedVideoPath: row.paired_video_path,
    pairedVideoLocalUri: row.paired_video_local_uri,
    doodleStrokesJson: row.doodle_strokes_json,
    hasStickers: hasStoredStickerPayload(row.sticker_placements_json),
    stickerPlacementsJson: row.sticker_placements_json,
    noteColor: row.note_color,
    placeName: row.place_name,
    sourceNoteId: row.source_note_id,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCachedSharedFriends(userUid: string): Promise<FriendConnection[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<FriendRow>(
    `SELECT *
     FROM shared_friends_cache
     WHERE user_uid = ?
     ORDER BY friended_at ASC`,
    userUid
  );
  return rows.map(rowToFriend);
}

export async function replaceCachedSharedFriends(userUid: string, friends: FriendConnection[]): Promise<void> {
  const cachedAt = new Date().toISOString();
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_friends_cache WHERE user_uid = ?', userUid);

    for (const friend of friends) {
      await tx.runAsync(
        `INSERT INTO shared_friends_cache (
          user_uid,
          friend_uid,
          username_snapshot,
          display_name_snapshot,
          photo_url_snapshot,
          friended_at,
          last_shared_at,
          created_by_invite_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        friend.userId,
        friend.username ?? null,
        friend.displayNameSnapshot,
        friend.photoURLSnapshot,
        friend.friendedAt,
        friend.lastSharedAt,
        friend.createdByInviteId
      );
    }

    await tx.runAsync(
      `INSERT INTO shared_feed_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      cachedAt
    );
  });
}

export async function getCachedSharedPosts(userUid: string): Promise<SharedPost[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<SharedPostRow>(
    `SELECT *
     FROM shared_posts_cache
     WHERE user_uid = ?
     ORDER BY created_at DESC`,
    userUid
  );
  return rows.map(rowToSharedPost);
}

export async function getCachedSharedPostsPage(
  userUid: string,
  options: { limit: number; offset?: number; excludeAuthorUid?: string | null }
): Promise<SharedPost[]> {
  const db = await getDB();
  const rows = options.excludeAuthorUid
    ? await db.getAllAsync<SharedPostRow>(
        `SELECT *
         FROM shared_posts_cache
         WHERE user_uid = ?
           AND author_uid != ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        userUid,
        options.excludeAuthorUid,
        options.limit,
        options.offset ?? 0
      )
    : await db.getAllAsync<SharedPostRow>(
        `SELECT *
         FROM shared_posts_cache
         WHERE user_uid = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        userUid,
        options.limit,
        options.offset ?? 0
      );

  return rows.map(rowToSharedPost);
}

export async function getCachedSharedPostById(
  userUid: string,
  postId: string
): Promise<SharedPost | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<SharedPostRow>(
    `SELECT *
     FROM shared_posts_cache
     WHERE user_uid = ?
       AND id = ?`,
    userUid,
    postId
  );

  return row ? rowToSharedPost(row) : null;
}

export async function replaceCachedSharedPosts(userUid: string, posts: SharedPost[]): Promise<void> {
  const cachedAt = new Date().toISOString();
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_posts_cache WHERE user_uid = ?', userUid);

    for (const post of posts) {
      await tx.runAsync(
        `INSERT INTO shared_posts_cache (
          user_uid,
          id,
          author_uid,
          author_display_name,
          author_photo_url_snapshot,
          audience_user_ids,
          type,
          text,
          photo_path,
          photo_local_uri,
          is_live_photo,
          paired_video_path,
          paired_video_local_uri,
          doodle_strokes_json,
          sticker_placements_json,
          note_color,
          place_name,
          source_note_id,
          latitude,
          longitude,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        post.id,
        post.authorUid,
        post.authorDisplayName,
        post.authorPhotoURLSnapshot,
        JSON.stringify(post.audienceUserIds),
        post.type,
        post.text,
        post.photoPath,
        post.photoLocalUri,
        post.isLivePhoto ? 1 : 0,
        post.pairedVideoPath ?? null,
        post.pairedVideoLocalUri ?? null,
        post.doodleStrokesJson ?? null,
        post.stickerPlacementsJson ?? null,
        post.noteColor ?? null,
        post.placeName,
        post.sourceNoteId,
        post.latitude ?? null,
        post.longitude ?? null,
        post.createdAt,
        post.updatedAt
      );
    }

    await tx.runAsync(
      `INSERT INTO shared_feed_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      cachedAt
    );
  });
}

export async function getCachedActiveInvite(userUid: string): Promise<FriendInvite | null> {
  return getStoredActiveInvite(userUid);
}

export async function replaceCachedActiveInvite(
  userUid: string,
  invite: FriendInvite | null
): Promise<void> {
  const cachedAt = new Date().toISOString();

  if (invite) {
    await setStoredActiveInvite(userUid, invite);
  } else {
    await clearStoredActiveInvite(userUid).catch(() => undefined);
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_invites_cache WHERE user_uid = ?', userUid);

    await tx.runAsync(
      `INSERT INTO shared_feed_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      cachedAt
    );
  });
}

export async function getSharedFeedCacheLastUpdatedAt(userUid: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<MetaRow>(
    `SELECT last_updated_at
     FROM shared_feed_cache_meta
     WHERE user_uid = ?`,
    userUid
  );
  return row?.last_updated_at ?? null;
}

export async function clearSharedFeedCache(userUid?: string | null): Promise<void> {
  if (!userUid) {
    await withDatabaseTransaction(async (tx) => {
      await tx.runAsync('DELETE FROM shared_friends_cache');
      await tx.runAsync('DELETE FROM shared_posts_cache');
      await tx.runAsync('DELETE FROM shared_invites_cache');
      await tx.runAsync('DELETE FROM shared_feed_cache_meta');
    });
    await clearStoredActiveInvite().catch(() => undefined);
    return;
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_friends_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_posts_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_invites_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_feed_cache_meta WHERE user_uid = ?', userUid);
  });
  await clearStoredActiveInvite(userUid).catch(() => undefined);
}

export async function patchCachedSharedPostMedia(
  userUid: string,
  patches: Array<{
    postId: string;
    photoLocalUri?: string | null;
    pairedVideoLocalUri?: string | null;
  }>
) {
  const normalizedPatches = patches
    .map((patch) => ({
      postId: patch.postId.trim(),
      photoLocalUri: patch.photoLocalUri ?? null,
      pairedVideoLocalUri: patch.pairedVideoLocalUri ?? null,
    }))
    .filter((patch) => Boolean(patch.postId));

  if (normalizedPatches.length === 0) {
    return;
  }

  await withDatabaseTransaction(async (tx) => {
    for (const patch of normalizedPatches) {
      await tx.runAsync(
        `UPDATE shared_posts_cache
         SET photo_local_uri = ?,
             paired_video_local_uri = ?
         WHERE user_uid = ?
           AND id = ?`,
        patch.photoLocalUri,
        patch.pairedVideoLocalUri,
        userUid,
        patch.postId
      );
    }
  });
}

export async function pruneCachedSharedPostsForSourceNotes(
  userUid: string,
  noteIds: string[],
  options: { authorUid?: string | null } = {}
) {
  const normalizedNoteIds = getUniqueNormalizedStrings(noteIds);
  if (normalizedNoteIds.length === 0) {
    return;
  }

  const placeholders = normalizedNoteIds.map(() => '?').join(', ');
  const params = options.authorUid
    ? [userUid, options.authorUid, ...normalizedNoteIds]
    : [userUid, ...normalizedNoteIds];

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync(
      options.authorUid
        ? `DELETE FROM shared_posts_cache
           WHERE user_uid = ?
             AND author_uid = ?
             AND source_note_id IN (${placeholders})`
        : `DELETE FROM shared_posts_cache
           WHERE user_uid = ?
             AND source_note_id IN (${placeholders})`,
      ...params
    );
  });
}

export async function cacheSharedFeedSnapshot(
  userUid: string,
  snapshot: Pick<SharedFeedSnapshot, 'friends' | 'sharedPosts' | 'activeInvite'>
) {
  const cachedAt = new Date().toISOString();

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_friends_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_posts_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_invites_cache WHERE user_uid = ?', userUid);

    for (const friend of snapshot.friends) {
      await tx.runAsync(
        `INSERT INTO shared_friends_cache (
          user_uid,
          friend_uid,
          username_snapshot,
          display_name_snapshot,
          photo_url_snapshot,
          friended_at,
          last_shared_at,
          created_by_invite_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        friend.userId,
        friend.username ?? null,
        friend.displayNameSnapshot,
        friend.photoURLSnapshot,
        friend.friendedAt,
        friend.lastSharedAt,
        friend.createdByInviteId
      );
    }

    for (const post of snapshot.sharedPosts) {
      await tx.runAsync(
        `INSERT INTO shared_posts_cache (
          user_uid,
          id,
          author_uid,
          author_display_name,
          author_photo_url_snapshot,
          audience_user_ids,
          type,
          text,
          photo_path,
          photo_local_uri,
          is_live_photo,
          paired_video_path,
          paired_video_local_uri,
          doodle_strokes_json,
          sticker_placements_json,
          note_color,
          place_name,
          source_note_id,
          latitude,
          longitude,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        post.id,
        post.authorUid,
        post.authorDisplayName,
        post.authorPhotoURLSnapshot,
        JSON.stringify(post.audienceUserIds),
        post.type,
        post.text,
        post.photoPath,
        post.photoLocalUri,
        post.isLivePhoto ? 1 : 0,
        post.pairedVideoPath ?? null,
        post.pairedVideoLocalUri ?? null,
        post.doodleStrokesJson ?? null,
        post.stickerPlacementsJson ?? null,
        post.noteColor ?? null,
        post.placeName,
        post.sourceNoteId,
        post.latitude ?? null,
        post.longitude ?? null,
        post.createdAt,
        post.updatedAt
      );
    }

    await tx.runAsync(
      `INSERT INTO shared_feed_cache_meta (user_uid, last_updated_at)
       VALUES (?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at`,
      userUid,
      cachedAt
    );
  });

  if (snapshot.activeInvite) {
    await setStoredActiveInvite(userUid, snapshot.activeInvite);
  } else {
    await clearStoredActiveInvite(userUid).catch(() => undefined);
  }
}

export async function getCachedSharedFeedSnapshot(userUid: string): Promise<{
  friends: FriendConnection[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
  lastUpdatedAt: string | null;
}> {
  const { friendRows, sharedPostRows, metaRow } = await withDatabaseTransaction(
    async (tx) => {
      const nextFriendRows = await tx.getAllAsync<FriendRow>(
        `SELECT *
         FROM shared_friends_cache
         WHERE user_uid = ?
         ORDER BY friended_at ASC`,
        userUid
      );
      const nextSharedPostRows = await tx.getAllAsync<SharedPostRow>(
        `SELECT *
         FROM shared_posts_cache
         WHERE user_uid = ?
         ORDER BY created_at DESC`,
        userUid
      );
      const nextMetaRow = await tx.getFirstAsync<MetaRow>(
        `SELECT last_updated_at
         FROM shared_feed_cache_meta
         WHERE user_uid = ?`,
        userUid
      );

      return {
        friendRows: nextFriendRows,
        sharedPostRows: nextSharedPostRows,
        metaRow: nextMetaRow ?? null,
      };
    }
  );

  return {
    friends: friendRows.map(rowToFriend),
    sharedPosts: sharedPostRows.map(rowToSharedPost),
    activeInvite: await getStoredActiveInvite(userUid),
    lastUpdatedAt: metaRow?.last_updated_at ?? null,
  };
}
