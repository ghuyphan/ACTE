import type {
  FriendConnection,
  FriendInvite,
  SharedFeedSnapshot,
  SharedPost,
  SharedPostResponse,
  SharedPostResponseReaction,
  SharedThreadSummary,
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
  reply_to_response_id: string | null;
  created_at: string;
}

interface SharedPostResponseReactionCacheRow {
  id: string;
  post_id: string;
  response_id: string;
  author_uid: string;
  author_display_name: string | null;
  author_photo_url_snapshot: string | null;
  emoji: string;
  created_at: string;
}

export interface SharedThreadReadState {
  postId: string;
  userUid: string;
  lastReadResponseId: string | null;
  lastReadAt: string;
}

interface SharedThreadReadStateRow {
  post_id: string;
  user_uid: string;
  last_read_response_id: string | null;
  last_read_at: string;
}

interface SharedThreadSummaryRow {
  post_id: string;
  latest_response_id: string | null;
  latest_response_created_at: string | null;
  latest_activity_at: string | null;
  latest_activity_author_uid: string | null;
  latest_activity_author_display_name: string | null;
  latest_activity_author_photo_url_snapshot: string | null;
  latest_activity_text: string | null;
  latest_activity_emoji: string | null;
  latest_activity_kind: SharedThreadSummary['latestActivityKind'];
  updated_at: string;
}

interface MetaRow {
  last_updated_at: string | null;
  owned_shared_note_ids: string | null;
}

type SQLiteReader = {
  getAllAsync<T>(sql: string, ...args: unknown[]): Promise<T[]>;
};

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
    replyToResponseId: row.reply_to_response_id,
    reactions: [],
    createdAt: row.created_at,
  };
}

