import { Note } from '../../services/database';
import { SharedPost } from '../../services/sharedFeedService';

export type HomeFeedItem =
  | { id: string; kind: 'note'; createdAt: string; note: Note }
  | { id: string; kind: 'shared-post'; createdAt: string; post: SharedPost };

export function buildHomeFeedItems(notes: Note[], sharedPosts: SharedPost[] = []): HomeFeedItem[] {
  return [
    ...notes.map((note) => ({
      id: note.id,
      kind: 'note' as const,
      note,
      createdAt: note.createdAt,
    })),
    ...sharedPosts.map((post) => ({
      id: post.id,
      kind: 'shared-post' as const,
      post,
      createdAt: post.createdAt,
    })),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function getHomeFeedItemKey(item: HomeFeedItem): string {
  return `${item.kind}:${item.id}`;
}

export function findHomeFeedItemIndex(
  items: HomeFeedItem[],
  target: Pick<HomeFeedItem, 'id' | 'kind'>
): number {
  return items.findIndex((item) => item.kind === target.kind && item.id === target.id);
}
