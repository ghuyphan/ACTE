import type {
  FriendConnection,
  FriendInvite,
  SharedFeedSnapshot,
  SharedPost,
  SharedPostResponse,
} from './sharedFeedService';
import {
  clearStoredActiveInvite,
  getStoredActiveInvite,
  setStoredActiveInvite,
} from './activeInviteStorage';
import { getDB, withDatabaseTransaction, type SQLiteTransactionExecutor } from './database';
import { resolveSavedTextNoteColor } from './noteAppearance';
import { hasStoredStickerPayload } from './noteStickers';
import {
  getOwnedSharedNoteIdsFromPosts,
  normalizeOwnedSharedNoteIds,
} from './sharedFeedOwnership';

interface FriendRow {
  friend_uid: string;
  username_snapshot: string | null;
  display_name_snapshot: string | null;
  friend_nickname: string | null;
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
  capture_variant: SharedPost['captureVariant'];
  dual_primary_photo_path: string | null;
  dual_secondary_photo_path: string | null;
  dual_primary_photo_local_uri: string | null;
  dual_secondary_photo_local_uri: string | null;
  is_live_photo: number;
  paired_video_path: string | null;
  paired_video_local_uri: string | null;
  dual_primary_facing: SharedPost['dualPrimaryFacing'];
  dual_secondary_facing: SharedPost['dualSecondaryFacing'];
  dual_layout_preset: SharedPost['dualLayoutPreset'];
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

interface SharedPostResponseCacheRow {
  id: string;
  post_id: string;
  author_uid: string;
  author_display_name: string | null;
  author_photo_url_snapshot: string | null;
  emoji: string | null;
  text: string;
  created_at: string;
}

interface MetaRow {
  last_updated_at: string | null;
  owned_shared_note_ids: string | null;
}

const SHARED_POST_CACHE_COLUMNS = [
  'user_uid',
  'id',
  'author_uid',
  'author_display_name',
  'author_photo_url_snapshot',
  'audience_user_ids',
  'type',
  'text',
  'photo_path',
  'photo_local_uri',
  'capture_variant',
  'dual_primary_photo_path',
  'dual_secondary_photo_path',
  'dual_primary_photo_local_uri',
  'dual_secondary_photo_local_uri',
  'is_live_photo',
  'paired_video_path',
  'paired_video_local_uri',
  'dual_primary_facing',
  'dual_secondary_facing',
  'dual_layout_preset',
  'doodle_strokes_json',
  'sticker_placements_json',
  'note_color',
  'place_name',
  'source_note_id',
  'latitude',
  'longitude',
  'created_at',
  'updated_at',
] as const;

function parseOwnedSharedNoteIds(rawValue: string | null | undefined, fallbackNoteIds: string[]) {
  if (!rawValue) {
    return fallbackNoteIds;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return fallbackNoteIds;
    }
    return normalizeOwnedSharedNoteIds([...parsed, ...fallbackNoteIds]);
  } catch {
    return fallbackNoteIds;
  }
}

function getSharedPostInsertValues(userUid: string, post: SharedPost) {
  return [
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
    post.captureVariant ?? null,
    post.dualPrimaryPhotoPath ?? null,
    post.dualSecondaryPhotoPath ?? null,
    post.dualPrimaryPhotoLocalUri ?? null,
    post.dualSecondaryPhotoLocalUri ?? null,
    post.isLivePhoto ? 1 : 0,
    post.pairedVideoPath ?? null,
    post.pairedVideoLocalUri ?? null,
    post.dualPrimaryFacing ?? null,
    post.dualSecondaryFacing ?? null,
    post.dualLayoutPreset ?? null,
    post.doodleStrokesJson ?? null,
    post.stickerPlacementsJson ?? null,
    post.noteColor ?? null,
    post.placeName,
    post.sourceNoteId,
    post.latitude ?? null,
    post.longitude ?? null,
    post.createdAt,
    post.updatedAt,
  ] as const;
}