function rowToSharedPostResponseReaction(
  row: SharedPostResponseReactionCacheRow
): SharedPostResponseReaction {
  return {
    id: row.id,
    postId: row.post_id,
    responseId: row.response_id,
    authorUid: row.author_uid,
    authorDisplayName: row.author_display_name,
    authorPhotoURLSnapshot: row.author_photo_url_snapshot,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function rowToSharedThreadReadState(row: SharedThreadReadStateRow): SharedThreadReadState {
  return {
    postId: row.post_id,
    userUid: row.user_uid,
    lastReadResponseId: row.last_read_response_id,
    lastReadAt: row.last_read_at,
  };
}

function rowToSharedThreadSummary(row: SharedThreadSummaryRow): SharedThreadSummary {
  return {
    postId: row.post_id,
    latestResponseId: row.latest_response_id,
    latestResponseCreatedAt: row.latest_response_created_at,
    latestActivityAt: row.latest_activity_at,
    latestActivityAuthorUid: row.latest_activity_author_uid,
    latestActivityAuthorDisplayName: row.latest_activity_author_display_name,
    latestActivityAuthorPhotoURLSnapshot: row.latest_activity_author_photo_url_snapshot,
    latestActivityText: row.latest_activity_text,
    latestActivityEmoji: row.latest_activity_emoji,
    latestActivityKind: row.latest_activity_kind,
    updatedAt: row.updated_at,
  };
}

function deriveSharedThreadSummaryFromResponses(
  postId: string,
  responses: SharedPostResponse[],
  updatedAt = new Date().toISOString()
): SharedThreadSummary {
  const latestResponse = responses[responses.length - 1] ?? null;
  const latestActivity = responses.reduce<{
    authorUid: string;
    authorDisplayName: string | null;
    authorPhotoURLSnapshot: string | null;
    text: string | null;
    emoji: string | null;
    kind: 'response' | 'reaction';
    createdAt: string;
  } | null>((latest, response) => {
    const responseActivity = {
      authorUid: response.authorUid,
      authorDisplayName: response.authorDisplayName,
      authorPhotoURLSnapshot: response.authorPhotoURLSnapshot,
      text: response.text || null,
      emoji: response.emoji,
      kind: 'response' as const,
      createdAt: response.createdAt,
    };
    const reactionActivities = (response.reactions ?? []).map((reaction) => ({
      authorUid: reaction.authorUid,
      authorDisplayName: reaction.authorDisplayName,
      authorPhotoURLSnapshot: reaction.authorPhotoURLSnapshot,
      text: null,
      emoji: reaction.emoji,
      kind: 'reaction' as const,
      createdAt: reaction.createdAt,
    }));

    return [responseActivity, ...reactionActivities].reduce((currentLatest, activity) => {
      if (!currentLatest) {
        return activity;
      }

      return new Date(activity.createdAt).getTime() > new Date(currentLatest.createdAt).getTime()
        ? activity
        : currentLatest;
    }, latest);
  }, null);

  return {
    postId,
    latestResponseId: latestResponse?.id ?? null,
    latestResponseCreatedAt: latestResponse?.createdAt ?? null,
    latestActivityAt: latestActivity?.createdAt ?? null,
    latestActivityAuthorUid: latestActivity?.authorUid ?? null,
    latestActivityAuthorDisplayName: latestActivity?.authorDisplayName ?? null,
    latestActivityAuthorPhotoURLSnapshot: latestActivity?.authorPhotoURLSnapshot ?? null,
    latestActivityText: latestActivity?.text ?? null,
    latestActivityEmoji: latestActivity?.emoji ?? null,
    latestActivityKind: latestActivity?.kind ?? null,
    updatedAt,
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
      reply_to_response_id,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid, post_id, id) DO UPDATE SET
      author_uid = excluded.author_uid,
      author_display_name = excluded.author_display_name,
      author_photo_url_snapshot = excluded.author_photo_url_snapshot,
      emoji = excluded.emoji,
      text = excluded.text,
      reply_to_response_id = excluded.reply_to_response_id,
      created_at = excluded.created_at`,
    userUid,
    response.postId,
    response.id,
    response.authorUid,
    response.authorDisplayName,
    response.authorPhotoURLSnapshot,
    response.emoji,
    response.text,
    response.replyToResponseId ?? null,
    response.createdAt
  );
}

async function insertCachedSharedPostResponseReaction(
  tx: SQLiteTransactionExecutor,
  userUid: string,
  reaction: SharedPostResponseReaction
) {
  await tx.runAsync(
    `INSERT INTO shared_post_response_reactions_cache (
      user_uid,
      post_id,
      response_id,
      id,
      author_uid,
      author_display_name,
      author_photo_url_snapshot,
      emoji,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid, response_id, author_uid) DO UPDATE SET
      id = excluded.id,
      post_id = excluded.post_id,
      author_display_name = excluded.author_display_name,
      author_photo_url_snapshot = excluded.author_photo_url_snapshot,
      emoji = excluded.emoji,
      created_at = excluded.created_at`,
    userUid,
    reaction.postId,
    reaction.responseId,
    reaction.id,
    reaction.authorUid,
    reaction.authorDisplayName,
    reaction.authorPhotoURLSnapshot,
    reaction.emoji,
    reaction.createdAt
  );
}

async function selectCachedSharedPostResponses(
  reader: SQLiteReader,
  userUid: string,
  postId: string,
  options?: { limit?: number; beforeCreatedAt?: string | null }
) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return [];
  }

  const limit = Math.max(1, Math.min(options?.limit ?? 50, 100));
  const beforeCreatedAt = options?.beforeCreatedAt?.trim() || null;
  const rows = beforeCreatedAt
    ? await reader.getAllAsync<SharedPostResponseCacheRow>(
        `SELECT id,
                post_id,
                author_uid,
                author_display_name,
                author_photo_url_snapshot,
                emoji,
                text,
                reply_to_response_id,
                created_at
         FROM shared_post_responses_cache
         WHERE user_uid = ?
           AND post_id = ?
           AND created_at < ?
         ORDER BY created_at DESC
         LIMIT ?`,
        userUid,
        normalizedPostId,
        beforeCreatedAt,
        limit
      )
    : await reader.getAllAsync<SharedPostResponseCacheRow>(
        `SELECT id,
                post_id,
                author_uid,
                author_display_name,
                author_photo_url_snapshot,
                emoji,
                text,
                reply_to_response_id,
                created_at
         FROM shared_post_responses_cache
         WHERE user_uid = ?
           AND post_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        userUid,
        normalizedPostId,
        limit
      );

  const responses = rows.map(rowToSharedPostResponse).reverse();
  const responseIds = responses.map((response) => response.id);
  if (responseIds.length === 0) {
    return responses;
  }

  const placeholders = responseIds.map(() => '?').join(', ');
  const reactionRows = await reader.getAllAsync<SharedPostResponseReactionCacheRow>(
    `SELECT id,
            post_id,
            response_id,
            author_uid,
            author_display_name,
            author_photo_url_snapshot,
            emoji,
            created_at
     FROM shared_post_response_reactions_cache
     WHERE user_uid = ?
       AND response_id IN (${placeholders})
     ORDER BY created_at ASC`,
    userUid,
    ...responseIds
  );
  const reactionsByResponseId = new Map<string, SharedPostResponseReaction[]>();
  for (const reaction of reactionRows.map(rowToSharedPostResponseReaction)) {
    const current = reactionsByResponseId.get(reaction.responseId) ?? [];
    current.push(reaction);
    reactionsByResponseId.set(reaction.responseId, current);
  }

  return responses.map((response) => ({
    ...response,
    reactions: reactionsByResponseId.get(response.id) ?? [],
  }));
}

async function upsertCachedSharedThreadSummaryInTransaction(
  tx: SQLiteTransactionExecutor,
  userUid: string,
  summary: SharedThreadSummary
) {
  await tx.runAsync(
    `INSERT INTO shared_thread_summaries_cache (
      user_uid,
      post_id,
      latest_response_id,
      latest_response_created_at,
      latest_activity_at,
      latest_activity_author_uid,
      latest_activity_author_display_name,
      latest_activity_author_photo_url_snapshot,
      latest_activity_text,
      latest_activity_emoji,
      latest_activity_kind,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid, post_id) DO UPDATE SET
      latest_response_id = excluded.latest_response_id,
      latest_response_created_at = excluded.latest_response_created_at,
      latest_activity_at = excluded.latest_activity_at,
      latest_activity_author_uid = excluded.latest_activity_author_uid,
      latest_activity_author_display_name = excluded.latest_activity_author_display_name,
      latest_activity_author_photo_url_snapshot = excluded.latest_activity_author_photo_url_snapshot,
      latest_activity_text = excluded.latest_activity_text,
      latest_activity_emoji = excluded.latest_activity_emoji,
      latest_activity_kind = excluded.latest_activity_kind,
      updated_at = excluded.updated_at`,
    userUid,
    summary.postId,
    summary.latestResponseId,
    summary.latestResponseCreatedAt,
    summary.latestActivityAt,
    summary.latestActivityAuthorUid,
    summary.latestActivityAuthorDisplayName,
    summary.latestActivityAuthorPhotoURLSnapshot,
    summary.latestActivityText,
    summary.latestActivityEmoji,
    summary.latestActivityKind,
    summary.updatedAt
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
  const db = await getDB();
  return selectCachedSharedPostResponses(db, userUid, postId);
}

export async function getCachedSharedPostResponsesPage(
  userUid: string,
  postId: string,
  options: { limit?: number; beforeCreatedAt?: string | null } = {}
): Promise<SharedPostResponse[]> {
  const db = await getDB();
  return selectCachedSharedPostResponses(db, userUid, postId, options);
}

export async function getCachedSharedThreadSummaries(
  userUid: string,
  postIds?: string[]
): Promise<SharedThreadSummary[]> {
  const db = await getDB();
  const normalizedPostIds = postIds
    ? Array.from(new Set(postIds.map((postId) => postId.trim()).filter(Boolean)))
    : [];

  const rows =
    postIds && normalizedPostIds.length === 0
      ? []
      : normalizedPostIds.length > 0
        ? await db.getAllAsync<SharedThreadSummaryRow>(
            `SELECT post_id,
                    latest_response_id,
                    latest_response_created_at,
                    latest_activity_at,
                    latest_activity_author_uid,
                    latest_activity_author_display_name,
                    latest_activity_author_photo_url_snapshot,
                    latest_activity_text,
                    latest_activity_emoji,
                    latest_activity_kind,
                    updated_at
             FROM shared_thread_summaries_cache
             WHERE user_uid = ?
               AND post_id IN (${normalizedPostIds.map(() => '?').join(', ')})`,
            userUid,
            ...normalizedPostIds
          )
        : await db.getAllAsync<SharedThreadSummaryRow>(
            `SELECT post_id,
                    latest_response_id,
                    latest_response_created_at,
                    latest_activity_at,
                    latest_activity_author_uid,
                    latest_activity_author_display_name,
                    latest_activity_author_photo_url_snapshot,
                    latest_activity_text,
                    latest_activity_emoji,
                    latest_activity_kind,
                    updated_at
             FROM shared_thread_summaries_cache
             WHERE user_uid = ?`,
            userUid
          );

  return rows.map(rowToSharedThreadSummary);
}

export async function replaceCachedSharedThreadSummaries(
  userUid: string,
  summaries: SharedThreadSummary[]
): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    for (const summary of summaries) {
      await upsertCachedSharedThreadSummaryInTransaction(tx, userUid, summary);
    }
  });
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
    await tx.runAsync(
      'DELETE FROM shared_post_response_reactions_cache WHERE user_uid = ? AND post_id = ?',
      userUid,
      normalizedPostId
    );

    for (const response of responses) {
      await insertCachedSharedPostResponse(tx, userUid, response);
      for (const reaction of response.reactions ?? []) {
        await insertCachedSharedPostResponseReaction(tx, userUid, reaction);
      }
    }
    await upsertCachedSharedThreadSummaryInTransaction(
      tx,
      userUid,
      deriveSharedThreadSummaryFromResponses(normalizedPostId, responses)
    );
  });
}

