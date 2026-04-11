import type { FeedFocusTarget } from '../hooks/state/useFeedFocus';
import { getNoteById } from './database';
import { getCachedSharedPostById } from './sharedFeedCache';

interface ResolveFeedTargetOptions {
  sharedCacheUserUid?: string | null;
}

export async function resolveFeedTarget(
  target: FeedFocusTarget,
  options?: ResolveFeedTargetOptions
): Promise<FeedFocusTarget | null> {
  try {
    if (target.kind === 'note') {
      const note = await getNoteById(target.id);
      return note ? target : null;
    }

    if (!options?.sharedCacheUserUid) {
      return null;
    }

    const post = await getCachedSharedPostById(options.sharedCacheUserUid, target.id);
    return post ? target : null;
  } catch (error) {
    console.warn('Failed to resolve external feed target:', error);
    return null;
  }
}
