import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { AppUser, getUserDisplayName } from '../utils/appUser';
import {
  getCurrentSupabaseSession,
  getSupabase,
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
  isSupabasePolicyError,
  isSupabaseSchemaMismatchError,
  isSupabaseStorageObjectMissingError,
} from '../utils/supabase';
import { Note, NoteType } from './database';
import { normalizeSavedTextNoteColor } from './noteAppearance';
import {
  deletePairedVideoFromStorage,
  deletePhotoFromStorage,
  SHARED_POST_MEDIA_BUCKET,
  uploadPhotoToStorage,
  uploadPairedVideoToStorage,
} from './remoteMedia';
import { getPairedVideoFileExtension } from './livePhotoStorage';
import {
  clearRemoteStickerAssetRefs,
  parseNoteStickerPlacements,
  reconcileRemoteStickerAssetRefs,
  serializeStickerPlacementsForStorage,
} from './noteStickers';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { getPublicUserProfile, upsertPublicUserProfile } from './publicProfileService';
import {
  cacheSharedFeedSnapshot,
  getCachedActiveInvite,
  replaceCachedActiveInvite,
} from './sharedFeedCache';
import {
  clearStoredInviteToken,
  setStoredInviteToken,
} from './inviteTokenStorage';
import { sendSocialNotificationEvent } from './socialPushService';

export interface FriendConnection {
  userId: string;
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
  friendedAt: string;
  lastSharedAt: string | null;
  createdByInviteId: string | null;
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

function getRemotePairedVideoPath(basePath: string, localUri: string | null | undefined) {
  return `${basePath}.motion${getPairedVideoFileExtension(localUri)}`;
}

export interface SharedPost {
  id: string;
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  audienceUserIds: string[];
  type: NoteType;
  text: string;
  photoPath: string | null;
  photoLocalUri: string | null;
  isLivePhoto?: boolean;
  pairedVideoPath?: string | null;
  pairedVideoLocalUri?: string | null;
  doodleStrokesJson?: string | null;
  hasStickers?: boolean;
  stickerPlacementsJson?: string | null;
  noteColor?: string | null;
  placeName: string | null;
  sourceNoteId: string | null;
  latitude?: number | null;
  longitude?: number | null;
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

interface FriendshipRow {
  user_id: string;
  friend_user_id: string;
  display_name_snapshot: string | null;
  photo_url_snapshot: string | null;
  friended_at: string;
  last_shared_at: string | null;
  created_by_invite_id: string | null;
}

interface FriendInviteRow {
  id: string;
  inviter_user_id: string;
  inviter_display_name_snapshot: string | null;
  inviter_photo_url_snapshot: string | null;
  token_hash?: string | null;
  created_at: string;
  revoked_at: string | null;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  expires_at: string | null;
}

interface SharedPostRow {
  id: string;
  author_user_id: string;
  author_display_name: string | null;
  author_photo_url_snapshot: string | null;
  audience_user_ids: string[];
  type: NoteType;
  text: string;
  photo_path: string | null;
  is_live_photo: boolean;
  paired_video_path: string | null;
  doodle_strokes_json?: string | null;
  sticker_placements_json?: string | null;
  note_color?: string | null;
  place_name: string | null;
  source_note_id: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string | null;
}

interface SharedPostTombstoneRow {
  post_id: string;
  author_user_id: string;
  deleted_at: string;
}

interface RemoteArtifactSnapshot {
  photoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPlacementsJson?: string | null;
}

const ACTIVE_FRIEND_INVITE_QUERY_LIMIT = 50;
const FRIEND_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHARED_FEED_REFRESH_DEDUPE_WINDOW_MS = 400;
const EXPIRED_SHARED_FEED_SESSION_ERROR = 'Server session unavailable. Sign in again to use shared moments.';
const MISMATCHED_SHARED_FEED_SESSION_ERROR =
  'Signed-in session does not match this account. Sign out and sign in again.';
const sharedFeedRefreshState = new Map<
  string,
  {
    promise: Promise<SharedFeedSnapshot> | null;
    lastResolvedAt: number;
    lastSnapshot: SharedFeedSnapshot | null;
  }
>();

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Shared feed is unavailable in this build.');
  }

  return supabase;
}

function getNowIso() {
  return new Date().toISOString();
}

function getDisplayName(user: AppUser) {
  return getUserDisplayName(user);
}

function normalizeRemoteArtifactPath(path: string | null | undefined) {
  const normalizedPath = typeof path === 'string' ? path.trim() : '';
  return normalizedPath || null;
}

