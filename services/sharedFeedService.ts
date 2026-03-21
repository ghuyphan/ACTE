import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { AppUser, getUserDisplayName } from '../utils/appUser';
import {
  getCurrentSupabaseSession,
  getSupabase,
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
  isSupabasePolicyError,
} from '../utils/supabase';
import { Note, NoteType } from './database';
import { deletePhotoFromStorage, downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET, uploadPhotoToStorage } from './remoteMedia';
import { formatNoteTextWithEmoji } from './noteTextPresentation';
import { getPublicUserProfile, upsertPublicUserProfile } from './publicProfileService';
import { cacheSharedFeedSnapshot, replaceCachedSharedInvite } from './sharedFeedCache';

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
  doodleStrokesJson?: string | null;
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

interface FriendshipRow {
  user_id: string;
  friend_user_id: string;
  display_name_snapshot: string | null;
  photo_url_snapshot: string | null;
  friended_at: string;
  last_shared_at: string | null;
  created_by_invite_id: string | null;
  created_by_invite_token: string | null;
}

interface FriendInviteRow {
  id: string;
  inviter_user_id: string;
  inviter_display_name_snapshot: string | null;
  inviter_photo_url_snapshot: string | null;
  token: string;
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
  doodle_strokes_json?: string | null;
  place_name: string | null;
  source_note_id: string | null;
  created_at: string;
  updated_at: string | null;
}

const ACTIVE_FRIEND_INVITE_QUERY_LIMIT = 50;
const EXPIRED_SHARED_FEED_SESSION_ERROR = 'Supabase session unavailable. Sign in again to use shared moments.';
const MISMATCHED_SHARED_FEED_SESSION_ERROR =
  'Signed-in Supabase session does not match this account. Sign out and sign in again.';

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

function buildInviteUrl(inviteId: string, token: string) {
  return Linking.createURL('/friends/join', {
    queryParams: {
      inviteId,
      invite: token,
    },
  });
}

