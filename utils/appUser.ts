import type { User } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string | null;
  usernameSetAt?: string | null;
  photoURL: string | null;
  providerData: Array<{
    providerId: string;
  }>;
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function mapSupabaseUser(user: User | null | undefined): AppUser | null {
  if (!user?.id) {
    return null;
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = getMetadataString(metadata, ['display_name', 'displayName', 'full_name', 'name']);
  const username = getMetadataString(metadata, ['username', 'user_name']);
  const photoURL =
    getMetadataString(metadata, ['avatar_url', 'picture', 'photo_url', 'photoURL']) ?? null;

  const providersFromIdentities = Array.isArray(user.identities)
    ? user.identities
        .map((identity) => identity.provider)
        .filter((providerId): providerId is string => typeof providerId === 'string' && providerId.trim().length > 0)
    : [];
  const providersFromMetadata =
    typeof user.app_metadata?.provider === 'string' && user.app_metadata.provider.trim()
      ? [user.app_metadata.provider.trim()]
      : Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers.filter(
            (providerId): providerId is string =>
              typeof providerId === 'string' && providerId.trim().length > 0
          )
        : [];
  const providers = Array.from(new Set([...providersFromIdentities, ...providersFromMetadata]));

  return {
    id: user.id,
    uid: user.id,
    email: user.email?.trim() ?? null,
    displayName,
    username,
    photoURL,
    providerData: (providers.length ? providers : ['password']).map((providerId) => ({
      providerId,
    })),
  };
}

export function getUserDisplayName(user: Pick<AppUser, 'displayName' | 'email'>) {
  return user.displayName?.trim() || user.email?.trim() || 'Noto user';
}

export function getUserSocialName(user: Pick<AppUser, 'username' | 'displayName' | 'email'>) {
  return user.username?.trim() || user.displayName?.trim() || user.email?.trim() || 'Noto user';
}

export function deriveUsernameCandidate(email: string | null | undefined) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const localPart = normalizedEmail.includes('@') ? normalizedEmail.split('@')[0] ?? '' : normalizedEmail;
  const sanitized = localPart
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/[._]{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 20);

  return sanitized || 'noto';
}