export async function upsertCachedSharedPostResponse(
  userUid: string,
  response: SharedPostResponse
): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    await insertCachedSharedPostResponse(tx, userUid, response);
    for (const reaction of response.reactions ?? []) {
      await insertCachedSharedPostResponseReaction(tx, userUid, reaction);
    }
    const currentResponses = await selectCachedSharedPostResponses(tx, userUid, response.postId);
    const nextResponses = currentResponses.some((item) => item.id === response.id)
      ? currentResponses.map((item) => (item.id === response.id ? response : item))
      : [...currentResponses, response].sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        );
    await upsertCachedSharedThreadSummaryInTransaction(
      tx,
      userUid,
      deriveSharedThreadSummaryFromResponses(response.postId, nextResponses)
    );
  });
}

export async function upsertCachedSharedPostResponseReaction(
  userUid: string,
  reaction: SharedPostResponseReaction
): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    await insertCachedSharedPostResponseReaction(tx, userUid, reaction);
    const currentResponses = await selectCachedSharedPostResponses(tx, userUid, reaction.postId);
    const nextResponses = currentResponses.map((response) =>
      response.id === reaction.responseId
        ? {
            ...response,
            reactions: [
              ...(response.reactions ?? []).filter((item) => item.authorUid !== reaction.authorUid),
              reaction,
            ],
          }
        : response
    );
    await upsertCachedSharedThreadSummaryInTransaction(
      tx,
      userUid,
      deriveSharedThreadSummaryFromResponses(reaction.postId, nextResponses)
    );
  });
}

