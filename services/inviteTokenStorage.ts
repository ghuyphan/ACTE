import {
  clearStoredActiveInvite,
  getStoredActiveInvite,
  setStoredActiveInvite,
} from './activeInviteStorage';

interface StoredInviteToken {
  inviteId: string;
  token: string;
}

export async function getStoredInviteToken(userUid: string): Promise<StoredInviteToken | null> {
  const invite = await getStoredActiveInvite(userUid);
  if (!invite) {
    return null;
  }

  return {
    inviteId: invite.id,
    token: invite.token,
  };
}

export async function setStoredInviteToken(
  userUid: string,
  value: StoredInviteToken
): Promise<void> {
  await setStoredActiveInvite(userUid, {
    id: value.inviteId.trim(),
    inviterUid: userUid,
    inviterDisplayNameSnapshot: null,
    inviterPhotoURLSnapshot: null,
    token: value.token.trim(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    acceptedByUid: null,
    acceptedAt: null,
    expiresAt: null,
    url: '',
  });
}

export async function clearStoredInviteToken(userUid: string): Promise<void> {
  await clearStoredActiveInvite(userUid);
}
