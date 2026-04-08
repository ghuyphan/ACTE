import { useSyncExternalStore } from 'react';

type AndroidTabSearchSnapshot = {
  query: string;
  focusRequestId: number;
};

let snapshot: AndroidTabSearchSnapshot = {
  query: '',
  focusRequestId: 0,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

export function setAndroidTabSearchQuery(query: string) {
  if (snapshot.query === query) {
    return;
  }

  snapshot = {
    ...snapshot,
    query,
  };
  emitChange();
}

export function requestAndroidTabSearchFocus() {
  snapshot = {
    ...snapshot,
    focusRequestId: snapshot.focusRequestId + 1,
  };
  emitChange();
}

export function clearAndroidTabSearch() {
  snapshot = {
    query: '',
    focusRequestId: snapshot.focusRequestId + 1,
  };
  emitChange();
}

export function useAndroidTabSearchState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