export async function getCachedSharedThreadReadStates(
  userUid: string
): Promise<SharedThreadReadState[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<SharedThreadReadStateRow>(
    `SELECT post_id,
            user_uid,
            last_read_response_id,
            last_read_at
     FROM shared_thread_read_state
     WHERE user_uid = ?`,
    userUid
  );

  return rows.map(rowToSharedThreadReadState);
}

export async function markCachedSharedThreadRead(
  userUid: string,
  postId: string,
  lastReadResponseId: string | null,
  readAt = new Date().toISOString()
): Promise<SharedThreadReadState | null> {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return null;
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO shared_thread_read_state (
        user_uid,
        post_id,
        last_read_response_id,
        last_read_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_uid, post_id) DO UPDATE SET
        last_read_response_id = excluded.last_read_response_id,
        last_read_at = excluded.last_read_at`,
      userUid,
      normalizedPostId,
      lastReadResponseId,
      readAt
    );
  });

  return {
    postId: normalizedPostId,
    userUid,
    lastReadResponseId,
    lastReadAt: readAt,
  };
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
      await tx.runAsync('DELETE FROM shared_post_response_reactions_cache');
      await tx.runAsync('DELETE FROM shared_thread_summaries_cache');
      await tx.runAsync('DELETE FROM shared_thread_read_state');
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
    await tx.runAsync('DELETE FROM shared_post_response_reactions_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_thread_summaries_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_thread_read_state WHERE user_uid = ?', userUid);
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
