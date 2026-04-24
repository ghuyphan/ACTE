export interface SharedPostOwnershipCandidate {
  authorUid: string;
  audienceUserIds?: Array<string | null | undefined> | readonly (string | null | undefined)[] | null;
  sourceNoteId?: string | null;
}

function normalizeId(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeOwnedSharedNoteIds(noteIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(noteIds.map(normalizeId).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));
}

export function getOwnedSharedNoteIdsFromPosts(
  posts: SharedPostOwnershipCandidate[],
  userUid: string | null | undefined,
  options: { friendUserIds?: Array<string | null | undefined> | readonly (string | null | undefined)[] } = {}
) {
  const ownerUid = normalizeId(userUid ?? null);
  if (!ownerUid) {
    return [];
  }

  const friendUidSet = options.friendUserIds
    ? new Set(options.friendUserIds.map(normalizeId).filter(Boolean))
    : null;

  return normalizeOwnedSharedNoteIds(
    posts
      .filter((post) => {
        if (post.authorUid !== ownerUid) {
          return false;
        }

        const recipientUids = (post.audienceUserIds ?? [])
          .map(normalizeId)
          .filter((audienceUid) => audienceUid && audienceUid !== ownerUid);

        if (recipientUids.length === 0) {
          return false;
        }

        return friendUidSet
          ? recipientUids.some((audienceUid) => friendUidSet.has(audienceUid))
          : true;
      })
      .map((post) => post.sourceNoteId ?? null)
  );
}
