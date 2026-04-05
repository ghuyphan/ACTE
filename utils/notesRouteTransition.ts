export interface NotesRouteTransitionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PendingNotesRouteTransition {
  origin: NotesRouteTransitionRect;
  createdAt: number;
}

const NOTES_ROUTE_TRANSITION_MAX_AGE_MS = 1600;

let pendingNotesRouteTransition: PendingNotesRouteTransition | null = null;

export function setPendingNotesRouteTransition(origin: NotesRouteTransitionRect) {
  pendingNotesRouteTransition = {
    origin,
    createdAt: Date.now(),
  };
}

export function consumePendingNotesRouteTransition(): NotesRouteTransitionRect | null {
  if (!pendingNotesRouteTransition) {
    return null;
  }

  const nextTransition = pendingNotesRouteTransition;
  pendingNotesRouteTransition = null;

  if (Date.now() - nextTransition.createdAt > NOTES_ROUTE_TRANSITION_MAX_AGE_MS) {
    return null;
  }

  return nextTransition.origin;
}
