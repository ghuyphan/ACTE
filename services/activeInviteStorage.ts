import { Platform } from 'react-native';
import type { FriendInvite } from './sharedFeedService';
import { normalizeOptionalString } from './stringNormalization';
import { getSecureItem, removeSecureItem, setSecureItem } from '../utils/secureStorage';

const ACTIVE_INVITE_STORAGE_KEY_PREFIX = 'shared.activeInvite.';
const ACTIVE_INVITE_STORAGE_INDEX_KEY = 'shared.activeInvite.index';
const activeInviteMemoryStore = new Map<string, FriendInvite>();

type StoredActiveInvite = Omit<FriendInvite, 'url'>;

function getActiveInviteStorageKey(userUid: string) {
  return `${ACTIVE_INVITE_STORAGE_KEY_PREFIX}${userUid}`;
}

function buildInviteUrl(invite: StoredActiveInvite) {
  return `noto://friends/join?inviteId=${encodeURIComponent(invite.id)}&invite=${encodeURIComponent(invite.token)}`;
}

function sanitizeStoredActiveInvite(value: Partial<StoredActiveInvite> | null | undefined): FriendInvite | null {
  if (!value) {
    return null;
  }

  const id = normalizeOptionalString(value.id);
  const inviterUid = normalizeOptionalString(value.inviterUid);
  const token = normalizeOptionalString(value.token);
  const createdAt = normalizeOptionalString(value.createdAt);

  if (!id || !inviterUid || !token || !createdAt) {
    return null;
  }

  const revokedAt = normalizeOptionalString(value.revokedAt);
  const acceptedByUid = normalizeOptionalString(value.acceptedByUid);
  const acceptedAt = normalizeOptionalString(value.acceptedAt);
  const expiresAt = normalizeOptionalString(value.expiresAt);
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;

  if (
    revokedAt ||
    acceptedByUid ||
    acceptedAt ||
    (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()))
  ) {
    return null;
  }

  const invite: StoredActiveInvite = {
    id,
    inviterUid,
    inviterDisplayNameSnapshot: value.inviterDisplayNameSnapshot ?? null,
    inviterPhotoURLSnapshot: value.inviterPhotoURLSnapshot ?? null,
    token,
    createdAt,
    revokedAt: revokedAt || null,
    acceptedByUid: acceptedByUid || null,
    acceptedAt: acceptedAt || null,
    expiresAt: expiresAt || null,
  };

  return {
    ...invite,
    url: buildInviteUrl(invite),
  };
}

async function readStoredInviteIndex(): Promise<string[]> {
  if (Platform.OS === 'web') {
    return Array.from(activeInviteMemoryStore.keys());
  }

  const rawValue = await getSecureItem(ACTIVE_INVITE_STORAGE_INDEX_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(parsed.map((value) => normalizeOptionalString(typeof value === 'string' ? value : null)).filter(Boolean))
      );
    }
  } catch {
    // Ignore malformed index state and rebuild it on the next write.
  }

  await removeSecureItem(ACTIVE_INVITE_STORAGE_INDEX_KEY).catch(() => undefined);
  return [];
}

async function writeStoredInviteIndex(userUids: string[]) {
  if (Platform.OS === 'web') {
    return;
  }

  if (userUids.length === 0) {
    await removeSecureItem(ACTIVE_INVITE_STORAGE_INDEX_KEY);
    return;
  }

  await setSecureItem(ACTIVE_INVITE_STORAGE_INDEX_KEY, JSON.stringify(userUids));
}

async function updateStoredInviteIndex(userUid: string, action: 'add' | 'remove') {
  if (!userUid) {
    return;
  }

  const nextIndex = new Set(await readStoredInviteIndex());
  if (action === 'add') {
    nextIndex.add(userUid);
  } else {
    nextIndex.delete(userUid);
  }

  await writeStoredInviteIndex(Array.from(nextIndex));
}

export async function getStoredActiveInvite(userUid: string): Promise<FriendInvite | null> {
  if (Platform.OS === 'web') {
    return sanitizeStoredActiveInvite(activeInviteMemoryStore.get(userUid));
  }

  const rawValue = await getSecureItem(getActiveInviteStorageKey(userUid));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredActiveInvite>;
    const invite = sanitizeStoredActiveInvite(parsed);
    if (invite) {
      return invite;
    }
  } catch {
    // Ignore malformed secure storage and clear it below.
  }

  await clearStoredActiveInvite(userUid).catch(() => undefined);
  return null;
}

export async function setStoredActiveInvite(userUid: string, invite: FriendInvite): Promise<void> {
  const sanitizedInvite = sanitizeStoredActiveInvite(invite);
  if (!sanitizedInvite) {
    await clearStoredActiveInvite(userUid);
    return;
  }

  const storedInvite: StoredActiveInvite = {
    id: sanitizedInvite.id,
    inviterUid: sanitizedInvite.inviterUid,
    inviterDisplayNameSnapshot: sanitizedInvite.inviterDisplayNameSnapshot,
    inviterPhotoURLSnapshot: sanitizedInvite.inviterPhotoURLSnapshot,
    token: sanitizedInvite.token,
    createdAt: sanitizedInvite.createdAt,
    revokedAt: sanitizedInvite.revokedAt,
    acceptedByUid: sanitizedInvite.acceptedByUid,
    acceptedAt: sanitizedInvite.acceptedAt,
    expiresAt: sanitizedInvite.expiresAt,
  };

  if (Platform.OS === 'web') {
    activeInviteMemoryStore.set(userUid, sanitizedInvite);
    return;
  }

  await setSecureItem(getActiveInviteStorageKey(userUid), JSON.stringify(storedInvite));
  await updateStoredInviteIndex(userUid, 'add');
}

export async function clearStoredActiveInvite(userUid?: string | null): Promise<void> {
  if (!userUid) {
    if (Platform.OS === 'web') {
      activeInviteMemoryStore.clear();
      return;
    }

    const storedUserUids = await readStoredInviteIndex();
    await Promise.all(
      storedUserUids.map((storedUserUid) =>
        removeSecureItem(getActiveInviteStorageKey(storedUserUid)).catch(() => undefined)
      )
    );
    await removeSecureItem(ACTIVE_INVITE_STORAGE_INDEX_KEY).catch(() => undefined);
    return;
  }

  if (Platform.OS === 'web') {
    activeInviteMemoryStore.delete(userUid);
    return;
  }

  await removeSecureItem(getActiveInviteStorageKey(userUid)).catch(() => undefined);
  await updateStoredInviteIndex(userUid, 'remove');
}