function normalizeRemoteEntityIds(ids: Iterable<string | null | undefined>) {
  return Array.from(
    new Set(
      Array.from(ids)
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function getRemoteStickerAssetPaths(stickerPlacementsJson: string | null | undefined) {
  return Array.from(
    new Set(
      parseNoteStickerPlacements(stickerPlacementsJson)
        .map((placement) => normalizeRemoteArtifactPath(placement.asset.remotePath))
        .filter((path): path is string => Boolean(path))
    )
  );
}

function buildNewRemoteArtifacts(
  next: RemoteArtifactSnapshot,
  previous: RemoteArtifactSnapshot | null | undefined
) {
  const previousStickerPaths = new Set(getRemoteStickerAssetPaths(previous?.stickerPlacementsJson));
  return {
    photoPath:
      normalizeRemoteArtifactPath(next.photoPath) !== normalizeRemoteArtifactPath(previous?.photoPath)
        ? normalizeRemoteArtifactPath(next.photoPath)
        : null,
    pairedVideoPath:
      normalizeRemoteArtifactPath(next.pairedVideoPath) !== normalizeRemoteArtifactPath(previous?.pairedVideoPath)
        ? normalizeRemoteArtifactPath(next.pairedVideoPath)
        : null,
    stickerPaths: getRemoteStickerAssetPaths(next.stickerPlacementsJson).filter(
      (path) => !previousStickerPaths.has(path)
    ),
  };
}

function buildRemovedRemoteArtifacts(
  previous: RemoteArtifactSnapshot | null | undefined,
  next: RemoteArtifactSnapshot | null | undefined
) {
  const nextStickerPaths = new Set(getRemoteStickerAssetPaths(next?.stickerPlacementsJson));
  return {
    photoPath:
      normalizeRemoteArtifactPath(previous?.photoPath) !== normalizeRemoteArtifactPath(next?.photoPath)
        ? normalizeRemoteArtifactPath(previous?.photoPath)
        : null,
    pairedVideoPath:
      normalizeRemoteArtifactPath(previous?.pairedVideoPath) !==
      normalizeRemoteArtifactPath(next?.pairedVideoPath)
        ? normalizeRemoteArtifactPath(previous?.pairedVideoPath)
        : null,
    stickerPaths: getRemoteStickerAssetPaths(previous?.stickerPlacementsJson).filter(
      (path) => !nextStickerPaths.has(path)
    ),
  };
}

async function cleanupRemoteArtifacts(
  bucket: string,
  artifacts: {
    photoPath?: string | null;
    pairedVideoPath?: string | null;
    stickerPaths?: string[];
  },
  options: { strict?: boolean } = {}
) {
  const removals: Promise<unknown>[] = [];

  const photoPath = normalizeRemoteArtifactPath(artifacts.photoPath);
  if (photoPath) {
    removals.push(deletePhotoFromStorage(bucket, photoPath));
  }

  const pairedVideoPath = normalizeRemoteArtifactPath(artifacts.pairedVideoPath);
  if (pairedVideoPath) {
    removals.push(deletePairedVideoFromStorage(bucket, pairedVideoPath));
  }

  for (const stickerPath of artifacts.stickerPaths ?? []) {
    removals.push(deletePhotoFromStorage(bucket, stickerPath));
  }

  if (removals.length === 0) {
    return;
  }

  if (!options.strict) {
    await Promise.allSettled(removals);
    return;
  }

  const results = await Promise.allSettled(removals);
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult =>
      result.status === 'rejected' && !isSupabaseStorageObjectMissingError(result.reason)
  );
  if (firstFailure) {
    throw firstFailure.reason;
  }
}

function getReusableSharedPostCleanupArtifacts(artifacts: {
  photoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPaths?: string[];
}) {
  return {
    photoPath: artifacts.photoPath ?? null,
    pairedVideoPath: artifacts.pairedVideoPath ?? null,
  };
}

function collectDeletedIds<Row extends Record<string, unknown>>(
  rows: Row[] | null | undefined,
  idField: keyof Row
) {
  return normalizeRemoteEntityIds(
    (rows ?? []).map((row) => {
      const value = row?.[idField];
      return typeof value === 'string' ? value : null;
    })
  );
}

type MissingDeleteVerifier = (missingIds: string[]) => Promise<string[]>;

async function assertExpectedDeleteIds(
  entityLabel: string,
  expectedIds: string[],
  deletedIds: string[],
  verifyMissingIds?: MissingDeleteVerifier
) {
  if (expectedIds.length === 0) {
    return;
  }

  const deletedSet = new Set(deletedIds);
  let missingIds = expectedIds.filter((id) => !deletedSet.has(id));
  if (missingIds.length > 0 && verifyMissingIds) {
    const stillExistingIds = normalizeRemoteEntityIds(await verifyMissingIds(missingIds));
    if (stillExistingIds.length === 0) {
      return;
    }

    const stillExistingSet = new Set(stillExistingIds);
    missingIds = missingIds.filter((id) => stillExistingSet.has(id));
  }

  if (missingIds.length > 0) {
    throw new Error(
      `Remote ${entityLabel} delete did not remove expected rows: ${missingIds.join(', ')}`
    );
  }
}

async function upsertSharedPostTombstones(
  authorUserId: string,
  postIds: Iterable<string>,
  deletedAt: string
) {
  const rows = Array.from(
    new Set(
      Array.from(postIds)
        .map((postId) => (typeof postId === 'string' ? postId.trim() : ''))
        .filter(Boolean)
    )
  ).map(
    (postId): SharedPostTombstoneRow => ({
      post_id: postId,
      author_user_id: authorUserId,
      deleted_at: deletedAt,
    })
  );

  if (rows.length === 0) {
    return;
  }

  const { error } = await requireSupabase().from('shared_post_tombstones').upsert(rows, {
    onConflict: 'post_id',
  });
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[shared-feed] Skipping shared post tombstone write:', error);
      return;
    }

    throw error;
  }
}

