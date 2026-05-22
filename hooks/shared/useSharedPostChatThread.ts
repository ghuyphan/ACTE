import { useMemo } from 'react';
import type {
  SharedPostResponse,
  SharedPostResponseReaction,
} from '../../services/sharedFeedService';

export type ChatDeliveryStatus = 'sending' | 'failed' | 'offline';

export type ChatThreadResponse = SharedPostResponse & {
  deliveryStatus?: ChatDeliveryStatus;
  failureMessage?: string | null;
};

export type ChatResponseGroup = {
  type: 'group';
  id: string;
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  responses: ChatThreadResponse[];
  createdAt: string;
  showTimeLabel: boolean;
  timeLabel: string;
};

export type ChatDaySeparator = {
  type: 'day';
  id: string;
  label: string;
};

export type ChatListItem = ChatResponseGroup | ChatDaySeparator;

type Labels = {
  today: string;
  yesterday: string;
};

const RESPONSE_GROUP_WINDOW_MS = 5 * 60 * 1000;
const TIME_LABEL_GAP_MS = 15 * 60 * 1000;

function getResponseTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getReactionTime(reaction: SharedPostResponseReaction) {
  return getResponseTime(reaction.createdAt);
}

export function getResponseDeliveryStatus(response: SharedPostResponse): ChatDeliveryStatus | null {
  return (response as ChatThreadResponse).deliveryStatus ?? null;
}

export function isOptimisticResponse(response: SharedPostResponse) {
  return response.id.startsWith('local-shared-response-');
}

export function isOptimisticReaction(reaction: SharedPostResponseReaction) {
  return reaction.id.startsWith('local-shared-response-reaction-');
}

export function isReactionOnlyResponse(response: SharedPostResponse) {
  return Boolean(response.emoji && response.text.trim().length === 0);
}

