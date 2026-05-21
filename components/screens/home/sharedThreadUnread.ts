import type { SharedThreadReadState } from '../../../services/sharedFeedCache';
import type { SharedThreadSummary } from '../../../services/sharedFeedService';

export function isUnreadSharedThreadSummary(
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