function getRemoteStickerAssetPathMap(stickerPlacementsJson: string | null | undefined) {
  const pathMap: Record<string, string> = {};

  for (const placement of parseNoteStickerPlacements(stickerPlacementsJson)) {
    const remotePath = placement.asset.remotePath?.trim();
    if (!remotePath) {
      continue;
    }

    pathMap[placement.asset.id] = remotePath;
  }

  return pathMap;
}

async function deleteSharedPostTombstone(authorUserId: string, postId: string) {
  const { error } = await requireSupabase()
    .from('shared_post_tombstones')
    .delete()
    .eq('post_id', postId)
    .eq('author_user_id', authorUserId);
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[shared-feed] Skipping shared post tombstone cleanup:', error);
      return;
    }

    throw error;
  }
}

async function ensureSupabaseSessionMatchesUser(userId: string) {
  const session = await getCurrentSupabaseSession();
  const sessionUserId = session?.user?.id?.trim();

  if (!sessionUserId) {
    throw new Error(EXPIRED_SHARED_FEED_SESSION_ERROR);
  }

  if (sessionUserId !== userId) {
    throw new Error(MISMATCHED_SHARED_FEED_SESSION_ERROR);
  }
}

function isInviteActive(record: FriendInviteRow, nowMs = Date.now()) {
  return (
    !record.revoked_at &&
    !record.accepted_by_user_id &&
    (!record.expires_at || new Date(record.expires_at).getTime() > nowMs)
  );
}

async function getFriendInviteDocumentId(userUid: string) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `noto-friend-invite:${userUid}`
  );

  return `friend-invite-${digest.slice(0, 24)}`;
}

async function getInviteTokenHash(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return '';
  }

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizedToken
  );
}

function buildInviteUrl(inviteId: string, token: string) {
  return Linking.createURL('/friends/join', {
    queryParams: {
      inviteId,
      invite: token,
    },
  });
}

function mapInvite(record: FriendInviteRow, token: string): FriendInvite {
  return {
    id: record.id,
    inviterUid: record.inviter_user_id,
    inviterDisplayNameSnapshot: record.inviter_display_name_snapshot ?? null,
    inviterPhotoURLSnapshot: record.inviter_photo_url_snapshot ?? null,
    token,
    createdAt: record.created_at,
    revokedAt: record.revoked_at ?? null,
    acceptedByUid: record.accepted_by_user_id ?? null,
    acceptedAt: record.accepted_at ?? null,
    expiresAt: record.expires_at ?? null,
    url: buildInviteUrl(record.id, token),
  };
}

function mapFriend(row: FriendshipRow): FriendConnection {
  return {
    userId: row.friend_user_id,
    displayNameSnapshot: row.display_name_snapshot ?? null,
    photoURLSnapshot: row.photo_url_snapshot ?? null,
    friendedAt: row.friended_at,
    lastSharedAt: row.last_shared_at ?? null,
    createdByInviteId: row.created_by_invite_id ?? null,
  };
}