export function formatMessageGroupTime(date: Date | string) {
  const timestamp = typeof date === 'string' ? new Date(date) : date;
  if (!Number.isFinite(timestamp.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function getDayKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'unknown';
  }

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDaySeparatorLabel(value: string, labels: Labels) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDelta = Math.round((startOfToday - startOfDate) / 86400000);
  if (dayDelta === 0) {
    return labels.today;
  }
  if (dayDelta === 1) {
    return labels.yesterday;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function groupChatResponses(
  responses: ChatThreadResponse[],
  labels: Labels
): ChatListItem[] {
  const groups: ChatListItem[] = [];
  let currentDayKey: string | null = null;
  let previousResponseDayKey: string | null = null;
  let previousResponseTime: number | null = null;

  for (const response of responses) {
    const responseDayKey = getDayKey(response.createdAt);
    const responseTime = getResponseTime(response.createdAt);
    const startsNewDay = responseDayKey !== currentDayKey;
    if (responseDayKey !== currentDayKey) {
      currentDayKey = responseDayKey;
      groups.push({
        type: 'day',
        id: `day:${responseDayKey}`,
        label: formatDaySeparatorLabel(response.createdAt, labels),
      });
    }

    const previousGroup = groups[groups.length - 1];
    const previousGroupTime = previousGroup?.type === 'group'
      ? getResponseTime(previousGroup.createdAt)
      : 0;
    const isCloseToPreviousGroup =
      previousGroupTime > 0 &&
      responseTime > 0 &&
      responseTime - previousGroupTime <= RESPONSE_GROUP_WINDOW_MS;
    if (
      previousGroup?.type === 'group' &&
      previousGroup.authorUid === response.authorUid &&
      isCloseToPreviousGroup
    ) {
      previousGroup.responses.push(response);
      previousGroup.createdAt = response.createdAt;
      previousGroup.timeLabel = formatMessageGroupTime(response.createdAt);
      previousGroup.id = `${previousGroup.responses[0]?.id ?? response.id}:${response.id}`;
      previousResponseDayKey = responseDayKey;
      previousResponseTime = responseTime;
      continue;
    }

    const shouldShowTimeLabel =
      !previousResponseTime ||
      startsNewDay ||
      previousResponseDayKey !== responseDayKey ||
      responseTime - previousResponseTime >= TIME_LABEL_GAP_MS;
    groups.push({
      type: 'group',
      id: response.id,
      authorUid: response.authorUid,
      authorDisplayName: response.authorDisplayName,
      authorPhotoURLSnapshot: response.authorPhotoURLSnapshot,
      responses: [response],
      createdAt: response.createdAt,
      showTimeLabel: shouldShowTimeLabel,
      timeLabel: formatMessageGroupTime(response.createdAt),
    });
    previousResponseDayKey = responseDayKey;
    previousResponseTime = responseTime;
  }

  return groups;
}

export function mergeResponseReactions(
  existingReactions: SharedPostResponseReaction[] = [],
  incomingReactions: SharedPostResponseReaction[] = []
) {
  const byAuthorUid = new Map<string, SharedPostResponseReaction>();

  for (const reaction of [...existingReactions, ...incomingReactions]) {
    const current = byAuthorUid.get(reaction.authorUid);
    if (!current) {
      byAuthorUid.set(reaction.authorUid, reaction);
      continue;
    }

    const reactionTime = getReactionTime(reaction);
    const currentTime = getReactionTime(current);
    const shouldReplace =
      (isOptimisticReaction(current) &&
        !isOptimisticReaction(reaction) &&
        (reaction.emoji === current.emoji || reactionTime >= currentTime)) ||
      reactionTime >= currentTime;
    if (shouldReplace) {
      byAuthorUid.set(reaction.authorUid, reaction);
    }
  }

  return Array.from(byAuthorUid.values()).sort(
    (left, right) => getReactionTime(left) - getReactionTime(right)
  );
}

export function removeResponseReaction(
  existingReactions: SharedPostResponseReaction[] = [],
  input: { id?: string | null; authorUid?: string | null }
) {
  const reactionId = input.id?.trim() || null;
  const authorUid = input.authorUid?.trim() || null;
  if (!reactionId && !authorUid) {
    return existingReactions;
  }

  return existingReactions.filter((reaction) => {
    if (reactionId && reaction.id === reactionId) {
      return false;
    }

    return !(authorUid && reaction.authorUid === authorUid);
  });
}

export function mergeChatResponses(
  remoteResponses: ChatThreadResponse[],
  pendingResponses: ChatThreadResponse[]
) {
  const byId = new Map<string, ChatThreadResponse>();
  for (const response of remoteResponses) {
    const existing = byId.get(response.id);
    byId.set(response.id, existing ? mergeChatResponse(existing, response) : response);
  }
  for (const response of pendingResponses) {
    const existing = byId.get(response.id);
    byId.set(response.id, existing ? mergeChatResponse(existing, response) : response);
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function mergeChatResponse(existing: ChatThreadResponse, incoming: ChatThreadResponse) {
  return {
    ...incoming,
    reactions: mergeResponseReactions(existing.reactions, incoming.reactions),
    deliveryStatus: incoming.deliveryStatus ?? existing.deliveryStatus,
    failureMessage: incoming.failureMessage ?? existing.failureMessage,
  };
}

export function areChatResponseListsEqual(
  left: ChatThreadResponse[],
  right: ChatThreadResponse[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftResponse, index) => {
    const rightResponse = right[index];
    const leftReactionSignature = (leftResponse.reactions ?? [])
      .map((reaction) => `${reaction.id}:${reaction.authorUid}:${reaction.emoji}:${reaction.createdAt}`)
      .join('|');
    const rightReactionSignature = (rightResponse?.reactions ?? [])
      .map((reaction) => `${reaction.id}:${reaction.authorUid}:${reaction.emoji}:${reaction.createdAt}`)
      .join('|');
    return (
      rightResponse &&
      leftResponse.id === rightResponse.id &&
      leftResponse.authorUid === rightResponse.authorUid &&
      leftResponse.emoji === rightResponse.emoji &&
      leftResponse.text === rightResponse.text &&
      leftResponse.replyToResponseId === rightResponse.replyToResponseId &&
      leftResponse.deliveryStatus === rightResponse.deliveryStatus &&
      leftResponse.failureMessage === rightResponse.failureMessage &&
      leftReactionSignature === rightReactionSignature &&
      leftResponse.createdAt === rightResponse.createdAt
    );
  });
}

export function useSharedPostChatThreadPresentation(
  responses: ChatThreadResponse[],
  labels: Labels
) {
  const responseGroups = useMemo(() => groupChatResponses(responses, labels), [labels, responses]);
  const responseById = useMemo(
    () => new Map(responses.map((response) => [response.id, response] as const)),
    [responses]
  );

  return { responseById, responseGroups };
}