function mapInvite(record: FriendInviteRow): FriendInvite {
  return {
    id: record.id,
    inviterUid: record.inviter_user_id,
    inviterDisplayNameSnapshot: record.inviter_display_name_snapshot ?? null,
    inviterPhotoURLSnapshot: record.inviter_photo_url_snapshot ?? null,
    token: record.token,
    createdAt: record.created_at,
    revokedAt: record.revoked_at ?? null,
    acceptedByUid: record.accepted_by_user_id ?? null,
    acceptedAt: record.accepted_at ?? null,
    expiresAt: record.expires_at ?? null,
    url: buildInviteUrl(record.id, record.token),
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
    createdByInviteToken: row.created_by_invite_token ?? null,
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

async function hydrateSharedPostPhoto(postId: string, photoPath?: string | null) {
  if (!photoPath?.trim()) {
    return null;
  }

  return downloadPhotoFromStorage(
    SHARED_POST_MEDIA_BUCKET,
    photoPath,
    `shared-post-${postId}`
  );
}

async function mapSharedPost(record: SharedPostRow): Promise<SharedPost> {
  const photoLocalUri =
    record.type === 'photo'
      ? await hydrateSharedPostPhoto(record.id, record.photo_path)
      : null;

  return {
    id: record.id,
    authorUid: record.author_user_id,
    authorDisplayName: record.author_display_name ?? null,
    authorPhotoURLSnapshot: record.author_photo_url_snapshot ?? null,
    audienceUserIds: Array.isArray(record.audience_user_ids) ? record.audience_user_ids : [],
    type: record.type,
    text: record.text ?? '',
    photoLocalUri,
    photoRemoteBase64: null,
    doodleStrokesJson: record.doodle_strokes_json ?? null,
    placeName: record.place_name ?? null,
    sourceNoteId: record.source_note_id ?? null,
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
      'user_id, friend_user_id, display_name_snapshot, photo_url_snapshot, friended_at, last_shared_at, created_by_invite_id, created_by_invite_token'
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
    return 'Shared moments need the latest Supabase policies before this action can work.';
  }

  if (isSupabaseNetworkError(error)) {
    return 'Supabase is unavailable right now. Check your connection and try again.';
  }

  return message || 'Shared moments are unavailable right now.';
}

export async function getActiveFriendInvite(user: AppUser): Promise<FriendInvite | null> {
  const { data, error } = await requireSupabase()
    .from('friend_invites')
    .select(
      'id, inviter_user_id, inviter_display_name_snapshot, inviter_photo_url_snapshot, token, created_at, revoked_at, accepted_by_user_id, accepted_at, expires_at'
    )
    .eq('inviter_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(ACTIVE_FRIEND_INVITE_QUERY_LIMIT);

  if (error) {
    throw error;
  }

  const invite = ((data ?? []) as FriendInviteRow[]).find((item) => isInviteActive(item));
  return invite ? mapInvite(invite) : null;
}

export async function refreshSharedFeed(user: AppUser): Promise<SharedFeedSnapshot> {
  await ensureSupabaseSessionMatchesUser(user.id);

  const friends = await getFriendsForUser(user.id);
  const friendUids = friends.map((friend: FriendConnection) => friend.userId);
  const authorWhitelist = [user.id, ...friendUids].slice(0, 30);

  const [activeInvite, postsResponse] = await Promise.all([
    getActiveFriendInvite(user),
    requireSupabase()
      .from('shared_posts')
      .select(
        'id, author_user_id, author_display_name, author_photo_url_snapshot, audience_user_ids, type, text, photo_path, doodle_strokes_json, place_name, source_note_id, created_at, updated_at'
      )
      .contains('audience_user_ids', [user.id])
      .in('author_user_id', authorWhitelist)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (postsResponse.error) {
    throw postsResponse.error;
  }

  const sharedPosts = await Promise.all(
    ((postsResponse.data ?? []) as SharedPostRow[]).map((item) => mapSharedPost(item))
  );

  const snapshot = {
    friends,
    sharedPosts,
    activeInvite,
  };
  await cacheSharedFeedSnapshot(user.id, snapshot);
  return snapshot;
}

export function subscribeToSharedFeed(
  user: AppUser,
  { onSnapshot: handleSnapshot, onError }: SubscribeToSharedFeedOptions
) {
  const supabase = requireSupabase();
  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const refresh = () => {
    if (disposed) {
      return;
    }

    void refreshSharedFeed(user)
      .then((snapshot) => {
        if (!disposed) {
          handleSnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (!disposed) {
          onError?.(error);
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
      scheduleRefresh
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
  const nextInvite: FriendInviteRow = {
    id: inviteId,
    inviter_user_id: user.id,
    inviter_display_name_snapshot: getDisplayName(user),
    inviter_photo_url_snapshot: user.photoURL ?? null,
    token: Crypto.randomUUID(),
    created_at: getNowIso(),
    revoked_at: null,
    accepted_by_user_id: null,
    accepted_at: null,
    expires_at: null,
  };

  const { error } = await supabase.from('friend_invites').upsert(nextInvite, {
    onConflict: 'id',
  });
  if (error) {
    throw error;
  }

  const invite = mapInvite(nextInvite);
  await replaceCachedSharedInvite(user.id, invite);
  return invite;
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

  await replaceCachedSharedInvite(user.id, null);
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

  return {
    ...connection,
    displayNameSnapshot: inviterProfile.displayNameSnapshot ?? connection.displayNameSnapshot,
    photoURLSnapshot: inviterProfile.photoURLSnapshot ?? connection.photoURLSnapshot,
  };
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
  const dedupedAudience = Array.from(new Set(audienceUserIds.filter(Boolean)));

  if (dedupedAudience.length <= 1) {
    throw new Error('Connect a friend before sharing moments.');
  }

  const postId = `shared-post-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
  const now = getNowIso();
  const photoPath =
    note.type === 'photo'
      ? await uploadPhotoToStorage(
          SHARED_POST_MEDIA_BUCKET,
          `${user.id}/${postId}`,
          note.photoLocalUri ?? note.content
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
    doodle_strokes_json: note.doodleStrokesJson ?? null,
    place_name: note.locationName ?? null,
    source_note_id: note.id,
    created_at: now,
    updated_at: null,
  };

  const { error } = await supabase.from('shared_posts').insert(record);
  if (error) {
    throw error;
  }

  const friendRefs = dedupedAudience.filter((uid) => uid !== user.id);
  if (friendRefs.length > 0) {
    await supabase
      .from('friendships')
      .update({ last_shared_at: now })
      .eq('user_id', user.id)
      .in('friend_user_id', friendRefs);
  }

  return mapSharedPost(record);
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
      'id, author_user_id, author_display_name, author_photo_url_snapshot, audience_user_ids, type, text, photo_path, doodle_strokes_json, place_name, source_note_id, created_at, updated_at'
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

  if (current.photo_path && note.type !== 'photo') {
    await deletePhotoFromStorage(SHARED_POST_MEDIA_BUCKET, current.photo_path).catch(() => undefined);
  }

  const nextPhotoPath =
    note.type === 'photo'
      ? await uploadPhotoToStorage(
          SHARED_POST_MEDIA_BUCKET,
          `${user.id}/${postId}`,
          note.photoLocalUri ?? note.content
        )
      : null;

  const { error } = await supabase
    .from('shared_posts')
    .update({
      text: note.type === 'text' ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji) : '',
      photo_path: nextPhotoPath ?? null,
      doodle_strokes_json: note.doodleStrokesJson ?? null,
      place_name: note.locationName ?? null,
      updated_at: getNowIso(),
      type: note.type,
    })
    .eq('id', postId)
    .eq('author_user_id', user.id);

  if (error) {
    throw error;
  }
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

export async function deleteSharedPost(
  user: AppUser,
  postId: string
): Promise<void> {
  const supabase = requireSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('shared_posts')
    .select('photo_path')
    .eq('id', postId)
    .eq('author_user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  await deletePhotoFromStorage(
    SHARED_POST_MEDIA_BUCKET,
    (existing as { photo_path?: string | null } | null)?.photo_path ?? null
  ).catch(() => undefined);

  const { error } = await supabase
    .from('shared_posts')
    .delete()
    .eq('id', postId)
    .eq('author_user_id', user.id);

  if (error) {
    throw error;
  }
}