function normalizeCoordinate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function shouldIncludeSharedPostInFeed(post: SharedPost, viewerUid: string, friendUids: Set<string>) {
  if (post.authorUid === viewerUid) {
    return post.audienceUserIds.some((audienceUid) => audienceUid !== viewerUid && friendUids.has(audienceUid));
  }

  return friendUids.has(post.authorUid) && post.audienceUserIds.includes(viewerUid);
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

function getSharedPostChangeField(
  payload: unknown,
  field: 'author_user_id' | 'audience_user_ids'
) {
  if (typeof payload !== 'object' || !payload) {
    return null;
  }

  const eventPayload = payload as {
    new?: Record<string, unknown> | null;
    old?: Record<string, unknown> | null;
  };

  if (eventPayload.new && field in eventPayload.new) {
    return eventPayload.new[field] ?? null;
  }

  if (eventPayload.old && field in eventPayload.old) {
    return eventPayload.old[field] ?? null;
  }

  return null;
}

function shouldRefreshForSharedPostChange(payload: unknown, userId: string) {
  const authorUserId = getSharedPostChangeField(payload, 'author_user_id');
  if (typeof authorUserId === 'string' && authorUserId.trim() === userId) {
    return true;
  }

  const audienceUserIds = getSharedPostChangeField(payload, 'audience_user_ids');
  if (Array.isArray(audienceUserIds)) {
    return audienceUserIds.some((value) => typeof value === 'string' && value.trim() === userId);
  }

  return false;
}

function mapSharedPost(record: SharedPostRow): SharedPost {
  return {
    id: record.id,
    authorUid: record.author_user_id,
    authorDisplayName: record.author_display_name ?? null,
    authorPhotoURLSnapshot: record.author_photo_url_snapshot ?? null,
    audienceUserIds: Array.isArray(record.audience_user_ids) ? record.audience_user_ids : [],
    type: record.type,
    text: record.text ?? '',
    photoPath: record.photo_path ?? null,
    photoLocalUri: null,
    isLivePhoto: Boolean(record.is_live_photo && record.paired_video_path),
    pairedVideoPath: record.paired_video_path ?? null,
    pairedVideoLocalUri: null,
    doodleStrokesJson: record.doodle_strokes_json ?? null,
    hasStickers: Boolean(record.sticker_placements_json),
    stickerPlacementsJson: record.sticker_placements_json ?? null,
    noteColor: record.note_color ?? null,
    placeName: record.place_name ?? null,
    sourceNoteId: record.source_note_id ?? null,
    latitude: normalizeCoordinate(record.latitude),
    longitude: normalizeCoordinate(record.longitude),
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? null,
  };
}

async function getUserProfileSnapshot(userUid: string) {
  return getPublicUserProfile(userUid);
}

async function getFriendsForUser(userUid: string) {
  const { data, error } = await requireSupabase()
    .from('friendships')
    .select(
      'user_id, friend_user_id, display_name_snapshot, photo_url_snapshot, friended_at, last_shared_at, created_by_invite_id'
    )
    .eq('user_id', userUid)
    .order('friended_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as FriendshipRow[]).map(mapFriend);
}

export function getSharedFeedErrorMessage(error: unknown) {
  const message = getSupabaseErrorMessage(error);

  if (
    message === EXPIRED_SHARED_FEED_SESSION_ERROR ||
    message === MISMATCHED_SHARED_FEED_SESSION_ERROR
  ) {
    return 'Your sign-in session expired. Sign out and sign back in to keep sharing moments.';
  }

  if (isSupabasePolicyError(error)) {
    return 'Shared moments are not available for this account right now. Please sign in again and try once more.';
  }

  if (isSupabaseNetworkError(error)) {
    return 'The server is unavailable right now. Check your connection and try again.';
  }

  return message || 'Shared moments are unavailable right now.';
}

export async function getActiveFriendInvite(user: AppUser): Promise<FriendInvite | null> {
  const { data, error } = await requireSupabase()
    .from('friend_invites')
    .select(
      'id, inviter_user_id, inviter_display_name_snapshot, inviter_photo_url_snapshot, created_at, revoked_at, accepted_by_user_id, accepted_at, expires_at'
    )
    .eq('inviter_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(ACTIVE_FRIEND_INVITE_QUERY_LIMIT);

  if (error) {
    throw error;
  }

  const invite = ((data ?? []) as FriendInviteRow[]).find((item) => isInviteActive(item));
  if (!invite) {
    await Promise.all([
      clearStoredInviteToken(user.id).catch(() => undefined),
      replaceCachedActiveInvite(user.id, null).catch(() => undefined),
    ]);
    return null;
  }

  const cachedInvite = await getCachedActiveInvite(user.id).catch(() => null);
  if (!cachedInvite || cachedInvite.id !== invite.id || !cachedInvite.token.trim()) {
    return null;
  }

  return mapInvite(invite, cachedInvite.token);
}

async function performSharedFeedRefresh(user: AppUser): Promise<SharedFeedSnapshot> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const friends = await getFriendsForUser(user.id);
  const friendUids = friends.map((friend: FriendConnection) => friend.userId);
  const friendUidSet = new Set(friendUids);

  const [activeInvite, postsResponse] = await Promise.all([
    getActiveFriendInvite(user),
    requireSupabase()
      .from('shared_posts')
      .select(
        'id, author_user_id, author_display_name, author_photo_url_snapshot, audience_user_ids, type, text, photo_path, is_live_photo, paired_video_path, doodle_strokes_json, sticker_placements_json, note_color, place_name, source_note_id, latitude, longitude, created_at, updated_at'
      )
      .contains('audience_user_ids', [user.id])
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (postsResponse.error) {
    throw postsResponse.error;
  }

  const sharedPosts = ((postsResponse.data ?? []) as SharedPostRow[])
    .map(mapSharedPost)
    .filter((post) => shouldIncludeSharedPostInFeed(post, user.id, friendUidSet));

  const snapshot = {
    friends,
    sharedPosts,
    activeInvite,
  };
  await cacheSharedFeedSnapshot(user.id, snapshot);
  return snapshot;
}

export async function refreshSharedFeed(user: AppUser): Promise<SharedFeedSnapshot> {
  const existingState = sharedFeedRefreshState.get(user.id);
  if (existingState?.promise) {
    return existingState.promise;
  }

  if (
    existingState?.lastSnapshot &&
    Date.now() - existingState.lastResolvedAt < SHARED_FEED_REFRESH_DEDUPE_WINDOW_MS
  ) {
    return existingState.lastSnapshot;
  }

  const nextState = existingState ?? {
    promise: null,
    lastResolvedAt: 0,
    lastSnapshot: null,
  };

  const refreshPromise = performSharedFeedRefresh(user)
    .then((snapshot) => {
      nextState.promise = null;
      nextState.lastResolvedAt = Date.now();
      nextState.lastSnapshot = snapshot;
      sharedFeedRefreshState.set(user.id, nextState);
      return snapshot;
    })
    .catch((error) => {
      nextState.promise = null;
      sharedFeedRefreshState.set(user.id, nextState);
      throw error;
    });

  nextState.promise = refreshPromise;
  sharedFeedRefreshState.set(user.id, nextState);
  return refreshPromise;
}

export function subscribeToSharedFeed(
  user: AppUser,
  { onSnapshot: handleSnapshot, onError }: SubscribeToSharedFeedOptions
) {
  const supabase = requireSupabase();
  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshInFlight: Promise<void> | null = null;
  let refreshQueued = false;

  const refresh = () => {
    if (disposed) {
      return;
    }

    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = refreshSharedFeed(user)
      .then((snapshot) => {
        if (!disposed) {
          handleSnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (!disposed) {
          onError?.(error);
        }
      })
      .finally(() => {
        refreshInFlight = null;
        if (!disposed && refreshQueued) {
          refreshQueued = false;
          scheduleRefresh();
        }
      });
  };

  const scheduleRefresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refresh();
    }, 120);
  };

  const channel = supabase
    .channel(`shared-feed:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_id=eq.${user.id}`,
      },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_invites',
        filter: `inviter_user_id=eq.${user.id}`,
      },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_posts',
      },
      (payload) => {
        if (shouldRefreshForSharedPostChange(payload, user.id)) {
          scheduleRefresh();
        }
      }
    )
    .subscribe();

  refresh();

  return () => {
    disposed = true;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    void supabase.removeChannel(channel);
  };
}

