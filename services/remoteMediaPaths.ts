export type UserMediaOwner = string | null | undefined;
export type DualMediaSlot = 'primary' | 'secondary';

function normalizePathPart(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasUnsafeStoragePathSegment(value: string) {
  return (
    !value ||
    value.startsWith('/') ||
    value.includes('//') ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) ||
    value.split('/').some((segment) => segment === '.' || segment === '..')
  );
}

export function buildUserMediaBasePath(ownerUserId: UserMediaOwner, entityId: string) {
  const normalizedOwner = normalizePathPart(ownerUserId);
  const normalizedEntityId = normalizePathPart(entityId);
  if (!normalizedOwner || !normalizedEntityId) {
    throw new Error('A remote media path requires an owner and entity id.');
  }

  return `${normalizedOwner}/${normalizedEntityId}`;
}

export function buildDualPhotoRemotePath(basePath: string, slot: DualMediaSlot) {
  return `${basePath}.dual-${slot}`;
}

export function isUserOwnedRemoteMediaPath(ownerUserId: UserMediaOwner, path: string | null | undefined) {
  const normalizedOwner = normalizePathPart(ownerUserId);
  const normalizedPath = normalizePathPart(path);
  if (!normalizedOwner || hasUnsafeStoragePathSegment(normalizedPath)) {
    return false;
  }

  return normalizedPath.startsWith(`${normalizedOwner}/`);
}

export function filterUserOwnedRemoteMediaPaths(
  ownerUserId: UserMediaOwner,
  paths: Iterable<string | null | undefined>
) {
  const ownedPaths: string[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    const normalizedPath = normalizePathPart(path);
    if (!isUserOwnedRemoteMediaPath(ownerUserId, normalizedPath) || seen.has(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    ownedPaths.push(normalizedPath);
  }

  return ownedPaths;
}
