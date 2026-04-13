export type FeedTarget =
  | { kind: 'note'; id: string }
  | { kind: 'shared-post'; id: string };

export function areFeedTargetsEqual(
  left: FeedTarget | null | undefined,
  right: FeedTarget | null | undefined
) {
  return left?.kind === right?.kind && left?.id === right?.id;
}