export async function createFriendInvite(user: AppUser): Promise<FriendInvite> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const supabase = requireSupabase();

  await upsertPublicUserProfile({
    userUid: user.id,
    displayName: getDisplayName(user),
    photoURL: user.photoURL ?? null,
  });

  const existingInvite = await getActiveFriendInvite(user);
  if (existingInvite) {
    return existingInvite;
  }

  const inviteId = await getFriendInviteDocumentId(user.id);
  const inviteToken = Crypto.randomUUID();
  const inviteTokenHash = await getInviteTokenHash(inviteToken);
  const nextInvite: FriendInviteRow = {
    id: inviteId,
    inviter_user_id: user.id,
    inviter_display_name_snapshot: getDisplayName(user),
    inviter_photo_url_snapshot: user.photoURL ?? null,
    token_hash: inviteTokenHash,
    created_at: getNowIso(),
    revoked_at: null,
    accepted_by_user_id: null,
    accepted_at: null,
    expires_at: new Date(Date.now() + FRIEND_INVITE_TTL_MS).toISOString(),
  };

  const { error } = await supabase.from('friend_invites').upsert(nextInvite, {
    onConflict: 'id',
  });
  if (error) {
    throw error;
  }

  await setStoredInviteToken(user.id, {
    inviteId,
    token: inviteToken,
  });

  const localInvite = mapInvite(nextInvite, inviteToken);
  await replaceCachedActiveInvite(user.id, localInvite).catch(() => undefined);
  return localInvite;
}

export async function revokeFriendInvite(user: AppUser, inviteId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('friend_invites')
    .update({
      revoked_at: getNowIso(),
    })
    .eq('id', inviteId)
    .eq('inviter_user_id', user.id);

  if (error) {
    throw error;
  }

  await Promise.all([
    clearStoredInviteToken(user.id).catch(() => undefined),
    replaceCachedActiveInvite(user.id, null).catch(() => undefined),
  ]);
}

