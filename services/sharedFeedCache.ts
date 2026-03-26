import type { FriendConnection, FriendInvite, SharedFeedSnapshot, SharedPost } from './sharedFeedService';
import { getDB, withDatabaseTransaction } from './database';

interface FriendRow {
  friend_uid: string;
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
  doodle_strokes_json: string | null;
  sticker_placements_json: string | null;
  place_name: string | null;
  source_note_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface MetaRow {
  last_updated_at: string | null;
}

interface InviteRow {
  id: string;
  inviter_uid: string;
  inviter_display_name_snapshot: string | null;
  inviter_photo_url_snapshot: string | null;
  token: string;
  created_at: string;
  revoked_at: string | null;
  accepted_by_uid: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  url: string;
}

function rowToFriend(row: FriendRow): FriendConnection {
  return {
    userId: row.friend_uid,
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
    doodleStrokesJson: row.doodle_strokes_json,
    hasStickers: Boolean(row.sticker_placements_json),
    stickerPlacementsJson: row.sticker_placements_json,
    placeName: row.place_name,
    sourceNoteId: row.source_note_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInvite(row: InviteRow): FriendInvite {
  return {
    id: row.id,
    inviterUid: row.inviter_uid,
    inviterDisplayNameSnapshot: row.inviter_display_name_snapshot,
    inviterPhotoURLSnapshot: row.inviter_photo_url_snapshot,
    token: row.token,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    acceptedByUid: row.accepted_by_uid,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    url: row.url,
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
          display_name_snapshot,
          photo_url_snapshot,
          friended_at,
          last_shared_at,
          created_by_invite_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        friend.userId,
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
          doodle_strokes_json,
          sticker_placements_json,
          place_name,
          source_note_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        post.doodleStrokesJson ?? null,
        post.stickerPlacementsJson ?? null,
        post.placeName,
        post.sourceNoteId,
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
  const db = await getDB();
  const row = await db.getFirstAsync<InviteRow>(
    `SELECT *
     FROM shared_invites_cache
     WHERE user_uid = ?`,
    userUid
  );

  return row ? rowToInvite(row) : null;
}

export async function replaceCachedActiveInvite(
  userUid: string,
  invite: FriendInvite | null
): Promise<void> {
  const cachedAt = new Date().toISOString();

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_invites_cache WHERE user_uid = ?', userUid);

    if (invite) {
      await tx.runAsync(
        `INSERT INTO shared_invites_cache (
          user_uid,
          id,
          inviter_uid,
          inviter_display_name_snapshot,
          inviter_photo_url_snapshot,
          token,
          created_at,
          revoked_at,
          accepted_by_uid,
          accepted_at,
          expires_at,
          url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        invite.id,
        invite.inviterUid,
        invite.inviterDisplayNameSnapshot,
        invite.inviterPhotoURLSnapshot,
        invite.token,
        invite.createdAt,
        invite.revokedAt,
        invite.acceptedByUid,
        invite.acceptedAt,
        invite.expiresAt,
        invite.url
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
    return;
  }

  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync('DELETE FROM shared_friends_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_posts_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_invites_cache WHERE user_uid = ?', userUid);
    await tx.runAsync('DELETE FROM shared_feed_cache_meta WHERE user_uid = ?', userUid);
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
          display_name_snapshot,
          photo_url_snapshot,
          friended_at,
          last_shared_at,
          created_by_invite_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        friend.userId,
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
          doodle_strokes_json,
          place_name,
          source_note_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        post.doodleStrokesJson ?? null,
        post.placeName,
        post.sourceNoteId,
        post.createdAt,
        post.updatedAt
      );
    }

    if (snapshot.activeInvite) {
      await tx.runAsync(
        `INSERT INTO shared_invites_cache (
          user_uid,
          id,
          inviter_uid,
          inviter_display_name_snapshot,
          inviter_photo_url_snapshot,
          token,
          created_at,
          revoked_at,
          accepted_by_uid,
          accepted_at,
          expires_at,
          url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userUid,
        snapshot.activeInvite.id,
        snapshot.activeInvite.inviterUid,
        snapshot.activeInvite.inviterDisplayNameSnapshot,
        snapshot.activeInvite.inviterPhotoURLSnapshot,
        snapshot.activeInvite.token,
        snapshot.activeInvite.createdAt,
        snapshot.activeInvite.revokedAt,
        snapshot.activeInvite.acceptedByUid,
        snapshot.activeInvite.acceptedAt,
        snapshot.activeInvite.expiresAt,
        snapshot.activeInvite.url
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

export async function getCachedSharedFeedSnapshot(userUid: string): Promise<{
  friends: FriendConnection[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
  lastUpdatedAt: string | null;
}> {
  const [friends, sharedPosts, activeInvite, lastUpdatedAt] = await Promise.all([
    getCachedSharedFriends(userUid),
    getCachedSharedPosts(userUid),
    getCachedActiveInvite(userUid),
    getSharedFeedCacheLastUpdatedAt(userUid),
  ]);

  return {
    friends,
    sharedPosts,
    activeInvite,
    lastUpdatedAt,
  };
}
