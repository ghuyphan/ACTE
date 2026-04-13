import { Platform } from 'react-native';
import { getSecureItem, removeSecureItem, setSecureItem } from '../utils/secureStorage';

const ACTIVE_INVITE_TOKEN_STORAGE_KEY_PREFIX = 'shared.activeInviteToken.';
const inviteTokenMemoryStore = new Map<string, StoredInviteToken>();

interface StoredInviteToken {
  inviteId: string;
  token: string;
}

function getInviteTokenStorageKey(userUid: string) {
  return `${ACTIVE_INVITE_TOKEN_STORAGE_KEY_PREFIX}${userUid}`;
}

export async function getStoredInviteToken(userUid: string): Promise<StoredInviteToken | null> {
  if (Platform.OS === 'web') {
    return inviteTokenMemoryStore.get(userUid) ?? null;
  }

  const rawValue = await getSecureItem(getInviteTokenStorageKey(userUid));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredInviteToken>;
    if (
      typeof parsed.inviteId === 'string' &&
      parsed.inviteId.trim() &&
      typeof parsed.token === 'string' &&
      parsed.token.trim()
    ) {
      return {
        inviteId: parsed.inviteId.trim(),
        token: parsed.token.trim(),
      };
    }
  } catch {
    // Ignore malformed secure storage and refresh it on the next invite creation.
  }

  await clearStoredInviteToken(userUid).catch(() => undefined);
  return null;
}

export async function setStoredInviteToken(
  userUid: string,
  value: StoredInviteToken
): Promise<void> {
  if (Platform.OS === 'web') {
    inviteTokenMemoryStore.set(userUid, {
      inviteId: value.inviteId.trim(),
      token: value.token.trim(),
    });
    return;
  }

  await setSecureItem(
    getInviteTokenStorageKey(userUid),
    JSON.stringify({
      inviteId: value.inviteId.trim(),
      token: value.token.trim(),
    })
  );
}

export async function clearStoredInviteToken(userUid: string): Promise<void> {
  if (Platform.OS === 'web') {
    inviteTokenMemoryStore.delete(userUid);
    return;
  }

  await removeSecureItem(getInviteTokenStorageKey(userUid));
}