export async function acceptFriendInvite(
  user: AppUser,
  inviteValue: string
): Promise<FriendConnection> {
  const { inviteId, token } = parseInvitePayload(inviteValue);

  if (!inviteId && !token) {
    throw new Error('Paste a valid invite link.');
  }

  if (!token) {
    throw new Error('This invite link is invalid.');
  }

  await upsertPublicUserProfile({
    userUid: user.id,
    displayName: getDisplayName(user),
    photoURL: user.photoURL ?? null,
  });

  const { data, error } = await requireSupabase().rpc('accept_friend_invite', {
    invite_token: token,
    invite_id: inviteId || null,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('Invite not found.');
  }

  const connection = mapFriend(row as FriendshipRow);
  const inviterProfile = await getUserProfileSnapshot(connection.userId);

  const resolvedConnection = {
    ...connection,
    displayNameSnapshot: inviterProfile.displayNameSnapshot ?? connection.displayNameSnapshot,
    photoURLSnapshot: inviterProfile.photoURLSnapshot ?? connection.photoURLSnapshot,
  };

  void sendSocialNotificationEvent({
    type: 'friend_accepted',
    friendUserId: resolvedConnection.userId,
  }).catch((error) => {
    console.warn('[shared-feed] Failed to send invite acceptance notification:', error);
  });

  return resolvedConnection;
}

export async function removeFriend(user: AppUser, friendUid: string): Promise<void> {
  const { error } = await requireSupabase().rpc('remove_friend', {
    friend_user_id: friendUid,
  });

  if (error) {
    throw error;
  }
}

export async function createSharedPost(
  user: AppUser,
  note: Note,
  audienceUserIds: string[]
): Promise<SharedPost> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const supabase = requireSupabase();
  const dedupedAudience = Array.from(new Set([user.id, ...audienceUserIds.filter(Boolean)]));

  if (dedupedAudience.length <= 1) {
    throw new Error('Connect a friend before sharing moments.');
  }

  const postId = `shared-post-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
  const now = getNowIso();
  let photoPath: string | null = null;
  let pairedVideoPath: string | null = null;
  let stickerPlacementsJson: string | null = null;

  try {
    photoPath =
      note.type === 'photo'
        ? await uploadPhotoToStorage(
            SHARED_POST_MEDIA_BUCKET,
            `${user.id}/${postId}`,
            note.photoLocalUri ?? note.content
          )
        : null;
    pairedVideoPath =
      note.type === 'photo' && note.isLivePhoto
        ? await uploadPairedVideoToStorage(
            SHARED_POST_MEDIA_BUCKET,
            getRemotePairedVideoPath(`${user.id}/${postId}`, note.pairedVideoLocalUri ?? null),
            note.pairedVideoLocalUri ?? null
          )
        : null;
    const stickerPlacements = parseNoteStickerPlacements(note.stickerPlacementsJson);
    stickerPlacementsJson =
      stickerPlacements.length > 0
        ? await serializeStickerPlacementsForStorage(
            stickerPlacements,
            SHARED_POST_MEDIA_BUCKET,
            `${user.id}/${postId}`,
            {
              persistAssets: false,
              serverOwnerUid: user.id,
            }
          )
        : null;

    const record: SharedPostRow = {
      id: postId,
      author_user_id: user.id,
      author_display_name: getDisplayName(user),
      author_photo_url_snapshot: user.photoURL ?? null,
      audience_user_ids: dedupedAudience,
      type: note.type,
      text: note.type === 'text' ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji) : '',
      photo_path: photoPath ?? null,
      is_live_photo: Boolean(note.isLivePhoto && pairedVideoPath),
      paired_video_path: pairedVideoPath ?? null,
      doodle_strokes_json: note.doodleStrokesJson ?? null,
      sticker_placements_json: stickerPlacementsJson,
      note_color: note.type === 'text' ? normalizeSavedTextNoteColor(note.noteColor) : null,
      place_name: note.locationName ?? null,
      source_note_id: note.id,
      latitude: note.latitude,
      longitude: note.longitude,
      created_at: now,
      updated_at: null,
    };

    const { error } = await supabase.from('shared_posts').insert(record);
    if (error) {
      throw error;
    }

    await reconcileRemoteStickerAssetRefs(user.id, 'shared_post', postId, stickerPlacementsJson);

    const friendRefs = dedupedAudience.filter((uid) => uid !== user.id);
    if (friendRefs.length > 0) {
      await supabase
        .from('friendships')
        .update({ last_shared_at: now })
        .eq('user_id', user.id)
        .in('friend_user_id', friendRefs);
    }

    void sendSocialNotificationEvent({
      type: 'shared_post_created',
      postId,
    }).catch((error) => {
      console.warn('[shared-feed] Failed to send shared post notification:', error);
    });

    return {
      ...mapSharedPost(record),
      photoLocalUri: note.type === 'photo' ? note.photoLocalUri ?? note.content : null,
      pairedVideoLocalUri: note.type === 'photo' ? note.pairedVideoLocalUri ?? null : null,
      hasStickers: Boolean(note.hasStickers && note.stickerPlacementsJson),
      stickerPlacementsJson,
      noteColor: note.type === 'text' ? normalizeSavedTextNoteColor(note.noteColor) : null,
    };
  } catch (error) {
    await cleanupRemoteArtifacts(SHARED_POST_MEDIA_BUCKET, {
      ...getReusableSharedPostCleanupArtifacts({
        photoPath,
        pairedVideoPath,
        stickerPaths: getRemoteStickerAssetPaths(stickerPlacementsJson),
      }),
    });
    throw error;
  }
}

export async function updateSharedPost(
  user: AppUser,
  postId: string,
  note: Note
): Promise<void> {
  const supabase = requireSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('shared_posts')
    .select(
      'id, author_user_id, author_display_name, author_photo_url_snapshot, audience_user_ids, type, text, photo_path, is_live_photo, paired_video_path, doodle_strokes_json, sticker_placements_json, note_color, place_name, source_note_id, latitude, longitude, created_at, updated_at'
    )
    .eq('id', postId)
    .eq('author_user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const current = existing as SharedPostRow | null;
  if (!current) {
    throw new Error('Shared post not found.');
  }

  const currentArtifacts: RemoteArtifactSnapshot = {
    photoPath: current.photo_path ?? null,
    pairedVideoPath: current.paired_video_path ?? null,
    stickerPlacementsJson: current.sticker_placements_json ?? null,
  };
  let nextPhotoPath: string | null = null;
  let nextPairedVideoPath: string | null = null;
  let nextStickerPlacementsJson: string | null = null;

  try {
    nextPhotoPath =
      note.type === 'photo'
        ? await uploadPhotoToStorage(
            SHARED_POST_MEDIA_BUCKET,
            `${user.id}/${postId}`,
            note.photoLocalUri ?? note.content,
            { allowOverwrite: true }
          )
        : null;
    nextPairedVideoPath =
      note.type === 'photo' && note.isLivePhoto
        ? await uploadPairedVideoToStorage(
            SHARED_POST_MEDIA_BUCKET,
            getRemotePairedVideoPath(`${user.id}/${postId}`, note.pairedVideoLocalUri ?? null),
            note.pairedVideoLocalUri ?? null,
            { allowOverwrite: true }
          )
        : null;
    const stickerPlacements = parseNoteStickerPlacements(note.stickerPlacementsJson);
    nextStickerPlacementsJson =
      stickerPlacements.length > 0
        ? await serializeStickerPlacementsForStorage(
            stickerPlacements,
            SHARED_POST_MEDIA_BUCKET,
            `${user.id}/${postId}`,
            {
              persistAssets: false,
              existingRemoteAssetPathsById: getRemoteStickerAssetPathMap(
                current.sticker_placements_json ?? null
              ),
              serverOwnerUid: user.id,
            }
          )
        : null;
  } catch (error) {
    await cleanupRemoteArtifacts(
      SHARED_POST_MEDIA_BUCKET,
      getReusableSharedPostCleanupArtifacts(
        buildNewRemoteArtifacts(
          {
            photoPath: nextPhotoPath,
            pairedVideoPath: nextPairedVideoPath,
            stickerPlacementsJson: nextStickerPlacementsJson,
          },
          currentArtifacts
        )
      )
    );
    throw error;
  }

  const { error } = await supabase
    .from('shared_posts')
    .update({
      text: note.type === 'text' ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji) : '',
      photo_path: nextPhotoPath ?? null,
      is_live_photo: Boolean(note.isLivePhoto && nextPairedVideoPath),
      paired_video_path: nextPairedVideoPath ?? null,
      doodle_strokes_json: note.doodleStrokesJson ?? null,
      sticker_placements_json: nextStickerPlacementsJson,
      note_color: note.type === 'text' ? normalizeSavedTextNoteColor(note.noteColor) : null,
      place_name: note.locationName ?? null,
      latitude: note.latitude,
      longitude: note.longitude,
      updated_at: getNowIso(),
      type: note.type,
    })
    .eq('id', postId)
    .eq('author_user_id', user.id);

  if (error) {
    await cleanupRemoteArtifacts(
      SHARED_POST_MEDIA_BUCKET,
      getReusableSharedPostCleanupArtifacts(
        buildNewRemoteArtifacts(
          {
            photoPath: nextPhotoPath,
            pairedVideoPath: nextPairedVideoPath,
            stickerPlacementsJson: nextStickerPlacementsJson,
          },
          currentArtifacts
        )
      )
    );
    throw error;
  }

  await reconcileRemoteStickerAssetRefs(user.id, 'shared_post', postId, nextStickerPlacementsJson);

  await deleteSharedPostTombstone(user.id, postId);

  await cleanupRemoteArtifacts(
    SHARED_POST_MEDIA_BUCKET,
    getReusableSharedPostCleanupArtifacts(
      buildRemovedRemoteArtifacts(currentArtifacts, {
        photoPath: nextPhotoPath,
        pairedVideoPath: nextPairedVideoPath,
        stickerPlacementsJson: nextStickerPlacementsJson,
      })
    )
  );

}

export async function findOwnedSharedPostIdsForNote(
  user: AppUser,
  noteId: string
): Promise<string[]> {
  const { data, error } = await requireSupabase()
    .from('shared_posts')
    .select('id')
    .eq('author_user_id', user.id)
    .eq('source_note_id', noteId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => item.id as string);
}

export async function deleteOwnedSharedPostsForNotes(
  user: AppUser,
  noteIds: string[]
): Promise<string[]> {
  const dedupedNoteIds = normalizeRemoteEntityIds(noteIds);
  if (dedupedNoteIds.length === 0) {
    return [];
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('shared_posts')
    .select('id, photo_path, paired_video_path, sticker_placements_json')
    .eq('author_user_id', user.id)
    .in('source_note_id', dedupedNoteIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    photo_path?: string | null;
    paired_video_path?: string | null;
  }>;
  if (rows.length === 0) {
    return [];
  }

  const postIds = normalizeRemoteEntityIds(rows.map((row) => row.id));
  const deletedAt = getNowIso();
  await Promise.all(
    rows.map((row) =>
      cleanupRemoteArtifacts(
        SHARED_POST_MEDIA_BUCKET,
        {
          photoPath: row.photo_path ?? null,
          pairedVideoPath: row.paired_video_path ?? null,
        },
        { strict: true }
      )
    )
  );

  const { data: deletedPosts, error: deleteError } = await supabase
    .from('shared_posts')
    .delete()
    .eq('author_user_id', user.id)
    .in('id', postIds)
    .select('id');

  if (deleteError) {
    throw deleteError;
  }
  await assertExpectedDeleteIds(
    'shared post',
    postIds,
    collectDeletedIds(deletedPosts as { id?: string | null }[] | null | undefined, 'id'),
    async (missingIds) => {
      const { data: remainingPosts, error: remainingPostsError } = await supabase
        .from('shared_posts')
        .select('id')
        .eq('author_user_id', user.id)
        .in('id', missingIds);

      if (remainingPostsError) {
        throw remainingPostsError;
      }

      return collectDeletedIds(
        remainingPosts as { id?: string | null }[] | null | undefined,
        'id'
      );
    }
  );

  await upsertSharedPostTombstones(user.id, postIds, deletedAt);

  await Promise.all(
    rows.map(async (row) => {
      await clearRemoteStickerAssetRefs(user.id, 'shared_post', row.id);
    })
  );

  return postIds;
}

export async function deleteSharedPost(
  user: AppUser,
  postId: string
): Promise<void> {
  const supabase = requireSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('shared_posts')
    .select('photo_path, paired_video_path, sticker_placements_json')
    .eq('id', postId)
    .eq('author_user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const expectedDeletedPostIds = existing ? [postId] : [];
  await cleanupRemoteArtifacts(
    SHARED_POST_MEDIA_BUCKET,
    {
      photoPath: (existing as { photo_path?: string | null } | null)?.photo_path ?? null,
      pairedVideoPath:
        (existing as { paired_video_path?: string | null } | null)?.paired_video_path ?? null,
    },
    { strict: true }
  );

  const { data: deletedPosts, error } = await supabase
    .from('shared_posts')
    .delete()
    .eq('id', postId)
    .eq('author_user_id', user.id)
    .select('id');

  if (error) {
    throw error;
  }
  await assertExpectedDeleteIds(
    'shared post',
    expectedDeletedPostIds,
    collectDeletedIds(deletedPosts as { id?: string | null }[] | null | undefined, 'id'),
    async (missingIds) => {
      const { data: remainingPosts, error: remainingPostsError } = await supabase
        .from('shared_posts')
        .select('id')
        .eq('author_user_id', user.id)
        .in('id', missingIds);

      if (remainingPostsError) {
        throw remainingPostsError;
      }

      return collectDeletedIds(
        remainingPosts as { id?: string | null }[] | null | undefined,
        'id'
      );
    }
  );

  await upsertSharedPostTombstones(user.id, [postId], getNowIso());
  await clearRemoteStickerAssetRefs(user.id, 'shared_post', postId);
}