async function insertCachedSharedPost(
  tx: SQLiteTransactionExecutor,
  userUid: string,
  post: SharedPost
) {
  const values = getSharedPostInsertValues(userUid, post);

  await tx.runAsync(
    `INSERT INTO shared_posts_cache (
      ${SHARED_POST_CACHE_COLUMNS.join(',\n      ')}
    )
    VALUES (${values.map(() => '?').join(', ')})`,
    ...values
  );
}

function rowToFriend(row: FriendRow): FriendConnection {
  return {
    userId: row.friend_uid,
    username: row.username_snapshot,
    displayNameSnapshot: row.display_name_snapshot,
    nickname: row.friend_nickname,
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
    captureVariant: row.capture_variant ?? null,
    dualPrimaryPhotoPath: row.dual_primary_photo_path,
    dualSecondaryPhotoPath: row.dual_secondary_photo_path,
    dualPrimaryPhotoLocalUri: row.dual_primary_photo_local_uri,
    dualSecondaryPhotoLocalUri: row.dual_secondary_photo_local_uri,
    isLivePhoto: row.is_live_photo === 1,
    pairedVideoPath: row.paired_video_path,
    pairedVideoLocalUri: row.paired_video_local_uri,
    dualPrimaryFacing: row.dual_primary_facing ?? null,
    dualSecondaryFacing: row.dual_secondary_facing ?? null,
    dualLayoutPreset: row.dual_layout_preset ?? null,
    doodleStrokesJson: row.doodle_strokes_json,
    hasStickers: hasStoredStickerPayload(row.sticker_placements_json),
    stickerPlacementsJson: row.sticker_placements_json,
    noteColor:
      row.type === 'text'
        ? resolveSavedTextNoteColor(row.note_color ?? null)
        : null,
    placeName: row.place_name,
    sourceNoteId: row.source_note_id,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSharedPostResponse(row: SharedPostResponseCacheRow): SharedPostResponse {
  return {
    id: row.id,
    postId: row.post_id,
    authorUid: row.author_uid,
    authorDisplayName: row.author_display_name,
    authorPhotoURLSnapshot: row.author_photo_url_snapshot,
    emoji: row.emoji,
    text: row.text,
    createdAt: row.created_at,
  };
}

async function insertCachedSharedPostResponse(
  tx: SQLiteTransactionExecutor,
  userUid: string,
  response: SharedPostResponse
) {
  await tx.runAsync(
    `INSERT INTO shared_post_responses_cache (
      user_uid,
      post_id,
      id,
      author_uid,
      author_display_name,
      author_photo_url_snapshot,
      emoji,
      text,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid, post_id, id) DO UPDATE SET
      author_uid = excluded.author_uid,
      author_display_name = excluded.author_display_name,
      author_photo_url_snapshot = excluded.author_photo_url_snapshot,
      emoji = excluded.emoji,
      text = excluded.text,
      created_at = excluded.created_at`,
    userUid,
    response.postId,
    response.id,
    response.authorUid,
    response.authorDisplayName,
    response.authorPhotoURLSnapshot,
    response.emoji,
    response.text,
    response.createdAt
  );
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
          friend_nickname,
          photo_url_snapshot,
          friended_at,
          last_shared_at,
          created_by_invite_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        friend.userId,
        friend.username ?? null,
        friend.displayNameSnapshot,
        friend.nickname ?? null,
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
      await insertCachedSharedPost(tx, userUid, post);
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

export async function getCachedSharedPostResponses(
  userUid: string,
  postId: string
): Promise<SharedPostResponse[]> {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return [];
  }

  const db = await getDB();
  const rows = await db.getAllAsync<SharedPostResponseCacheRow>(
    `SELECT id,
            post_id,
            author_uid,
            author_display_name,
            author_photo_url_snapshot,
            emoji,
            text,
            created_at
     FROM shared_post_responses_cache
     WHERE user_uid = ?
       AND post_id = ?
     ORDER BY created_at ASC
     LIMIT 50`,
    userUid,
    normalizedPostId
  );

  return rows.map(rowToSharedPostResponse);
}

export async function replaceCachedSharedPostResponses(
  userUid: string,
  postId: string,
  responses: SharedPostResponse[]
): Promise<void> {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return;
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync(
      'DELETE FROM shared_post_responses_cache WHERE user_uid = ? AND post_id = ?',
      userUid,
      normalizedPostId
    );

    for (const response of responses) {
      await insertCachedSharedPostResponse(tx, userUid, response);
    }
  });
}

