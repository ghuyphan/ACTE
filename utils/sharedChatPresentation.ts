import type {
  FriendConnection,
  SharedPost,
  SharedPostResponse,
  SharedThreadSummary,
} from '../services/sharedFeedService';
import type { SharedThreadReadState } from '../services/sharedFeedCache';

type Labels = {
  friendFallback: string;
  sharedNote: string;
  photoMemory: string;
  photoMemoryAtPlace: (place: string) => string;
  someone: string;
  you: string;
};

type FriendIdentityInput = {
  currentUserUid?: string | null;
  displayNameSnapshot?: string | null;
  friend?: Pick<
    FriendConnection,
    'displayNameSnapshot' | 'nickname' | 'photoURLSnapshot' | 'userId' | 'username'
  > | null;
  photoURLSnapshot?: string | null;
  userId?: string | null;
};

export type SharedChatIdentity = {
  avatarInitial: string;
  avatarUri: string | null;
  label: string;
  publicLabel: string | null;
};

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getSharedChatIdentity(
  input: FriendIdentityInput,
  labels: Pick<Labels, 'friendFallback' | 'someone' | 'you'>
): SharedChatIdentity {
  const isSelf = Boolean(
    input.currentUserUid && input.userId && input.currentUserUid === input.userId
  );
  const usernameLabel = input.friend?.username ? `@${input.friend.username}` : null;
  const publicLabel =
    usernameLabel ||
    trimToNull(input.friend?.displayNameSnapshot) ||
    trimToNull(input.displayNameSnapshot);
  const label = isSelf
    ? labels.you
    : trimToNull(input.friend?.nickname) ||
      publicLabel ||
      (input.friend ? labels.friendFallback : labels.someone);
  const initialSource = label.replace(/^@/, '').trim() || labels.friendFallback;

  return {
    avatarInitial: initialSource.charAt(0).toUpperCase(),
    avatarUri: input.friend?.photoURLSnapshot ?? trimToNull(input.photoURLSnapshot),
    label,
    publicLabel,
  };
}

export function getSharedChatMemoryPreview(
  post: SharedPost,
  labels: Pick<Labels, 'photoMemory' | 'photoMemoryAtPlace' | 'sharedNote'>
) {
  if (post.type === 'photo') {
    return post.placeName ? labels.photoMemoryAtPlace(post.placeName) : labels.photoMemory;
  }

  return trimToNull(post.text) || labels.sharedNote;
}

export function getSharedChatThreadIconName(post: SharedPost) {
  return post.type === 'photo' ? 'image-outline' : 'document-text-outline';
}

export function formatSharedResponseBody(response: Pick<SharedPostResponse, 'emoji' | 'text'>) {
  return [response.emoji, response.text].filter(Boolean).join(' ').trim();
}

export function getSharedThreadSummaryBody(summary: SharedThreadSummary) {
  return [summary.latestActivityEmoji, summary.latestActivityText].filter(Boolean).join(' ').trim();
}

export function isSharedThreadUnread(
  summary: SharedThreadSummary | null | undefined,
  readState: SharedThreadReadState | null | undefined,
  currentUserUid: string | null | undefined
) {
  if (!summary?.latestActivityAt || summary.latestActivityAuthorUid === currentUserUid) {
    return false;
  }

  const lastReadAt = readState?.lastReadAt ? new Date(readState.lastReadAt).getTime() : 0;
  return new Date(summary.latestActivityAt).getTime() > lastReadAt;
}

