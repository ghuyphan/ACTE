import type { SharedPostResponse } from './sharedFeedService';

const MAX_REMEMBERED_RESPONSE_THREADS = 24;
const responseSnapshotByPostId = new Map<string, SharedPostResponse[]>();
const hydratedResponsePostIds = new Set<string>();

export function getRememberedSharedPostResponses(postId: string) {
  return responseSnapshotByPostId.get(postId) ?? [];
}

export function hasRememberedSharedPostResponses(postId: string) {
  return hydratedResponsePostIds.has(postId);
}

export function rememberSharedPostResponses(postId: string, responses: SharedPostResponse[]) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return;
  }

  responseSnapshotByPostId.delete(normalizedPostId);
  responseSnapshotByPostId.set(normalizedPostId, responses);
  hydratedResponsePostIds.add(normalizedPostId);

  while (responseSnapshotByPostId.size > MAX_REMEMBERED_RESPONSE_THREADS) {
    const oldestPostId = responseSnapshotByPostId.keys().next().value;
    if (!oldestPostId) {
      break;
    }
    responseSnapshotByPostId.delete(oldestPostId);
    hydratedResponsePostIds.delete(oldestPostId);
  }
}