export async function upsertCachedSharedPostResponse(
  userUid: string,
  response: SharedPostResponse
): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    await insertCachedSharedPostResponse(tx, userUid, response);
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
      await tx.runAsync('DELETE FROM shared_post_responses_cache');
      await tx.runAsync('DELETE FROM shared_invites_cache');
      await tx.runAsync('DELETE FROM shared_feed_cache_meta');
    });
    await clearStoredActiveInvite().catch(() => undefined);
    return;
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_friends_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_posts_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_post_responses_cache WHERE user_uid = ?', userUid);
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
    dualPrimaryPhotoLocalUri?: string | null;
    dualSecondaryPhotoLocalUri?: string | null;
    pairedVideoLocalUri?: string | null;
  }>
) {
  const normalizedPatches = patches
    .map((patch) => ({
      postId: patch.postId.trim(),
      photoLocalUri: patch.photoLocalUri ?? null,
      dualPrimaryPhotoLocalUri: patch.dualPrimaryPhotoLocalUri ?? null,
      dualSecondaryPhotoLocalUri: patch.dualSecondaryPhotoLocalUri ?? null,
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
             dual_primary_photo_local_uri = ?,
             dual_secondary_photo_local_uri = ?,
             paired_video_local_uri = ?
         WHERE user_uid = ?
           AND id = ?`,
        patch.photoLocalUri,
        patch.dualPrimaryPhotoLocalUri,
        patch.dualSecondaryPhotoLocalUri,
        patch.pairedVideoLocalUri,
        userUid,
        patch.postId
      );
    }
  });
}

export async function cacheSharedFeedSnapshot(
  userUid: string,
  snapshot: Pick<SharedFeedSnapshot, 'friends' | 'sharedPosts' | 'activeInvite' | 'ownedSharedNoteIds'>
) {
  const cachedAt = new Date().toISOString();
  const ownedSharedNoteIds =
    snapshot.ownedSharedNoteIds ?? getOwnedSharedNoteIdsFromPosts(snapshot.sharedPosts, userUid);

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
          friend_nickname,
          photo_url_snapshot,
          friended_at,
          last_shared_at,
          created_by_invite_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        friend.userId,
        friend.username ?? null,
        friend.displayNameSnapshot,
        friend.nickname ?? null,
        friend.photoURLSnapshot,
        friend.friendedAt,
        friend.lastSharedAt,
        friend.createdByInviteId
      );
    }

    for (const post of snapshot.sharedPosts) {
      await insertCachedSharedPost(tx, userUid, post);
    }

    await tx.runAsync(
      `INSERT INTO shared_feed_cache_meta (user_uid, last_updated_at, owned_shared_note_ids)
       VALUES (?, ?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET
         last_updated_at = excluded.last_updated_at,
         owned_shared_note_ids = excluded.owned_shared_note_ids`,
      userUid,
      cachedAt,
      JSON.stringify(normalizeOwnedSharedNoteIds(ownedSharedNoteIds))
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
  ownedSharedNoteIds: string[];
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
        `SELECT last_updated_at, owned_shared_note_ids
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

  const sharedPosts = sharedPostRows.map(rowToSharedPost);
  const fallbackOwnedSharedNoteIds = getOwnedSharedNoteIdsFromPosts(sharedPosts, userUid);

  return {
    friends: friendRows.map(rowToFriend),
    sharedPosts,
    activeInvite: await getStoredActiveInvite(userUid),
    ownedSharedNoteIds: parseOwnedSharedNoteIds(
      metaRow?.owned_shared_note_ids,
      fallbackOwnedSharedNoteIds
    ),
    lastUpdatedAt: metaRow?.last_updated_at ?? null,
  };
}
