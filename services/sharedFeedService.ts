import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as FileSystem from '../utils/fileSystem';
import { AppUser, getUserSocialName } from '../utils/appUser';
import { buildPublicSiteUrl } from './legalLinks';
import {
  getCurrentSupabaseSession,
  getSupabase,
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
  isSupabasePolicyError,
  isSupabaseSchemaMismatchError,
  isSupabaseStorageObjectMissingError,
} from '../utils/supabase';
import {
  Note,
  NoteCaptureVariant,
  NoteDualFacing,
  NoteDualLayoutPreset,
  NoteType,
} from './database';
import { resolveSavedTextNoteColor } from './noteAppearance';
import { getNoteDoodle, parseNoteDoodleStrokes } from './noteDoodles';
import {
  deletePairedVideoFromStorage,
  deletePhotoFromStorage,
  SHARED_POST_MEDIA_BUCKET,
  uploadPhotoToStorage,
  uploadPairedVideoToStorage,
} from './remoteMedia';
import {
  getNoteStickers,
  clearRemoteStickerAssetRefs,
  downloadStickerAssetFromStorage,
  hasStoredStickerPayload,
  parseNoteStickerPlacements,
  reconcileRemoteStickerAssetRefs,
  serializeStickerPlacementsForStorage,
  uploadStickerAssetToStorage,
  type StickerAsset,
  type StickerRenderMode,
  type StickerStampStyle,
} from './noteStickers';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import {
  getPublicUserProfile,
  normalizeUsernameInput,
  upsertPublicUserProfile,
} from './publicProfileService';
import {
  cacheSharedFeedSnapshot,
  getCachedActiveInvite,
  replaceCachedActiveInvite,
} from './sharedFeedCache';
import { sendSocialNotificationEvent } from './socialPushService';
import {
  buildNewRemoteArtifacts,
  buildRemovedRemoteArtifacts,
  buildDualPhotoRemotePath,
  buildUserMediaBasePath,
  getRemotePairedVideoPath,
  getRemoteStickerAssetPaths,
  normalizeRemoteArtifactPath,
  normalizeRemoteEntityIds,
  type RemoteArtifactSnapshot,
} from './remoteArtifactUtils';
import {
  getOwnedSharedNoteIdsFromPosts,
  normalizeOwnedSharedNoteIds,
} from './sharedFeedOwnership';

