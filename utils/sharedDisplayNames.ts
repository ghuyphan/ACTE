import type {
  FriendConnection,
  SharedPost,
  SharedPostResponse,
} from '../services/sharedFeedService';

export function getFriendDisplayName(friend: FriendConnection, fallback: string) {
  return (
    friend.nickname?.trim() ||
    friend.displayNameSnapshot?.trim() ||
    (friend.username ? `@${friend.username}` : fallback)
  );
}

export function buildFriendDisplayNameById(
  friends: FriendConnection[],
  fallback: string
) {
  const labels = new Map<string, string>();
  for (const friend of friends) {
    labels.set(friend.userId, getFriendDisplayName(friend, fallback));
  }
  return labels;
}

export function getSharedAuthorDisplayName(
  authorUid: string,
  authorDisplayName: string | null | undefined,
  friendLabelById: ReadonlyMap<string, string>,
  fallback: string,
  currentUserUid?: string | null,
  selfLabel?: string
) {
  if (currentUserUid && authorUid === currentUserUid && selfLabel) {
    return selfLabel;
  }

  return friendLabelById.get(authorUid) || authorDisplayName?.trim() || fallback;
}

export function applyFriendNicknamesToSharedPosts(
  posts: SharedPost[],
  friends: FriendConnection[],
  currentUserUid?: string | null
) {
  const nicknameByFriendUid = new Map(
    friends
      .map((friend) => [friend.userId, friend.nickname?.trim() || null] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  );

  if (nicknameByFriendUid.size === 0) {
    return posts;
  }

  return posts.map((post) => {
    if (currentUserUid && post.authorUid === currentUserUid) {
      return post;
    }

    const nickname = nicknameByFriendUid.get(post.authorUid);
    return nickname
      ? {
          ...post,
          authorDisplayName: nickname,
        }
      : post;
  });
}

export function getSharedResponseAuthorDisplayName(
  response: SharedPostResponse,
  friendLabelById: ReadonlyMap<string, string>,
  fallback: string,
  currentUserUid?: string | null,
  selfLabel?: string
) {
  return getSharedAuthorDisplayName(
    response.authorUid,
    response.authorDisplayName,
    friendLabelById,
    fallback,
    currentUserUid,
    selfLabel
  );
}
