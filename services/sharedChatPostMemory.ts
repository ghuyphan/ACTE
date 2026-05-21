import type { SharedPost } from './sharedFeedService';

const MAX_REMEMBERED_CHAT_POSTS = 80;
const chatPostById = new Map<string, SharedPost>();

export function getRememberedSharedChatThreadPost(postId: string) {
  return chatPostById.get(postId.trim()) ?? null;
}

export function rememberSharedChatThreadPost(post: SharedPost | null | undefined) {
  const postId = post?.id.trim();
  if (!postId || !post) {
    return;
  }

  chatPostById.delete(postId);
  chatPostById.set(postId, post);

  while (chatPostById.size > MAX_REMEMBERED_CHAT_POSTS) {
    const oldestPostId = chatPostById.keys().next().value;
    if (!oldestPostId) {
      break;
    }
    chatPostById.delete(oldestPostId);
  }
}

export function rememberSharedChatThreadPosts(posts: SharedPost[]) {
  for (const post of posts) {
    rememberSharedChatThreadPost(post);
  }
}