export interface FriendConnection {
  userId: string;
  username: string | null;
  displayNameSnapshot: string | null;
  nickname: string | null;
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

export interface FriendGroup {
  id: string;
  name: string;
  memberUserIds: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface FriendSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
  photoURL: string | null;
  isSelf: boolean;
  alreadyFriends: boolean;
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
  captureVariant?: NoteCaptureVariant | null;
  dualPrimaryPhotoPath?: string | null;
  dualSecondaryPhotoPath?: string | null;
  dualPrimaryPhotoLocalUri?: string | null;
  dualSecondaryPhotoLocalUri?: string | null;
  dualPrimaryFacing?: NoteDualFacing | null;
  dualSecondaryFacing?: NoteDualFacing | null;
  dualLayoutPreset?: NoteDualLayoutPreset | null;
  isLivePhoto?: boolean;
  pairedVideoPath?: string | null;
  pairedVideoLocalUri?: string | null;
  doodleStrokesJson?: string | null;
  hasStickers?: boolean;
  stickerPlacementsJson?: string | null;
  noteColor?: string | null;
  placeName: string | null;
  sourceNoteId: string | null;
  isDirectChat?: boolean;
  directChatKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SharedPostResponse {
  id: string;
  postId: string;
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  emoji: string | null;
  text: string;
  sticker?: SharedPostResponseSticker | null;
  replyToResponseId?: string | null;
  reactions?: SharedPostResponseReaction[];
  createdAt: string;
}

export interface SharedPostResponseSticker {
  assetId: string;
  localUri: string | null;
  remotePath: string | null;
  mimeType: string;
  width: number;
  height: number;
  renderMode: StickerRenderMode;
  stampStyle?: StickerStampStyle | null;
}

export interface SharedPostResponseStickerInput {
  asset: StickerAsset;
  renderMode?: StickerRenderMode;
  stampStyle?: StickerStampStyle | null;
}

export interface SharedPostResponseReaction {
  id: string;
  postId: string;
  responseId: string;
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  emoji: string;
  createdAt: string;
}

export type SharedPostResponsesConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type DeletedSharedPostResponseReaction = {
  id: string;
  postId: string;
  responseId: string | null;
  authorUid: string | null;
};

export type SharedPostResponsesSubscriptionOptions = {
  initialPageSize?: number;
  onResponses: (responses: SharedPostResponse[]) => void | Promise<void>;
  onResponse?: (response: SharedPostResponse) => void | Promise<void>;
  onResponseDeleted?: (responseId: string) => void | Promise<void>;
  onReaction?: (reaction: SharedPostResponseReaction) => void | Promise<void>;
  onReactionDeleted?: (reaction: DeletedSharedPostResponseReaction) => void | Promise<void>;
  onError?: (error: unknown) => void;
  onStatus?: (status: SharedPostResponsesConnectionStatus) => void;
};

export interface SharedThreadSummary {
  postId: string;
  latestResponseId: string | null;
  latestResponseCreatedAt: string | null;
  latestActivityAt: string | null;
  latestActivityAuthorUid: string | null;
  latestActivityAuthorDisplayName: string | null;
  latestActivityAuthorPhotoURLSnapshot: string | null;
  latestActivityText: string | null;
  latestActivityEmoji: string | null;
  latestActivityKind: 'response' | 'reaction' | null;
  updatedAt: string;
}

export type FriendPresenceStatus = 'online' | 'offline' | 'unknown';

export interface FriendPresenceState {
  status: FriendPresenceStatus;
  lastSeenAt: string | null;
}

export type FriendPresenceSnapshot = Record<string, FriendPresenceState>;

export interface SharedPostTypingUser {
  userId: string;
  displayName: string | null;
  photoURL: string | null;
  updatedAt: string;
}

export interface SharedFeedSnapshot {
  friends: FriendConnection[];
  friendGroups: FriendGroup[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
  ownedSharedNoteIds?: string[];
}

interface SubscribeToSharedFeedOptions {
  onSnapshot: (snapshot: SharedFeedSnapshot) => void;
  onError?: (error: unknown) => void;
}

interface SubscribeToFriendPresenceOptions {
  onPresence: (presence: FriendPresenceSnapshot) => void;
  onError?: (error: unknown) => void;
}

interface SubscribeToSharedPostTypingOptions {
  onTypingUsers: (users: SharedPostTypingUser[]) => void;
  onError?: (error: unknown) => void;
}

interface FriendshipRow {
  user_id: string;
  friend_user_id: string;
  display_name_snapshot: string | null;
  friend_nickname?: string | null;
  photo_url_snapshot: string | null;
  friended_at: string;
  last_shared_at: string | null;
  created_by_invite_id: string | null;
}

interface FriendSearchRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  photo_url: string | null;
  is_self: boolean;
  already_friends: boolean;
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

interface FriendGroupRow {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string | null;
}

interface FriendGroupMemberRow {
  group_id: string;
  friend_user_id: string;
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
  capture_variant: NoteCaptureVariant | null;
  dual_primary_photo_path: string | null;
  dual_secondary_photo_path: string | null;
  dual_primary_facing: NoteDualFacing | null;
  dual_secondary_facing: NoteDualFacing | null;
  dual_layout_preset: NoteDualLayoutPreset | null;
  is_live_photo: boolean;
  paired_video_path: string | null;
  doodle_strokes_json?: string | null;
  sticker_placements_json?: string | null;
  note_color?: string | null;
  place_name: string | null;
  source_note_id: string | null;
  is_direct_chat?: boolean | null;
  direct_chat_key?: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string | null;
}

interface SharedPostResponseRow {
  id: string;
  post_id: string;
  author_user_id: string;
  author_display_name: string | null;
  author_photo_url_snapshot: string | null;
  emoji: string | null;
  text: string | null;
  sticker_asset_id?: string | null;
  sticker_remote_path?: string | null;
  sticker_mime_type?: string | null;
  sticker_width?: number | null;
  sticker_height?: number | null;
  sticker_render_mode?: StickerRenderMode | null;
  sticker_stamp_style?: StickerStampStyle | null;
  reply_to_response_id?: string | null;
  created_at: string;
}

interface SharedPostResponseReactionRow {
  id: string;
  post_id: string;
  response_id: string;
  author_user_id: string;
  author_display_name: string | null;
  author_photo_url_snapshot: string | null;
  emoji: string;
  created_at: string;
}

interface SharedThreadSummaryRow {
  post_id: string;
  latest_response_id: string | null;
  latest_response_created_at: string | null;
  latest_activity_at: string | null;
  latest_activity_author_user_id: string | null;
  latest_activity_author_display_name: string | null;
  latest_activity_author_photo_url_snapshot: string | null;
  latest_activity_text: string | null;
  latest_activity_emoji: string | null;
  latest_activity_kind: 'response' | 'reaction' | null;
}

interface SharedPostTombstoneRow {
  post_id: string;
  author_user_id: string;
  deleted_at: string;
}

const ACTIVE_FRIEND_INVITE_QUERY_LIMIT = 50;
const FRIEND_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHARED_FEED_REFRESH_DEDUPE_WINDOW_MS = 400;
const EXPIRED_SHARED_FEED_SESSION_ERROR = 'Server session unavailable. Sign in again to use shared moments.';
const MISMATCHED_SHARED_FEED_SESSION_ERROR =
  'Signed-in session does not match this account. Sign out and sign in again.';
const SHARED_POST_SELECT_FIELDS =
  'id, author_user_id, author_display_name, author_photo_url_snapshot, audience_user_ids, type, text, photo_path, capture_variant, dual_primary_photo_path, dual_secondary_photo_path, dual_primary_facing, dual_secondary_facing, dual_layout_preset, is_live_photo, paired_video_path, doodle_strokes_json, sticker_placements_json, note_color, place_name, source_note_id, latitude, longitude, created_at, updated_at';
const SHARED_POST_WITH_CHAT_FIELDS =
  'id, author_user_id, author_display_name, author_photo_url_snapshot, audience_user_ids, type, text, photo_path, capture_variant, dual_primary_photo_path, dual_secondary_photo_path, dual_primary_facing, dual_secondary_facing, dual_layout_preset, is_live_photo, paired_video_path, doodle_strokes_json, sticker_placements_json, note_color, place_name, source_note_id, is_direct_chat, direct_chat_key, latitude, longitude, created_at, updated_at';
const sharedFeedRefreshState = new Map<
  string,
  {
    promise: Promise<SharedFeedSnapshot> | null;
    lastResolvedAt: number;
    lastSnapshot: SharedFeedSnapshot | null;
  }
>();

export function invalidateSharedFeedRefresh(userUid: string | null | undefined) {
  const normalizedUserUid = typeof userUid === 'string' ? userUid.trim() : '';
  if (!normalizedUserUid) {
    return;
  }

  sharedFeedRefreshState.delete(normalizedUserUid);
}

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

function hasStoredDoodlePayload(strokesJson: string | null | undefined) {
  return parseNoteDoodleStrokes(strokesJson).length > 0;
}

async function hydrateShareableNote(note: Note): Promise<Note> {
  const noteId = typeof note.id === 'string' ? note.id.trim() : '';
  if (!noteId) {
    return {
      ...note,
      hasDoodle: hasStoredDoodlePayload(note.doodleStrokesJson),
      hasStickers: hasStoredStickerPayload(note.stickerPlacementsJson),
    };
  }

  const [storedDoodle, storedStickers] = await Promise.all([
    hasStoredDoodlePayload(note.doodleStrokesJson) ? Promise.resolve(null) : getNoteDoodle(noteId).catch(() => null),
    hasStoredStickerPayload(note.stickerPlacementsJson) ? Promise.resolve(null) : getNoteStickers(noteId).catch(() => null),
  ]);

  const doodleStrokesJson = note.doodleStrokesJson ?? storedDoodle?.strokesJson ?? null;
  const stickerPlacementsJson = note.stickerPlacementsJson ?? storedStickers?.placements_json ?? null;

  return {
    ...note,
    hasDoodle: hasStoredDoodlePayload(doodleStrokesJson),
    doodleStrokesJson,
    hasStickers: hasStoredStickerPayload(stickerPlacementsJson),
    stickerPlacementsJson,
  };
}

function getDisplayName(user: AppUser) {
  return getUserSocialName(user);
}

async function cleanupRemoteArtifacts(
  bucket: string,
  artifacts: {
    photoPath?: string | null;
    dualPrimaryPhotoPath?: string | null;
    dualSecondaryPhotoPath?: string | null;
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

  const dualPrimaryPhotoPath = normalizeRemoteArtifactPath(artifacts.dualPrimaryPhotoPath);
  if (dualPrimaryPhotoPath) {
    removals.push(deletePhotoFromStorage(bucket, dualPrimaryPhotoPath));
  }

  const dualSecondaryPhotoPath = normalizeRemoteArtifactPath(artifacts.dualSecondaryPhotoPath);
  if (dualSecondaryPhotoPath) {
    removals.push(deletePhotoFromStorage(bucket, dualSecondaryPhotoPath));
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

function logDeferredArtifactCleanupFailure(context: string, error: unknown) {
  console.warn(`[sharedFeedService] Deferred remote artifact cleanup failed for ${context}:`, error);
}

async function cleanupRemoteArtifactsBestEffort(
  context: string,
  bucket: string,
  artifacts: {
    photoPath?: string | null;
    dualPrimaryPhotoPath?: string | null;
    dualSecondaryPhotoPath?: string | null;
    pairedVideoPath?: string | null;
    stickerPaths?: string[];
  }
) {
  await cleanupRemoteArtifacts(bucket, artifacts).catch((error) => {
    logDeferredArtifactCleanupFailure(context, error);
  });
}

function getReusableSharedPostCleanupArtifacts(artifacts: {
  photoPath?: string | null;
  dualPrimaryPhotoPath?: string | null;
  dualSecondaryPhotoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPaths?: string[];
}) {
  return {
    photoPath: artifacts.photoPath ?? null,
    dualPrimaryPhotoPath: artifacts.dualPrimaryPhotoPath ?? null,
    dualSecondaryPhotoPath: artifacts.dualSecondaryPhotoPath ?? null,
    pairedVideoPath: artifacts.pairedVideoPath ?? null,
    // Shared-post sticker blobs are reusable assets; shared-post cleanup should
    // drop the container refs without deleting the shared underlying asset.
    stickerPaths: [],
  };
}

async function clearLocalActiveInviteState(userUid: string) {
  await replaceCachedActiveInvite(userUid, null).catch(() => undefined);
}

async function persistLocalActiveInvite(userUid: string, invite: FriendInvite) {
  await replaceCachedActiveInvite(userUid, invite).catch(() => undefined);
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

function buildInviteUrl(inviteId: string | null | undefined, token: string) {
  const queryParams: Record<string, string> = {
    invite: token,
  };

  if (typeof inviteId === 'string' && inviteId.trim()) {
    queryParams.inviteId = inviteId.trim();
  }

  const publicInviteUrl = buildPublicSiteUrl('/friends/join/', queryParams);
  if (publicInviteUrl) {
    return publicInviteUrl;
  }

  return Linking.createURL('/friends/join', { queryParams });
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
    username: null,
    displayNameSnapshot: row.display_name_snapshot ?? null,
    nickname: row.friend_nickname?.trim() || null,
    photoURLSnapshot: row.photo_url_snapshot ?? null,
    friendedAt: row.friended_at,
    lastSharedAt: row.last_shared_at ?? null,
    createdByInviteId: row.created_by_invite_id ?? null,
  };
}

function mapFriendSearchResult(row: FriendSearchRow): FriendSearchResult {
  return {
    userId: row.user_id,
    username: row.username?.trim().toLowerCase() || '',
    displayName: row.display_name?.trim() || null,
    photoURL: row.photo_url ?? null,
    isSelf: Boolean(row.is_self),
    alreadyFriends: Boolean(row.already_friends),
  };
}

function mapFriendGroup(row: FriendGroupRow, memberUserIds: string[]): FriendGroup {
  return {
    id: row.id,
    name: row.name.trim(),
    memberUserIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function mapSharedPostResponse(row: SharedPostResponseRow): SharedPostResponse {
  const stickerRemotePath = row.sticker_remote_path?.trim() || null;
  const stickerAssetId = row.sticker_asset_id?.trim() || null;
  const stickerMimeType = row.sticker_mime_type?.trim() || null;
  const stickerWidth = Math.max(1, Number(row.sticker_width ?? 0));
  const stickerHeight = Math.max(1, Number(row.sticker_height ?? 0));
  const sticker: SharedPostResponseSticker | null =
    stickerRemotePath && stickerAssetId && stickerMimeType
      ? {
          assetId: stickerAssetId,
          localUri: null,
          remotePath: stickerRemotePath,
          mimeType: stickerMimeType,
          width: stickerWidth,
          height: stickerHeight,
          renderMode: row.sticker_render_mode === 'stamp' ? 'stamp' : 'default',
          stampStyle:
            row.sticker_render_mode === 'stamp'
              ? row.sticker_stamp_style === 'circle'
                ? 'circle'
                : 'classic'
              : null,
        }
      : null;

  return {
    id: row.id,
    postId: row.post_id,
    authorUid: row.author_user_id,
    authorDisplayName: row.author_display_name ?? null,
    authorPhotoURLSnapshot: row.author_photo_url_snapshot ?? null,
    emoji: row.emoji?.trim() || null,
    text: row.text?.trim() ?? '',
    sticker,
    replyToResponseId: row.reply_to_response_id?.trim() || null,
    reactions: [],
    createdAt: row.created_at,
  };
}

export async function hydrateSharedPostResponseStickers(
  responses: SharedPostResponse[]
): Promise<SharedPostResponse[]> {
  return Promise.all(
    responses.map(async (response) => {
      const sticker = response.sticker;
      if (!sticker?.remotePath) {
        return response;
      }

      const localInfo = sticker.localUri
        ? await FileSystem.getInfoAsync(sticker.localUri).catch(() => null)
        : null;

      if (localInfo?.exists && !localInfo.isDirectory) {
        return response;
      }

      const localUri = await downloadStickerAssetFromStorage(
        SHARED_POST_MEDIA_BUCKET,
        sticker.remotePath,
        sticker.assetId,
        sticker.mimeType,
        { sharedCache: true }
      ).catch(() => null);

      if (!localUri) {
        return response;
      }

      return {
        ...response,
        sticker: {
          ...sticker,
          localUri,
        },
      };
    })
  );
}

function mapSharedPostResponseReaction(
  row: SharedPostResponseReactionRow
): SharedPostResponseReaction {
  return {
    id: row.id,
    postId: row.post_id,
    responseId: row.response_id,
    authorUid: row.author_user_id,
    authorDisplayName: row.author_display_name ?? null,
    authorPhotoURLSnapshot: row.author_photo_url_snapshot ?? null,
    emoji: row.emoji.trim(),
    createdAt: row.created_at,
  };
}

function getRealtimeRecord<T extends { id?: string }>(
  payload: unknown,
  key: 'new' | 'old'
): T | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = (payload as Record<string, unknown>)[key];
  if (!record || typeof record !== 'object') {
    return null;
  }

  return record as T;
}

function mapSharedThreadSummary(row: SharedThreadSummaryRow): SharedThreadSummary {
  return {
    postId: row.post_id,
    latestResponseId: row.latest_response_id ?? null,
    latestResponseCreatedAt: row.latest_response_created_at ?? null,
    latestActivityAt: row.latest_activity_at ?? null,
    latestActivityAuthorUid: row.latest_activity_author_user_id ?? null,
    latestActivityAuthorDisplayName: row.latest_activity_author_display_name ?? null,
    latestActivityAuthorPhotoURLSnapshot: row.latest_activity_author_photo_url_snapshot ?? null,
    latestActivityText: row.latest_activity_text ?? null,
    latestActivityEmoji: row.latest_activity_emoji ?? null,
    latestActivityKind: row.latest_activity_kind ?? null,
    updatedAt: getNowIso(),
  };
}

function getLatestActivityFromResponses(
  postId: string,
  responses: SharedPostResponse[]
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
      text: response.text || (response.sticker ? 'Sticker' : null),
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
    updatedAt: getNowIso(),
  };
}

function normalizeCoordinate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeSharedPostCaptureVariant(
  noteType: NoteType,
  value: NoteCaptureVariant | null | undefined
) {
  if (noteType !== 'photo') {
    return null;
  }

  return value === 'dual' ? 'dual' : value === 'single' ? 'single' : null;
}

function normalizeSharedPostDualFacing(value: NoteDualFacing | null | undefined) {
  return value === 'front' || value === 'back' ? value : null;
}

function normalizeSharedPostDualLayoutPreset(value: NoteDualLayoutPreset | null | undefined) {
  return value === 'top-left' ? value : null;
}

function getSharedPostPhotoUri(note: Pick<Note, 'type' | 'content' | 'photoLocalUri'>) {
  return note.type === 'photo'
    ? normalizeRemoteArtifactPath(note.photoLocalUri ?? note.content)
    : null;
}

function getSharedPostDualPhotoUri(
  note: Pick<Note, 'type' | 'captureVariant' | 'dualPrimaryPhotoLocalUri' | 'dualSecondaryPhotoLocalUri'>,
  slot: 'primary' | 'secondary'
) {
  if (note.type !== 'photo' || note.captureVariant !== 'dual') {
    return null;
  }

  return normalizeRemoteArtifactPath(
    slot === 'primary' ? note.dualPrimaryPhotoLocalUri : note.dualSecondaryPhotoLocalUri
  );
}

function getSharedPostRemoteArtifacts(
  post: Pick<
    SharedPostRow,
    | 'photo_path'
    | 'dual_primary_photo_path'
    | 'dual_secondary_photo_path'
    | 'paired_video_path'
    | 'sticker_placements_json'
  >
): RemoteArtifactSnapshot {
  return {
    photoPath: post.photo_path ?? null,
    dualPrimaryPhotoPath: post.dual_primary_photo_path ?? null,
    dualSecondaryPhotoPath: post.dual_secondary_photo_path ?? null,
    pairedVideoPath: post.paired_video_path ?? null,
    stickerPlacementsJson: post.sticker_placements_json ?? null,
  };
}

async function uploadSharedPostMediaArtifacts(options: {
  userId: string;
  postId: string;
  note: Note;
  existingArtifacts?: RemoteArtifactSnapshot | null;
  allowOverwrite?: boolean;
}) {
  const { userId, postId, note, existingArtifacts = null, allowOverwrite = false } = options;
  const basePath = buildUserMediaBasePath(userId, postId);
  const currentPhotoUri = getSharedPostPhotoUri(note);
  const currentDualPrimaryPhotoUri = getSharedPostDualPhotoUri(note, 'primary');
  const currentDualSecondaryPhotoUri = getSharedPostDualPhotoUri(note, 'secondary');
  const currentPairedVideoUri =
    note.type === 'photo' && note.isLivePhoto
      ? normalizeRemoteArtifactPath(note.pairedVideoLocalUri ?? null)
      : null;

  return {
    photoPath:
      note.type === 'photo'
        ? existingArtifacts?.photoPath && !currentPhotoUri
          ? existingArtifacts.photoPath
          : await uploadPhotoToStorage(
              SHARED_POST_MEDIA_BUCKET,
              basePath,
              currentPhotoUri,
              { allowOverwrite }
            )
        : null,
    dualPrimaryPhotoPath:
      currentDualPrimaryPhotoUri
        ? await uploadPhotoToStorage(
            SHARED_POST_MEDIA_BUCKET,
            buildDualPhotoRemotePath(basePath, 'primary'),
            currentDualPrimaryPhotoUri,
            { allowOverwrite }
          )
        : null,
    dualSecondaryPhotoPath:
      currentDualSecondaryPhotoUri
        ? await uploadPhotoToStorage(
            SHARED_POST_MEDIA_BUCKET,
            buildDualPhotoRemotePath(basePath, 'secondary'),
            currentDualSecondaryPhotoUri,
            { allowOverwrite }
          )
        : null,
    pairedVideoPath:
      note.type === 'photo' && note.isLivePhoto
        ? existingArtifacts?.pairedVideoPath && !currentPairedVideoUri
          ? existingArtifacts.pairedVideoPath
          : await uploadPairedVideoToStorage(
              SHARED_POST_MEDIA_BUCKET,
              getRemotePairedVideoPath(basePath, currentPairedVideoUri),
              currentPairedVideoUri,
              { allowOverwrite }
            )
        : null,
  };
}

function shouldIncludeSharedPostInFeed(post: SharedPost, viewerUid: string) {
  if (isDirectChatAnchor(post)) {
    return false;
  }

  return isSharedPostVisibleToUser(post, viewerUid);
}

function isSharedPostVisibleToUser(post: SharedPost, viewerUid: string) {
  if (post.authorUid === viewerUid) {
    return post.audienceUserIds.some((audienceUid) => audienceUid !== viewerUid);
  }

  return post.audienceUserIds.includes(viewerUid);
}

function resolveAudienceFromFriends(
  authorUid: string,
  friends: FriendConnection[],
  requestedAudienceUserIds?: string[] | null
) {
  const friendUidSet = new Set(friends.map((friend) => friend.userId.trim()).filter(Boolean));
  const requestedRecipientUids =
    requestedAudienceUserIds && requestedAudienceUserIds.length > 0
      ? requestedAudienceUserIds
          .map((userId) => userId.trim())
          .filter((userId) => userId && friendUidSet.has(userId))
      : Array.from(friendUidSet);

  return Array.from(new Set([authorUid, ...requestedRecipientUids]));
}

function getDirectChatKey(userUid: string, friendUid: string) {
  return [userUid.trim(), friendUid.trim()].sort().join(':');
}

function isDirectChatAnchor(post: SharedPost) {
  return Boolean(
    post.isDirectChat ||
      post.directChatKey?.trim() ||
      post.id.startsWith('direct-chat-')
  );
}


function safelyDecodeInviteText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeInviteCandidate(value: string) {
  let normalized = value.trim();

  while (normalized && `"'([{<`.includes(normalized.charAt(0))) {
    normalized = normalized.slice(1).trimStart();
  }

  while (normalized && `"'.,!?;:)]}>`.includes(normalized.charAt(normalized.length - 1))) {
    normalized = normalized.slice(0, -1).trimEnd();
  }

  return normalized;
}

function readInviteQueryParams(candidate: string) {
  const parsed = typeof Linking.parse === 'function'
    ? Linking.parse(candidate)
    : { queryParams: undefined };
  const maybeInviteId =
    typeof parsed.queryParams?.inviteId === 'string' ? parsed.queryParams.inviteId.trim() : '';
  const maybeToken =
    typeof parsed.queryParams?.invite === 'string' ? parsed.queryParams.invite.trim() : '';

  if (maybeInviteId || maybeToken) {
    return {
      inviteId: maybeInviteId,
      token: maybeToken,
    };
  }

  const inviteIdMatch = candidate.match(/(?:^|[?&#])inviteId=([^&#\s]+)/i);
  const tokenMatch = candidate.match(/(?:^|[?&#])invite=([^&#\s]+)/i);

  return {
    inviteId: inviteIdMatch ? safelyDecodeInviteText(inviteIdMatch[1] ?? '').trim() : '',
    token: tokenMatch ? safelyDecodeInviteText(tokenMatch[1] ?? '').trim() : '',
  };
}

function extractInviteCandidates(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  const rawVariants = [trimmed];
  const decodedTrimmed = safelyDecodeInviteText(trimmed);

  if (decodedTrimmed !== trimmed) {
    rawVariants.push(decodedTrimmed);
  }

  const pushCandidate = (value: string) => {
    const normalized = sanitizeInviteCandidate(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  };

  for (const variant of rawVariants) {
    pushCandidate(variant);

    for (const match of variant.matchAll(/\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>"'`]+/gi)) {
      pushCandidate(match[0] ?? '');
    }

    const queryMatch = variant.match(/(?:inviteId=[^&#\s]+(?:&invite=[^&#\s]+)?|invite=[^&#\s]+)/i);
    if (queryMatch?.[0]) {
      pushCandidate(queryMatch[0]);
    }
  }

  return candidates;
}

function extractInviteTokenFromText(rawValue: string) {
  const labeledTokenMatch = rawValue.match(
    /(?:invite code|invite token|invite|ma moi|mã mời)\s*[:#-]?\s*([a-z0-9-]{6,})/i
  );

  if (labeledTokenMatch?.[1]) {
    return labeledTokenMatch[1].trim();
  }

  const tokenMatch = rawValue.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  );

  return tokenMatch?.[0]?.trim() ?? '';
}

function parseInvitePayload(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { inviteId: '', token: '' };
  }

  for (const candidate of extractInviteCandidates(trimmed)) {
    const payload = readInviteQueryParams(candidate);
    if (payload.inviteId || payload.token) {
      return payload;
    }
  }

  const tokenFromText = extractInviteTokenFromText(trimmed);
  if (tokenFromText) {
    return {
      inviteId: '',
      token: tokenFromText,
    };
  }

  return {
    inviteId: '',
    token: /\s/.test(trimmed) ? '' : trimmed,
  };
}

export function normalizeFriendInviteInput(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  const { inviteId, token } = parseInvitePayload(trimmed);
  if (token) {
    return buildInviteUrl(inviteId || undefined, token);
  }

  return trimmed;
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

function getSharedPostChangeFields(
  payload: unknown,
  field: 'author_user_id' | 'audience_user_ids'
) {
  if (typeof payload !== 'object' || !payload) {
    return [];
  }

  const eventPayload = payload as {
    new?: Record<string, unknown> | null;
    old?: Record<string, unknown> | null;
  };
  const values: unknown[] = [];

  if (eventPayload.new && field in eventPayload.new) {
    values.push(eventPayload.new[field] ?? null);
  }

  if (eventPayload.old && field in eventPayload.old) {
    values.push(eventPayload.old[field] ?? null);
  }

  if (values.length === 0) {
    const fallbackValue = getSharedPostChangeField(payload, field);
    if (fallbackValue !== null) {
      values.push(fallbackValue);
    }
  }

  return values;
}

function shouldRefreshForSharedPostChange(payload: unknown, userId: string) {
  const authorUserIds = getSharedPostChangeFields(payload, 'author_user_id');
  if (authorUserIds.some((value) => typeof value === 'string' && value.trim() === userId)) {
    return true;
  }

  const audienceUserIdsValues = getSharedPostChangeFields(payload, 'audience_user_ids');
  for (const audienceUserIds of audienceUserIdsValues) {
    if (
      Array.isArray(audienceUserIds) &&
      audienceUserIds.some((value) => typeof value === 'string' && value.trim() === userId)
    ) {
      return true;
    }
  }

  return false;
}

function mapSharedPost(record: SharedPostRow): SharedPost {
  const captureVariant = normalizeSharedPostCaptureVariant(record.type, record.capture_variant);

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
    captureVariant,
    dualPrimaryPhotoPath:
      captureVariant === 'dual' ? record.dual_primary_photo_path ?? null : null,
    dualSecondaryPhotoPath:
      captureVariant === 'dual' ? record.dual_secondary_photo_path ?? null : null,
    dualPrimaryPhotoLocalUri: null,
    dualSecondaryPhotoLocalUri: null,
    dualPrimaryFacing:
      captureVariant === 'dual'
        ? normalizeSharedPostDualFacing(record.dual_primary_facing)
        : null,
    dualSecondaryFacing:
      captureVariant === 'dual'
        ? normalizeSharedPostDualFacing(record.dual_secondary_facing)
        : null,
    dualLayoutPreset:
      captureVariant === 'dual'
        ? normalizeSharedPostDualLayoutPreset(record.dual_layout_preset)
        : null,
    isLivePhoto: Boolean(record.is_live_photo && record.paired_video_path),
    pairedVideoPath: record.paired_video_path ?? null,
    pairedVideoLocalUri: null,
    doodleStrokesJson: record.doodle_strokes_json ?? null,
    hasStickers: hasStoredStickerPayload(record.sticker_placements_json),
    stickerPlacementsJson: record.sticker_placements_json ?? null,
    noteColor:
      record.type === 'text'
        ? resolveSavedTextNoteColor(record.note_color ?? null)
        : null,
    placeName: record.place_name ?? null,
    sourceNoteId: record.source_note_id ?? null,
    isDirectChat: Boolean(record.is_direct_chat),
    directChatKey: record.direct_chat_key ?? null,
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
      'user_id, friend_user_id, display_name_snapshot, friend_nickname, photo_url_snapshot, friended_at, last_shared_at, created_by_invite_id'
    )
    .eq('user_id', userUid)
    .order('friended_at', { ascending: true });

  if (error) {
    throw error;
  }

  const friendships = ((data ?? []) as FriendshipRow[]).map(mapFriend);
  if (friendships.length === 0) {
    return friendships;
  }

  return Promise.all(
    friendships.map(async (friendship) => {
      try {
        const profile = await getUserProfileSnapshot(friendship.userId);
        return {
          ...friendship,
          username: profile.username ?? null,
          displayNameSnapshot: profile.displayNameSnapshot ?? friendship.displayNameSnapshot,
          photoURLSnapshot: profile.photoURLSnapshot ?? friendship.photoURLSnapshot,
        };
      } catch {
        return friendship;
      }
    })
  );
}

async function getFriendGroupsForUser(userUid: string): Promise<FriendGroup[]> {
  const supabase = requireSupabase();
  const [groupsResponse, membersResponse] = await Promise.all([
    supabase
      .from('friend_groups')
      .select('id, owner_user_id, name, created_at, updated_at')
      .eq('owner_user_id', userUid)
      .order('created_at', { ascending: true }),
    supabase
      .from('friend_group_members')
      .select('group_id, friend_user_id')
      .eq('owner_user_id', userUid),
  ]);

  if (groupsResponse.error) {
    throw groupsResponse.error;
  }

  if (membersResponse.error) {
    throw membersResponse.error;
  }

  const memberIdsByGroupId = new Map<string, string[]>();
  for (const row of (membersResponse.data ?? []) as FriendGroupMemberRow[]) {
    const groupId = row.group_id?.trim();
    const friendUserId = row.friend_user_id?.trim();
    if (!groupId || !friendUserId) {
      continue;
    }

    memberIdsByGroupId.set(groupId, [
      ...(memberIdsByGroupId.get(groupId) ?? []),
      friendUserId,
    ]);
  }

  return ((groupsResponse.data ?? []) as FriendGroupRow[]).map((row) =>
    mapFriendGroup(row, Array.from(new Set(memberIdsByGroupId.get(row.id) ?? [])))
  );
}

async function getOwnedSharedSourceNoteIds(userUid: string, friends?: FriendConnection[]) {
  const { data, error } = await requireSupabase()
    .from('shared_posts')
    .select('author_user_id, audience_user_ids, source_note_id')
    .eq('author_user_id', userUid);

  if (error) {
    throw error;
  }

  const currentFriends = friends ?? await getFriendsForUser(userUid);
  return getOwnedSharedNoteIdsFromPosts(
    ((data ?? []) as {
      author_user_id?: string | null;
      audience_user_ids?: string[] | null;
      source_note_id?: string | null;
    }[]).map((row) => ({
      authorUid: row.author_user_id ?? userUid,
      audienceUserIds: Array.isArray(row.audience_user_ids) ? row.audience_user_ids : [],
      sourceNoteId: row.source_note_id ?? null,
    })),
    userUid,
    { friendUserIds: currentFriends.map((friend) => friend.userId) }
  );
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

  if (isSupabaseSchemaMismatchError(error)) {
    return 'Shared moments need the latest server update right now. Apply the latest Supabase migrations, then try again.';
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
    await clearLocalActiveInviteState(user.id);
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

  const [activeInvite, friendGroups, ownedSharedNoteIds, postsResponse] = await Promise.all([
    getActiveFriendInvite(user),
    getFriendGroupsForUser(user.id),
    getOwnedSharedSourceNoteIds(user.id, friends),
    requireSupabase()
      .from('shared_posts')
      .select(SHARED_POST_SELECT_FIELDS)
      .contains('audience_user_ids', [user.id])
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (postsResponse.error) {
    throw postsResponse.error;
  }

  const sharedPosts = ((postsResponse.data ?? []) as SharedPostRow[])
    .map(mapSharedPost)
    .filter((post) => shouldIncludeSharedPostInFeed(post, user.id));

  const snapshot = {
    friends,
    friendGroups,
    sharedPosts,
    activeInvite,
    ownedSharedNoteIds,
  };
  await cacheSharedFeedSnapshot(user.id, snapshot);
  return snapshot;
}

export async function refreshSharedFeed(
  user: AppUser,
  options: { force?: boolean } = {}
): Promise<SharedFeedSnapshot> {
  const existingState = sharedFeedRefreshState.get(user.id);
  if (existingState?.promise) {
    return existingState.promise;
  }

  if (
    !options.force &&
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
  let refreshQueuedForce = false;

  const refresh = (options?: { force?: boolean }) => {
    if (disposed) {
      return;
    }

    if (refreshInFlight) {
      refreshQueued = true;
      refreshQueuedForce = refreshQueuedForce || Boolean(options?.force);
      return;
    }

    refreshInFlight = refreshSharedFeed(user, options)
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
          const nextOptions = refreshQueuedForce ? { force: true } : undefined;
          refreshQueued = false;
          refreshQueuedForce = false;
          scheduleRefresh(nextOptions);
        }
      });
  };

  const scheduleRefresh = (options?: { force?: boolean }) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refresh(options);
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
      () => scheduleRefresh({ force: true })
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_invites',
        filter: `inviter_user_id=eq.${user.id}`,
      },
      () => scheduleRefresh({ force: true })
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_groups',
        filter: `owner_user_id=eq.${user.id}`,
      },
      () => scheduleRefresh({ force: true })
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_group_members',
        filter: `owner_user_id=eq.${user.id}`,
      },
      () => scheduleRefresh({ force: true })
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
          scheduleRefresh({ force: true });
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
  invalidateSharedFeedRefresh(user.id);

  const supabase = requireSupabase();

  await upsertPublicUserProfile({
    userUid: user.id,
    displayName: getDisplayName(user),
    username: user.username,
    email: user.email,
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

  const localInvite = mapInvite(nextInvite, inviteToken);
  await persistLocalActiveInvite(user.id, localInvite);
  return localInvite;
}

export async function findFriendByUsername(
  user: AppUser,
  username: string
): Promise<FriendSearchResult> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedUsername = normalizeUsernameInput(username);
  if (!normalizedUsername) {
    throw new Error('Username required.');
  }

  const { data, error } = await requireSupabase().rpc('find_user_by_username', {
    search_username: normalizedUsername,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('User not found.');
  }

  return mapFriendSearchResult(row as FriendSearchRow);
}

export async function revokeFriendInvite(user: AppUser, inviteId: string): Promise<void> {
  invalidateSharedFeedRefresh(user.id);
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

  await clearLocalActiveInviteState(user.id);
}

export async function acceptFriendInvite(
  user: AppUser,
  inviteValue: string
): Promise<FriendConnection> {
  invalidateSharedFeedRefresh(user.id);
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
    username: user.username,
    email: user.email,
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
  let resolvedConnection = connection;

  try {
    const inviterProfile = await getUserProfileSnapshot(connection.userId);
    resolvedConnection = {
      ...connection,
      username: inviterProfile.username ?? connection.username,
      displayNameSnapshot: inviterProfile.displayNameSnapshot ?? connection.displayNameSnapshot,
      photoURLSnapshot: inviterProfile.photoURLSnapshot ?? connection.photoURLSnapshot,
    };
  } catch (error) {
    console.warn('[shared-feed] Failed to hydrate inviter profile after invite acceptance:', error);
  }

  void sendSocialNotificationEvent({
    type: 'friend_accepted',
    friendUserId: resolvedConnection.userId,
  }).catch((error) => {
    console.warn('[shared-feed] Failed to send invite acceptance notification:', error);
  });

  return resolvedConnection;
}

export async function removeFriend(user: AppUser, friendUid: string): Promise<void> {
  invalidateSharedFeedRefresh(user.id);
  const { error } = await requireSupabase().rpc('remove_friend', {
    friend_user_id: friendUid,
  });

  if (error) {
    throw error;
  }
}

export async function updateFriendNickname(
  user: AppUser,
  friendUid: string,
  nickname: string | null
): Promise<FriendConnection> {
  await ensureSupabaseSessionMatchesUser(user.id);
  invalidateSharedFeedRefresh(user.id);

  const normalizedFriendUid = friendUid.trim();
  if (!normalizedFriendUid) {
    throw new Error('Friend required.');
  }

  const normalizedNickname = nickname?.trim() || null;
  const { data, error } = await requireSupabase().rpc('update_friend_nickname', {
    target_friend_user_id: normalizedFriendUid,
    nickname: normalizedNickname,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('Friend not found.');
  }

  const connection = mapFriend(row as FriendshipRow);
  const profile = await getUserProfileSnapshot(connection.userId);

  return {
    ...connection,
    username: profile.username ?? connection.username,
    displayNameSnapshot: profile.displayNameSnapshot ?? connection.displayNameSnapshot,
    photoURLSnapshot: profile.photoURLSnapshot ?? connection.photoURLSnapshot,
  };
}

function normalizeFriendGroupName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

async function assertFriendGroupMembers(userUid: string, memberUserIds: string[]) {
  const normalizedMemberUserIds = normalizeOwnedSharedNoteIds(memberUserIds).filter(
    (memberUserId) => memberUserId !== userUid
  );
  if (normalizedMemberUserIds.length === 0) {
    throw new Error('Choose at least one friend.');
  }

  const friendUserIdSet = new Set((await getFriendsForUser(userUid)).map((friend) => friend.userId));
  const invalidMember = normalizedMemberUserIds.find((memberUserId) => !friendUserIdSet.has(memberUserId));
  if (invalidMember) {
    throw new Error('Groups can only include connected friends.');
  }

  return normalizedMemberUserIds;
}

async function replaceFriendGroupMembers(
  userUid: string,
  groupId: string,
  memberUserIds: string[]
) {
  const supabase = requireSupabase();
  const deleteResponse = await supabase
    .from('friend_group_members')
    .delete()
    .eq('owner_user_id', userUid)
    .eq('group_id', groupId);

  if (deleteResponse.error) {
    throw deleteResponse.error;
  }

  const rows = memberUserIds.map((friendUserId) => ({
    owner_user_id: userUid,
    group_id: groupId,
    friend_user_id: friendUserId,
  }));
  const insertResponse = await supabase.from('friend_group_members').insert(rows);

  if (insertResponse.error) {
    throw insertResponse.error;
  }
}

export async function createFriendGroup(
  user: AppUser,
  input: { name: string; memberUserIds: string[] }
): Promise<FriendGroup> {
  await ensureSupabaseSessionMatchesUser(user.id);
  invalidateSharedFeedRefresh(user.id);

  const name = normalizeFriendGroupName(input.name);
  if (!name) {
    throw new Error('Group name required.');
  }

  if (name.length > 40) {
    throw new Error('Group name must be 40 characters or fewer.');
  }

  const memberUserIds = await assertFriendGroupMembers(user.id, input.memberUserIds);
  const now = getNowIso();
  const row: FriendGroupRow = {
    id: `friend-group-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`,
    owner_user_id: user.id,
    name,
    created_at: now,
    updated_at: null,
  };
  const { error } = await requireSupabase().from('friend_groups').insert(row);
  if (error) {
    throw error;
  }

  await replaceFriendGroupMembers(user.id, row.id, memberUserIds);
  return mapFriendGroup(row, memberUserIds);
}

export async function updateFriendGroup(
  user: AppUser,
  groupId: string,
  input: { name: string; memberUserIds: string[] }
): Promise<FriendGroup> {
  await ensureSupabaseSessionMatchesUser(user.id);
  invalidateSharedFeedRefresh(user.id);

  const normalizedGroupId = groupId.trim();
  const name = normalizeFriendGroupName(input.name);
  if (!normalizedGroupId) {
    throw new Error('Group required.');
  }

  if (!name) {
    throw new Error('Group name required.');
  }

  if (name.length > 40) {
    throw new Error('Group name must be 40 characters or fewer.');
  }

  const memberUserIds = await assertFriendGroupMembers(user.id, input.memberUserIds);
  const updatedAt = getNowIso();
  const { data, error } = await requireSupabase()
    .from('friend_groups')
    .update({ name, updated_at: updatedAt })
    .eq('id', normalizedGroupId)
    .eq('owner_user_id', user.id)
    .select('id, owner_user_id, name, created_at, updated_at')
    .single<FriendGroupRow>();

  if (error) {
    throw error;
  }

  await replaceFriendGroupMembers(user.id, normalizedGroupId, memberUserIds);
  return mapFriendGroup(data, memberUserIds);
}

export async function deleteFriendGroup(user: AppUser, groupId: string): Promise<void> {
  await ensureSupabaseSessionMatchesUser(user.id);
  invalidateSharedFeedRefresh(user.id);

  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    return;
  }

  const { error } = await requireSupabase()
    .from('friend_groups')
    .delete()
    .eq('id', normalizedGroupId)
    .eq('owner_user_id', user.id);

  if (error) {
    throw error;
  }
}

export async function addFriendByUsername(
  user: AppUser,
  username: string
): Promise<FriendConnection> {
  await ensureSupabaseSessionMatchesUser(user.id);
  invalidateSharedFeedRefresh(user.id);

  const normalizedUsername = normalizeUsernameInput(username);
  if (!normalizedUsername) {
    throw new Error('Username required.');
  }

  await upsertPublicUserProfile({
    userUid: user.id,
    displayName: getDisplayName(user),
    username: user.username,
    email: user.email,
    photoURL: user.photoURL ?? null,
  });

  const { data, error } = await requireSupabase().rpc('add_friend_by_username', {
    search_username: normalizedUsername,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('User not found.');
  }

  const connection = mapFriend(row as FriendshipRow);
  const profile = await getUserProfileSnapshot(connection.userId);

  return {
    ...connection,
    username: profile.username ?? connection.username,
    displayNameSnapshot: profile.displayNameSnapshot ?? connection.displayNameSnapshot,
    photoURLSnapshot: profile.photoURLSnapshot ?? connection.photoURLSnapshot,
  };
}

export async function createSharedPost(
  user: AppUser,
  note: Note,
  audienceUserIds?: string[] | null
): Promise<SharedPost> {
  await ensureSupabaseSessionMatchesUser(user.id);
  invalidateSharedFeedRefresh(user.id);

  const supabase = requireSupabase();
  const shareableNote = await hydrateShareableNote(note);
  const friends = await getFriendsForUser(user.id);
  const dedupedAudience = resolveAudienceFromFriends(user.id, friends, audienceUserIds);

  if (dedupedAudience.length <= 1) {
    throw new Error('Connect a friend before sharing moments.');
  }

  const postId = `shared-post-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
  const now = getNowIso();
  let photoPath: string | null = null;
  let dualPrimaryPhotoPath: string | null = null;
  let dualSecondaryPhotoPath: string | null = null;
  let pairedVideoPath: string | null = null;
  let stickerPlacementsJson: string | null = null;

  try {
    ({
      photoPath,
      dualPrimaryPhotoPath,
      dualSecondaryPhotoPath,
      pairedVideoPath,
    } = await uploadSharedPostMediaArtifacts({
      userId: user.id,
      postId,
      note: shareableNote,
    }));
    const stickerPlacements = parseNoteStickerPlacements(shareableNote.stickerPlacementsJson);
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
      type: shareableNote.type,
      text:
        shareableNote.type === 'text'
          ? formatNoteTextWithEmoji(shareableNote.content.trim(), shareableNote.moodEmoji)
          : shareableNote.caption?.trim() ?? '',
      photo_path: photoPath ?? null,
      capture_variant: normalizeSharedPostCaptureVariant(
        shareableNote.type,
        shareableNote.captureVariant ?? null
      ),
      dual_primary_photo_path: dualPrimaryPhotoPath ?? null,
      dual_secondary_photo_path: dualSecondaryPhotoPath ?? null,
      dual_primary_facing: normalizeSharedPostDualFacing(shareableNote.dualPrimaryFacing),
      dual_secondary_facing: normalizeSharedPostDualFacing(shareableNote.dualSecondaryFacing),
      dual_layout_preset: normalizeSharedPostDualLayoutPreset(shareableNote.dualLayoutPreset),
      is_live_photo: Boolean(shareableNote.isLivePhoto && pairedVideoPath),
      paired_video_path: pairedVideoPath ?? null,
      doodle_strokes_json: shareableNote.doodleStrokesJson ?? null,
      sticker_placements_json: stickerPlacementsJson,
      note_color: shareableNote.type === 'text' ? resolveSavedTextNoteColor(shareableNote.noteColor) : null,
      place_name: shareableNote.locationName ?? null,
      source_note_id: shareableNote.id,
      latitude: shareableNote.latitude,
      longitude: shareableNote.longitude,
      is_direct_chat: false,
      direct_chat_key: null,
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
      photoLocalUri: getSharedPostPhotoUri(shareableNote),
      dualPrimaryPhotoLocalUri: getSharedPostDualPhotoUri(shareableNote, 'primary'),
      dualSecondaryPhotoLocalUri: getSharedPostDualPhotoUri(shareableNote, 'secondary'),
      pairedVideoLocalUri: shareableNote.type === 'photo' ? shareableNote.pairedVideoLocalUri ?? null : null,
      hasStickers: hasStoredStickerPayload(stickerPlacementsJson),
      stickerPlacementsJson,
      noteColor: shareableNote.type === 'text' ? resolveSavedTextNoteColor(shareableNote.noteColor) : null,
    };
  } catch (error) {
    await cleanupRemoteArtifacts(SHARED_POST_MEDIA_BUCKET, {
      ...getReusableSharedPostCleanupArtifacts({
        photoPath,
        dualPrimaryPhotoPath,
        dualSecondaryPhotoPath,
        pairedVideoPath,
        stickerPaths: getRemoteStickerAssetPaths(stickerPlacementsJson),
      }),
    });
    throw error;
  }
}

export async function getSharedPostResponses(
  user: AppUser,
  postId: string
): Promise<SharedPostResponse[]> {
  return getSharedPostResponsesPage(user, postId);
}

export async function getSharedChatThreadPost(
  user: AppUser,
  postId: string
): Promise<SharedPost | null> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return null;
  }

  const { data, error } = await requireSupabase()
    .from('shared_posts')
    .select(SHARED_POST_WITH_CHAT_FIELDS)
    .eq('id', normalizedPostId)
    .maybeSingle();

  if (error) {
    if (!isSupabaseSchemaMismatchError(error)) {
      throw error;
    }

    const fallback = await requireSupabase()
      .from('shared_posts')
      .select(SHARED_POST_SELECT_FIELDS)
      .eq('id', normalizedPostId)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    const post = fallback.data ? mapSharedPost(fallback.data as SharedPostRow) : null;
    return post && isSharedPostVisibleToUser(post, user.id) ? post : null;
  }

  const post = data ? mapSharedPost(data as SharedPostRow) : null;
  return post && isSharedPostVisibleToUser(post, user.id) ? post : null;
}

export async function getDirectChatThreadPost(
  user: AppUser,
  friendUid: string
): Promise<SharedPost | null> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedFriendUid = friendUid.trim();
  if (!normalizedFriendUid || normalizedFriendUid === user.id) {
    return null;
  }

  const directChatKey = getDirectChatKey(user.id, normalizedFriendUid);
  const { data, error } = await requireSupabase()
    .from('shared_posts')
    .select(SHARED_POST_WITH_CHAT_FIELDS)
    .eq('direct_chat_key', directChatKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const post = data ? mapSharedPost(data as SharedPostRow) : null;
  return post && isSharedPostVisibleToUser(post, user.id) ? post : null;
}

export async function getOrCreateDirectChatPost(
  user: AppUser,
  friendUid: string
): Promise<SharedPost> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedFriendUid = friendUid.trim();
  if (!normalizedFriendUid || normalizedFriendUid === user.id) {
    throw new Error('Choose a friend to message.');
  }

  const friends = await getFriendsForUser(user.id);
  if (!friends.some((friend) => friend.userId === normalizedFriendUid)) {
    throw new Error('You can only message connected friends.');
  }

  const supabase = requireSupabase();
  const directChatKey = getDirectChatKey(user.id, normalizedFriendUid);
  const existing = await supabase
    .from('shared_posts')
    .select(SHARED_POST_WITH_CHAT_FIELDS)
    .eq('direct_chat_key', directChatKey)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return mapSharedPost(existing.data as SharedPostRow);
  }

  const now = getNowIso();
  const record: SharedPostRow = {
    id: `direct-chat-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`,
    author_user_id: user.id,
    author_display_name: getDisplayName(user),
    author_photo_url_snapshot: user.photoURL ?? null,
    audience_user_ids: [user.id, normalizedFriendUid],
    type: 'text',
    text: '',
    photo_path: null,
    capture_variant: null,
    dual_primary_photo_path: null,
    dual_secondary_photo_path: null,
    dual_primary_facing: null,
    dual_secondary_facing: null,
    dual_layout_preset: null,
    is_live_photo: false,
    paired_video_path: null,
    doodle_strokes_json: null,
    sticker_placements_json: null,
    note_color: null,
    place_name: null,
    source_note_id: null,
    is_direct_chat: true,
    direct_chat_key: directChatKey,
    latitude: null,
    longitude: null,
    created_at: now,
    updated_at: null,
  };

  const { error } = await supabase.from('shared_posts').insert(record);
  if (!error) {
    return mapSharedPost(record);
  }

  const retry = await supabase
    .from('shared_posts')
    .select(SHARED_POST_WITH_CHAT_FIELDS)
    .eq('direct_chat_key', directChatKey)
    .maybeSingle();

  if (retry.data) {
    return mapSharedPost(retry.data as SharedPostRow);
  }

  throw error;
}

export async function getSharedChatThreadPosts(
  user: AppUser,
  limit = 50
): Promise<SharedPost[]> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const resolvedLimit = Math.max(1, Math.min(limit, 80));
  const candidateLimit = Math.min(resolvedLimit * 4, 200);
  const { data: responseRows, error: responseError } = await requireSupabase()
    .from('shared_post_responses')
    .select('post_id, created_at')
    .order('created_at', { ascending: false })
    .limit(candidateLimit);

  if (responseError) {
    throw responseError;
  }

  const orderedPostIds: string[] = [];
  const seenPostIds = new Set<string>();
  for (const row of (responseRows ?? []) as Array<{ post_id?: string | null }>) {
    const postId = row.post_id?.trim();
    if (!postId || seenPostIds.has(postId)) {
      continue;
    }

    seenPostIds.add(postId);
    orderedPostIds.push(postId);
    if (orderedPostIds.length >= candidateLimit) {
      break;
    }
  }

  if (orderedPostIds.length === 0) {
    return [];
  }

  const { data: postRows, error: postError } = await requireSupabase()
    .from('shared_posts')
    .select(SHARED_POST_WITH_CHAT_FIELDS)
    .in('id', orderedPostIds);

  let resolvedPostRows: unknown[] | null = postRows ?? null;
  if (postError && isSupabaseSchemaMismatchError(postError)) {
    const fallback = await requireSupabase()
      .from('shared_posts')
      .select(SHARED_POST_SELECT_FIELDS)
      .in('id', orderedPostIds);
    if (fallback.error) {
      throw fallback.error;
    }
    resolvedPostRows = fallback.data;
  } else if (postError) {
    throw postError;
  }

  const postById = new Map(
    ((resolvedPostRows ?? []) as SharedPostRow[])
      .map(mapSharedPost)
      .filter((post) => isDirectChatAnchor(post) && isSharedPostVisibleToUser(post, user.id))
      .map((post) => [post.id, post] as const)
  );

  return orderedPostIds
    .flatMap((postId) => {
      const post = postById.get(postId);
      return post ? [post] : [];
    })
    .slice(0, resolvedLimit);
}

export async function getSharedPostResponsesPage(
  user: AppUser,
  postId: string,
  options: { limit?: number; beforeCreatedAt?: string | null } = {}
): Promise<SharedPostResponse[]> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return [];
  }

  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const beforeCreatedAt = options.beforeCreatedAt?.trim() || null;
  const query = requireSupabase()
    .from('shared_post_responses')
    .select('id, post_id, author_user_id, author_display_name, author_photo_url_snapshot, emoji, text, sticker_asset_id, sticker_remote_path, sticker_mime_type, sticker_width, sticker_height, sticker_render_mode, sticker_stamp_style, reply_to_response_id, created_at')
    .eq('post_id', normalizedPostId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) {
    query.lt('created_at', beforeCreatedAt);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const responses = await hydrateSharedPostResponseStickers(((data ?? []) as SharedPostResponseRow[])
    .map(mapSharedPostResponse)
    .reverse());
  const responseIds = responses.map((response) => response.id);
  if (responseIds.length === 0) {
    return responses;
  }

  const { data: reactionData, error: reactionError } = await requireSupabase()
    .from('shared_post_response_reactions')
    .select('id, post_id, response_id, author_user_id, author_display_name, author_photo_url_snapshot, emoji, created_at')
    .in('response_id', responseIds)
    .order('created_at', { ascending: true });

  if (reactionError) {
    if (isSupabaseSchemaMismatchError(reactionError)) {
      return responses;
    }

    throw reactionError;
  }

  const reactionsByResponseId = new Map<string, SharedPostResponseReaction[]>();
  for (const reaction of ((reactionData ?? []) as SharedPostResponseReactionRow[]).map(
    mapSharedPostResponseReaction
  )) {
    const current = reactionsByResponseId.get(reaction.responseId) ?? [];
    current.push(reaction);
    reactionsByResponseId.set(reaction.responseId, current);
  }

  return responses.map((response) => ({
    ...response,
    reactions: reactionsByResponseId.get(response.id) ?? [],
  }));
}

export async function getSharedPostThreadSummaries(
  user: AppUser,
  postIds: string[]
): Promise<SharedThreadSummary[]> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostIds = Array.from(
    new Set(postIds.map((postId) => postId.trim()).filter(Boolean))
  );
  if (normalizedPostIds.length === 0) {
    return [];
  }

  const { data, error } = await requireSupabase().rpc('get_shared_post_thread_summaries', {
    target_post_ids: normalizedPostIds,
  });

  if (!error) {
    return ((data ?? []) as SharedThreadSummaryRow[]).map(mapSharedThreadSummary);
  }

  if (!isSupabaseSchemaMismatchError(error)) {
    throw error;
  }

  const summaries = await Promise.all(
    normalizedPostIds.map(async (postId) =>
      getLatestActivityFromResponses(postId, await getSharedPostResponses(user, postId))
    )
  );
  return summaries;
}

function getOnlinePresenceKeys(state: Record<string, unknown>) {
  const onlineKeys = new Set<string>();
  for (const [key, presences] of Object.entries(state)) {
    if (Array.isArray(presences) && presences.length > 0) {
      onlineKeys.add(key);
    }
  }

  return onlineKeys;
}

type SharedPostTypingPresenceMeta = {
  user_id?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  is_typing?: boolean | null;
  typing_at?: string | null;
};

const SHARED_POST_TYPING_STALE_HIDE_MS = 3500;

export function getTypingUsersFromPresenceState(
  state: Record<string, unknown>,
  ownUserId: string
): SharedPostTypingUser[] {
  const now = Date.now();
  const typingUsers: SharedPostTypingUser[] = [];

  for (const [presenceKey, presences] of Object.entries(state)) {
    if (presenceKey === ownUserId || !Array.isArray(presences)) {
      continue;
    }

    const latestTypingPresence = presences
      .map((presence) => presence as SharedPostTypingPresenceMeta)
      .filter((presence) => presence.is_typing && presence.typing_at)
      .sort(
        (left, right) =>
          new Date(right.typing_at ?? '').getTime() - new Date(left.typing_at ?? '').getTime()
      )[0];

    if (!latestTypingPresence?.typing_at) {
      continue;
    }

    const typingTime = new Date(latestTypingPresence.typing_at).getTime();
    if (!Number.isFinite(typingTime) || now - typingTime > SHARED_POST_TYPING_STALE_HIDE_MS) {
      continue;
    }

    typingUsers.push({
      userId: latestTypingPresence.user_id?.trim() || presenceKey,
      displayName: latestTypingPresence.display_name?.trim() || null,
      photoURL: latestTypingPresence.photo_url?.trim() || null,
      updatedAt: latestTypingPresence.typing_at,
    });
  }

  return typingUsers.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

async function getFriendLastSeenMap(friendUserIds: string[]) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, last_seen_at')
    .in('id', friendUserIds);

  if (error) {
    if (isSupabaseSchemaMismatchError(error)) {
      return new Map<string, string>();
    }

    throw error;
  }

  const rows = (data ?? []) as { id?: string | null; last_seen_at?: string | null }[];
  return new Map(
    rows.flatMap((row) =>
      row.id && row.last_seen_at ? [[row.id, row.last_seen_at] as const] : []
    )
  );
}

export async function updateOwnPresenceLastSeen(user: AppUser) {
  const now = getNowIso();
  const { error } = await requireSupabase()
    .from('profiles')
    .update({
      last_seen_at: now,
      updated_at: now,
    })
    .eq('id', user.uid || user.id);

  if (error && !isSupabaseSchemaMismatchError(error)) {
    throw error;
  }
}

export function subscribeToFriendPresence(
  user: AppUser,
  friendUserIds: string[],
  options: SubscribeToFriendPresenceOptions
) {
  const ownUserId = user.uid || user.id;
  const normalizedFriendUserIds = Array.from(
    new Set(
      friendUserIds
        .map((friendUserId) => friendUserId.trim())
        .filter((friendUserId) => friendUserId.length > 0 && friendUserId !== ownUserId)
    )
  );

  if (normalizedFriendUserIds.length === 0) {
    options.onPresence({});
    return () => undefined;
  }

  const supabase = requireSupabase();
  const friendUserIdSet = new Set(normalizedFriendUserIds);
  const lastSeenByUserId = new Map<string, string>();
  let disposed = false;

  const channel = supabase.channel('shared-friend-presence', {
    config: {
      presence: {
        key: ownUserId,
      },
    },
  });

  const emitPresence = () => {
    if (disposed) {
      return;
    }

    const onlineUserIds = getOnlinePresenceKeys(channel.presenceState() as Record<string, unknown>);
    const snapshot = normalizedFriendUserIds.reduce<FriendPresenceSnapshot>(
      (nextSnapshot, friendUserId) => {
        const isOnline = onlineUserIds.has(friendUserId);
        nextSnapshot[friendUserId] = {
          status: isOnline ? 'online' : 'offline',
          lastSeenAt: isOnline ? null : lastSeenByUserId.get(friendUserId) ?? null,
        };
        return nextSnapshot;
      },
      {}
    );

    options.onPresence(snapshot);
  };

  void getFriendLastSeenMap(normalizedFriendUserIds)
    .then((lastSeenByUserIdSnapshot) => {
      for (const [friendUserId, lastSeenAt] of lastSeenByUserIdSnapshot) {
        lastSeenByUserId.set(friendUserId, lastSeenAt);
      }
      emitPresence();
    })
    .catch((error) => {
      if (!disposed) {
        options.onError?.(error);
      }
    });

  const rememberOffline = (presenceKey: unknown) => {
    const friendUserId = typeof presenceKey === 'string' ? presenceKey : '';
    if (friendUserIdSet.has(friendUserId)) {
      lastSeenByUserId.set(friendUserId, getNowIso());
    }
  };

  channel
    .on('presence', { event: 'sync' }, emitPresence)
    .on('presence', { event: 'join' }, emitPresence)
    .on('presence', { event: 'leave' }, ({ key }) => {
      rememberOffline(key);
      emitPresence();
    })
    .subscribe((status) => {
      if (disposed) {
        return;
      }

      if (status === 'SUBSCRIBED') {
        void channel
          .track({
            user_id: ownUserId,
            online_at: getNowIso(),
          })
          .then(() => emitPresence())
          .catch((error) => {
            if (!disposed) {
              options.onError?.(error);
            }
          });
      }
    });

  return () => {
    disposed = true;
    void updateOwnPresenceLastSeen(user).catch(() => undefined);
    void channel.untrack();
    void supabase.removeChannel(channel);
  };
}

export function subscribeToSharedPostTyping(
  user: AppUser,
  postId: string,
  options: SubscribeToSharedPostTypingOptions
) {
  const normalizedPostId = postId.trim();
  const ownUserId = user.uid || user.id;
  if (!normalizedPostId || !ownUserId) {
    options.onTypingUsers([]);
    return {
      setTyping: () => undefined,
      unsubscribe: () => undefined,
    };
  }

  const supabase = requireSupabase();
  let disposed = false;
  let subscribed = false;
  let pendingTypingState: boolean | null = null;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const emitTypingUsers = () => {
    if (disposed || !channel) {
      return;
    }

    options.onTypingUsers(
      getTypingUsersFromPresenceState(channel.presenceState() as Record<string, unknown>, ownUserId)
    );
  };

  const trackTyping = (isTyping: boolean) => {
    if (disposed) {
      return;
    }

    if (!subscribed) {
      pendingTypingState = isTyping;
      return;
    }

    const activeChannel = channel;
    if (!activeChannel) {
      pendingTypingState = isTyping;
      subscribed = false;
      return;
    }

    void activeChannel
      .track({
        user_id: ownUserId,
        display_name: getDisplayName(user),
        photo_url: user.photoURL ?? null,
        is_typing: isTyping,
        typing_at: isTyping ? getNowIso() : null,
      })
      .then(emitTypingUsers)
      .catch((error) => {
        if (!disposed) {
          options.onError?.(error);
        }
      });
  };

  const setupChannel = async () => {
    const topic = `realtime:shared-post-typing:${normalizedPostId}`;
    const existingChannel = supabase.getChannels().find((candidate) => candidate.topic === topic);
    if (existingChannel) {
      await supabase.removeChannel(existingChannel);
    }

    if (disposed) {
      return;
    }

    const nextChannel = supabase.channel(`shared-post-typing:${normalizedPostId}`, {
      config: {
        presence: {
          key: ownUserId,
        },
      },
    });
    channel = nextChannel;

    nextChannel
      .on('presence', { event: 'sync' }, emitTypingUsers)
      .on('presence', { event: 'join' }, emitTypingUsers)
      .on('presence', { event: 'leave' }, emitTypingUsers)
      .subscribe((status) => {
        if (disposed || status !== 'SUBSCRIBED') {
          return;
        }

        subscribed = true;
        trackTyping(pendingTypingState ?? false);
        pendingTypingState = null;
      });
  };

  void setupChannel().catch((error) => {
    if (!disposed) {
      options.onError?.(error);
    }
  });

  return {
    setTyping: trackTyping,
    unsubscribe: () => {
      disposed = true;
      options.onTypingUsers([]);
      if (channel) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    },
  };
}

export function subscribeToSharedPostResponses(
  user: AppUser,
  postId: string,
  options: SharedPostResponsesSubscriptionOptions
) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return () => undefined;
  }

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

    refreshInFlight = getSharedPostResponsesPage(user, normalizedPostId, {
      limit: options.initialPageSize,
    })
      .then((responses) => {
        if (!disposed) {
          options.onResponses(responses);
        }
      })
      .catch((error) => {
        if (!disposed) {
          options.onError?.(error);
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
    }, 100);
  };

  const safelyApplyDelta = (operation: () => void | Promise<void>) => {
    void Promise.resolve(operation()).catch((error) => {
      if (!disposed) {
        options.onError?.(error);
      }
    });
  };

  options.onStatus?.('connecting');
  const channel = supabase
    .channel(`shared-post-responses:${normalizedPostId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_post_responses',
        filter: `post_id=eq.${normalizedPostId}`,
      },
      (payload) => {
        const eventType = (payload as { eventType?: string }).eventType;
        if (eventType === 'DELETE') {
          const oldResponse = getRealtimeRecord<Partial<SharedPostResponseRow>>(payload, 'old');
          if (oldResponse?.id && options.onResponseDeleted) {
            safelyApplyDelta(() => options.onResponseDeleted?.(oldResponse.id!));
            return;
          }

          scheduleRefresh();
          return;
        }

        const nextResponse = getRealtimeRecord<SharedPostResponseRow>(payload, 'new');
        if (nextResponse?.id && options.onResponse) {
          safelyApplyDelta(async () => {
            const [hydratedResponse] = await hydrateSharedPostResponseStickers([
              mapSharedPostResponse(nextResponse),
            ]);
            if (hydratedResponse) {
              await options.onResponse?.(hydratedResponse);
            }
          });
          return;
        }

        scheduleRefresh();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_post_response_reactions',
        filter: `post_id=eq.${normalizedPostId}`,
      },
      (payload) => {
        const eventType = (payload as { eventType?: string }).eventType;
        if (eventType === 'DELETE') {
          const oldReaction = getRealtimeRecord<Partial<SharedPostResponseReactionRow>>(
            payload,
            'old'
          );
          if (oldReaction?.id && options.onReactionDeleted) {
            safelyApplyDelta(() =>
              options.onReactionDeleted?.({
                id: oldReaction.id!,
                postId: oldReaction.post_id ?? normalizedPostId,
                responseId: oldReaction.response_id ?? null,
                authorUid: oldReaction.author_user_id ?? null,
              })
            );
            return;
          }

          scheduleRefresh();
          return;
        }

        const nextReaction = getRealtimeRecord<SharedPostResponseReactionRow>(payload, 'new');
        if (nextReaction?.id && options.onReaction) {
          safelyApplyDelta(() => options.onReaction?.(mapSharedPostResponseReaction(nextReaction)));
          return;
        }

        scheduleRefresh();
      }
    )
    .subscribe((status) => {
      if (disposed) {
        return;
      }

      options.onStatus?.(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
    });

  refresh();

  return () => {
    disposed = true;
    options.onStatus?.('disconnected');
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    void supabase.removeChannel(channel);
  };
}

export async function createSharedPostResponse(
  user: AppUser,
  postId: string,
  input: {
    emoji?: string | null;
    text?: string | null;
    replyToResponseId?: string | null;
    sticker?: SharedPostResponseStickerInput | null;
  }
): Promise<SharedPostResponse> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    throw new Error('Shared post required.');
  }

  const emoji = input.emoji?.trim() || null;
  const text = input.text?.trim() || '';
  const stickerInput = input.sticker ?? null;
  const replyToResponseId = input.replyToResponseId?.trim() || null;
  let sticker: SharedPostResponseSticker | null = null;
  if (stickerInput) {
    const uploadedSticker = await uploadStickerAssetToStorage(
      SHARED_POST_MEDIA_BUCKET,
      user.id,
      stickerInput.asset
    );
    if (!uploadedSticker.remotePath) {
      throw new Error('Could not upload sticker.');
    }
    const renderMode = stickerInput.renderMode === 'stamp' ? 'stamp' : 'default';
    sticker = {
      assetId: uploadedSticker.id,
      localUri: uploadedSticker.localUri,
      remotePath: uploadedSticker.remotePath,
      mimeType: uploadedSticker.mimeType,
      width: uploadedSticker.width,
      height: uploadedSticker.height,
      renderMode,
      stampStyle:
        renderMode === 'stamp'
          ? stickerInput.stampStyle === 'circle'
            ? 'circle'
            : 'classic'
          : null,
    };
  }

  if (!emoji && !text && !sticker) {
    throw new Error('Add a reaction or a short reply.');
  }

  if (text.length > 160) {
    throw new Error('Use 160 characters or fewer.');
  }

  const id = `shared-response-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
  const record: SharedPostResponseRow = {
    id,
    post_id: normalizedPostId,
    author_user_id: user.id,
    author_display_name: getDisplayName(user),
    author_photo_url_snapshot: user.photoURL ?? null,
    emoji,
    text,
    sticker_asset_id: sticker?.assetId ?? null,
    sticker_remote_path: sticker?.remotePath ?? null,
    sticker_mime_type: sticker?.mimeType ?? null,
    sticker_width: sticker?.width ?? null,
    sticker_height: sticker?.height ?? null,
    sticker_render_mode: sticker?.renderMode ?? null,
    sticker_stamp_style: sticker?.stampStyle ?? null,
    reply_to_response_id: replyToResponseId,
    created_at: getNowIso(),
  };

  const { error } = await requireSupabase().from('shared_post_responses').insert(record);
  if (error) {
    throw error;
  }

  void sendSocialNotificationEvent({
    type: 'shared_post_response_created',
    responseId: id,
  }).catch((notificationError) => {
    console.warn('[shared-feed] Failed to send shared response notification:', notificationError);
  });

  return {
    ...mapSharedPostResponse(record),
    sticker,
  };
}

export async function createSharedPostResponseReaction(
  user: AppUser,
  postId: string,
  responseId: string,
  emojiInput: string
): Promise<SharedPostResponseReaction> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostId = postId.trim();
  const normalizedResponseId = responseId.trim();
  const emoji = emojiInput.trim();
  if (!normalizedPostId || !normalizedResponseId) {
    throw new Error('Message required.');
  }

  if (!emoji || emoji.length > 16) {
    throw new Error('Choose a reaction.');
  }

  const id = `shared-response-reaction-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
  const record: SharedPostResponseReactionRow = {
    id,
    post_id: normalizedPostId,
    response_id: normalizedResponseId,
    author_user_id: user.id,
    author_display_name: getDisplayName(user),
    author_photo_url_snapshot: user.photoURL ?? null,
    emoji,
    created_at: getNowIso(),
  };

  const { error } = await requireSupabase()
    .from('shared_post_response_reactions')
    .upsert(record, { onConflict: 'response_id,author_user_id' });
  if (error) {
    throw error;
  }

  return mapSharedPostResponseReaction(record);
}

export async function deleteSharedPostResponseReaction(
  user: AppUser,
  postId: string,
  responseId: string
): Promise<void> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostId = postId.trim();
  const normalizedResponseId = responseId.trim();
  if (!normalizedPostId || !normalizedResponseId) {
    throw new Error('Message required.');
  }

  const { error } = await requireSupabase()
    .from('shared_post_response_reactions')
    .delete()
    .eq('post_id', normalizedPostId)
    .eq('response_id', normalizedResponseId)
    .eq('author_user_id', user.id);
  if (error) {
    throw error;
  }
}

export async function deleteSharedPostResponse(
  user: AppUser,
  postId: string,
  responseId: string
): Promise<void> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const normalizedPostId = postId.trim();
  const normalizedResponseId = responseId.trim();
  if (!normalizedPostId || !normalizedResponseId) {
    throw new Error('Message required.');
  }

  const supabase = requireSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('shared_post_responses')
    .select('id, sticker_remote_path')
    .eq('post_id', normalizedPostId)
    .eq('id', normalizedResponseId)
    .eq('author_user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existing) {
    throw new Error('Message not found.');
  }

  const { error } = await supabase
    .from('shared_post_responses')
    .delete()
    .eq('post_id', normalizedPostId)
    .eq('id', normalizedResponseId)
    .eq('author_user_id', user.id);

  if (error) {
    throw error;
  }

  const stickerRemotePath =
    (existing as { sticker_remote_path?: string | null }).sticker_remote_path?.trim() || null;
  await cleanupRemoteArtifactsBestEffort(
    `shared response ${normalizedResponseId}`,
    SHARED_POST_MEDIA_BUCKET,
    { stickerPaths: stickerRemotePath ? [stickerRemotePath] : [] }
  );
}

export async function updateSharedPost(
  user: AppUser,
  postId: string,
  note: Note
): Promise<void> {
  invalidateSharedFeedRefresh(user.id);
  const shareableNote = await hydrateShareableNote(note);
  const supabase = requireSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('shared_posts')
    .select(SHARED_POST_SELECT_FIELDS)
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

  const currentArtifacts = getSharedPostRemoteArtifacts(current);
  let nextPhotoPath: string | null = null;
  let nextDualPrimaryPhotoPath: string | null = null;
  let nextDualSecondaryPhotoPath: string | null = null;
  let nextPairedVideoPath: string | null = null;
  let nextStickerPlacementsJson: string | null = null;

  try {
    ({
      photoPath: nextPhotoPath,
      dualPrimaryPhotoPath: nextDualPrimaryPhotoPath,
      dualSecondaryPhotoPath: nextDualSecondaryPhotoPath,
      pairedVideoPath: nextPairedVideoPath,
    } = await uploadSharedPostMediaArtifacts({
      userId: user.id,
      postId,
      note: shareableNote,
      existingArtifacts: currentArtifacts,
      allowOverwrite: true,
    }));
    const stickerPlacements = parseNoteStickerPlacements(shareableNote.stickerPlacementsJson);
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
            dualPrimaryPhotoPath: nextDualPrimaryPhotoPath,
            dualSecondaryPhotoPath: nextDualSecondaryPhotoPath,
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
      text:
        shareableNote.type === 'text'
          ? formatNoteTextWithEmoji(shareableNote.content.trim(), shareableNote.moodEmoji)
          : shareableNote.caption?.trim() ?? '',
      photo_path: nextPhotoPath ?? null,
      capture_variant: normalizeSharedPostCaptureVariant(
        shareableNote.type,
        shareableNote.captureVariant ?? null
      ),
      dual_primary_photo_path: nextDualPrimaryPhotoPath ?? null,
      dual_secondary_photo_path: nextDualSecondaryPhotoPath ?? null,
      dual_primary_facing: normalizeSharedPostDualFacing(shareableNote.dualPrimaryFacing),
      dual_secondary_facing: normalizeSharedPostDualFacing(shareableNote.dualSecondaryFacing),
      dual_layout_preset: normalizeSharedPostDualLayoutPreset(shareableNote.dualLayoutPreset),
      is_live_photo: Boolean(shareableNote.isLivePhoto && nextPairedVideoPath),
      paired_video_path: nextPairedVideoPath ?? null,
      doodle_strokes_json: shareableNote.doodleStrokesJson ?? null,
      sticker_placements_json: nextStickerPlacementsJson,
      note_color: shareableNote.type === 'text' ? resolveSavedTextNoteColor(shareableNote.noteColor) : null,
      place_name: shareableNote.locationName ?? null,
      latitude: shareableNote.latitude,
      longitude: shareableNote.longitude,
      updated_at: getNowIso(),
      type: shareableNote.type,
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
            dualPrimaryPhotoPath: nextDualPrimaryPhotoPath,
            dualSecondaryPhotoPath: nextDualSecondaryPhotoPath,
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
        dualPrimaryPhotoPath: nextDualPrimaryPhotoPath,
        dualSecondaryPhotoPath: nextDualSecondaryPhotoPath,
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
  invalidateSharedFeedRefresh(user.id);
  const dedupedNoteIds = normalizeRemoteEntityIds(noteIds);
  if (dedupedNoteIds.length === 0) {
    return [];
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('shared_posts')
    .select(
      'id, photo_path, dual_primary_photo_path, dual_secondary_photo_path, paired_video_path, sticker_placements_json'
    )
    .eq('author_user_id', user.id)
    .in('source_note_id', dedupedNoteIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as {
    id: string;
    photo_path?: string | null;
    dual_primary_photo_path?: string | null;
    dual_secondary_photo_path?: string | null;
    paired_video_path?: string | null;
    sticker_placements_json?: string | null;
  }[];
  if (rows.length === 0) {
    return [];
  }

  const postIds = normalizeRemoteEntityIds(rows.map((row) => row.id));
  const deletedAt = getNowIso();

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

  await Promise.all(
    rows.map((row) =>
      cleanupRemoteArtifactsBestEffort(
        `shared post ${row.id}`,
        SHARED_POST_MEDIA_BUCKET,
        getReusableSharedPostCleanupArtifacts({
          photoPath: row.photo_path ?? null,
          dualPrimaryPhotoPath: row.dual_primary_photo_path ?? null,
          dualSecondaryPhotoPath: row.dual_secondary_photo_path ?? null,
          pairedVideoPath: row.paired_video_path ?? null,
          stickerPaths: getRemoteStickerAssetPaths(row.sticker_placements_json ?? null),
        })
      )
    )
  );

  return postIds;
}

export async function deleteSharedPost(
  user: AppUser,
  postId: string
): Promise<void> {
  invalidateSharedFeedRefresh(user.id);
  const supabase = requireSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('shared_posts')
    .select('photo_path, dual_primary_photo_path, dual_secondary_photo_path, paired_video_path, sticker_placements_json')
    .eq('id', postId)
    .eq('author_user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const expectedDeletedPostIds = existing ? [postId] : [];
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
  await cleanupRemoteArtifactsBestEffort(
    `shared post ${postId}`,
    SHARED_POST_MEDIA_BUCKET,
    getReusableSharedPostCleanupArtifacts({
      photoPath: (existing as { photo_path?: string | null } | null)?.photo_path ?? null,
      dualPrimaryPhotoPath:
        (existing as { dual_primary_photo_path?: string | null } | null)?.dual_primary_photo_path ??
        null,
      dualSecondaryPhotoPath:
        (existing as { dual_secondary_photo_path?: string | null } | null)?.dual_secondary_photo_path ??
        null,
      pairedVideoPath:
        (existing as { paired_video_path?: string | null } | null)?.paired_video_path ?? null,
      stickerPaths: getRemoteStickerAssetPaths(
        (existing as { sticker_placements_json?: string | null } | null)?.sticker_placements_json ?? null
      ),
    })
  );
}
