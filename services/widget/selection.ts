import type { Note } from '../database';
import { getNotePhotoUri } from '../photoStorage';
import { getDistanceMeters } from '../reminderSelection';
import type { SharedPost } from '../sharedFeedService';
import type { WidgetSelectionMode } from './contract';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface WidgetSelectionResult {
  selectedNote: WidgetCandidate | null;
  selectedCandidate: WidgetCandidate | null;
  selectedLocationName: string | null;
  nearbyPlacesCount: number;
  isIdleState: boolean;
  selectionMode: WidgetSelectionMode;
}

export interface WidgetCandidate {
  id: string;
  candidateKey: string;
  source: 'personal' | 'shared';
  noteType: 'text' | 'photo';
  text: string;
  photoPath: string | null;
  photoLocalUri: string | null;
  isLivePhoto: boolean;
  isDualCapture: boolean;
  dualPrimaryPhotoPath: string | null;
  dualSecondaryPhotoPath: string | null;
  dualPrimaryPhotoLocalUri: string | null;
  dualSecondaryPhotoLocalUri: string | null;
  dualLayoutPreset: 'top-left' | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  createdAt: string;
  updatedAt: string | null;
  hasDoodle: boolean;
  doodleStrokesJson: string | null;
  hasStickers: boolean;
  stickerPlacementsJson: string | null;
  moodEmoji?: string | null;
  noteColor?: string | null;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
}

function hasRenderableWidgetText(note: Pick<WidgetCandidate, 'noteType' | 'text'>) {
  return note.noteType === 'text' && typeof note.text === 'string' && note.text.trim().length > 0;
}

function hasRenderableWidgetVisuals(
  note: Pick<WidgetCandidate, 'hasDoodle' | 'doodleStrokesJson' | 'hasStickers' | 'stickerPlacementsJson'>
) {
  return Boolean(
    (note.hasDoodle && note.doodleStrokesJson) ||
      (note.hasStickers && note.stickerPlacementsJson)
  );
}

export function isTextWidgetNote(note: WidgetCandidate) {
  return note.noteType === 'text' && (hasRenderableWidgetText(note) || hasRenderableWidgetVisuals(note));
}

export function isPhotoWidgetNote(note: WidgetCandidate) {
  return note.noteType === 'photo';
}

function getWidgetCandidateTimestamp(note: Pick<WidgetCandidate, 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date(note.updatedAt ?? note.createdAt ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function compareCandidatesByNewest(left: WidgetCandidate, right: WidgetCandidate) {
  const timestampDelta = getWidgetCandidateTimestamp(right) - getWidgetCandidateTimestamp(left);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return left.candidateKey.localeCompare(right.candidateKey);
}

function hasWidgetCandidateCoordinates(candidate: WidgetCandidate): candidate is WidgetCandidate & {
  latitude: number;
  longitude: number;
} {
  return Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
}

function getPreferredWidgetCandidate(
  personalCandidates: WidgetCandidate[],
  sharedCandidates: WidgetCandidate[],
  preferredNoteId: string | null
) {
  if (!preferredNoteId) {
    return null;
  }

  return (
    personalCandidates.find((candidate) => candidate.id === preferredNoteId) ??
    sharedCandidates.find((candidate) => candidate.id === preferredNoteId) ??
    null
  );
}

export function getSelectionModeForCandidate(candidate: WidgetCandidate): WidgetSelectionMode {
  if (candidate.source === 'shared') {
    return 'shared_memory';
  }
  if (candidate.noteType === 'photo') {
    return 'photo_memory';
  }
  return 'latest_memory';
}

export function createTextFallbackWidgetCandidate(candidate: WidgetCandidate): WidgetCandidate | null {
  const fallbackText = candidate.text.trim();
  if (!fallbackText) {
    return null;
  }

  return {
    ...candidate,
    noteType: 'text',
    text: fallbackText,
    photoPath: null,
    photoLocalUri: null,
    isLivePhoto: false,
    isDualCapture: false,
    dualPrimaryPhotoPath: null,
    dualSecondaryPhotoPath: null,
    dualPrimaryPhotoLocalUri: null,
    dualSecondaryPhotoLocalUri: null,
    dualLayoutPreset: null,
  };
}

export function createPersonalWidgetCandidate(note: Note): WidgetCandidate {
  return {
    id: note.id,
    candidateKey: `personal:${note.id}`,
    source: 'personal',
    noteType: note.type,
    text: note.type === 'photo' ? note.caption ?? '' : note.content,
    photoPath: null,
    photoLocalUri: getNotePhotoUri(note),
    isLivePhoto: Boolean(note.type === 'photo' && note.isLivePhoto),
    isDualCapture: Boolean(note.type === 'photo' && note.captureVariant === 'dual'),
    dualPrimaryPhotoPath: null,
    dualSecondaryPhotoPath: null,
    dualPrimaryPhotoLocalUri:
      note.type === 'photo' && note.captureVariant === 'dual'
        ? note.dualPrimaryPhotoLocalUri ?? null
        : null,
    dualSecondaryPhotoLocalUri:
      note.type === 'photo' && note.captureVariant === 'dual'
        ? note.dualSecondaryPhotoLocalUri ?? null
        : null,
    dualLayoutPreset:
      note.type === 'photo' && note.captureVariant === 'dual'
        ? note.dualLayoutPreset ?? 'top-left'
        : null,
    locationName: note.locationName,
    latitude: note.latitude,
    longitude: note.longitude,
    radius: note.radius,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    hasDoodle: Boolean(note.hasDoodle && note.doodleStrokesJson),
    doodleStrokesJson: note.doodleStrokesJson ?? null,
    hasStickers: Boolean(note.hasStickers && note.stickerPlacementsJson),
    stickerPlacementsJson: note.stickerPlacementsJson ?? null,
    moodEmoji: note.moodEmoji ?? null,
    noteColor: note.noteColor ?? null,
    authorDisplayName: null,
    authorPhotoURLSnapshot: null,
  };
}

export function createSharedWidgetCandidate(post: SharedPost): WidgetCandidate {
  return {
    id: post.id,
    candidateKey: `shared:${post.id}`,
    source: 'shared',
    noteType: post.type,
    text: post.text,
    photoPath: post.photoPath ?? null,
    photoLocalUri: post.photoLocalUri,
    isLivePhoto: Boolean(post.type === 'photo' && post.isLivePhoto),
    isDualCapture: Boolean(post.type === 'photo' && post.captureVariant === 'dual'),
    dualPrimaryPhotoPath:
      post.type === 'photo' && post.captureVariant === 'dual'
        ? post.dualPrimaryPhotoPath ?? null
        : null,
    dualSecondaryPhotoPath:
      post.type === 'photo' && post.captureVariant === 'dual'
        ? post.dualSecondaryPhotoPath ?? null
        : null,
    dualPrimaryPhotoLocalUri:
      post.type === 'photo' && post.captureVariant === 'dual'
        ? post.dualPrimaryPhotoLocalUri ?? null
        : null,
    dualSecondaryPhotoLocalUri:
      post.type === 'photo' && post.captureVariant === 'dual'
        ? post.dualSecondaryPhotoLocalUri ?? null
        : null,
    dualLayoutPreset:
      post.type === 'photo' && post.captureVariant === 'dual'
        ? post.dualLayoutPreset ?? 'top-left'
        : null,
    locationName: post.placeName,
    latitude: null,
    longitude: null,
    radius: null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    hasDoodle: Boolean(post.doodleStrokesJson),
    doodleStrokesJson: post.doodleStrokesJson ?? null,
    hasStickers: Boolean(post.hasStickers && post.stickerPlacementsJson),
    stickerPlacementsJson: post.stickerPlacementsJson ?? null,
    noteColor: post.noteColor ?? null,
    authorDisplayName: post.authorDisplayName ?? null,
    authorPhotoURLSnapshot: post.authorPhotoURLSnapshot ?? null,
  };
}

function isWidgetCandidate(value: Note | WidgetCandidate | SharedPost): value is WidgetCandidate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'candidateKey' in value &&
    typeof (value as { candidateKey?: unknown }).candidateKey === 'string'
  );
}

function normalizePersonalCandidates(notes: Array<Note | WidgetCandidate>) {
  return notes.map((note) => (isWidgetCandidate(note) ? note : createPersonalWidgetCandidate(note)));
}

function normalizeSharedCandidates(sharedPosts: Array<SharedPost | WidgetCandidate>) {
  return sharedPosts.map((post) => (isWidgetCandidate(post) ? post : createSharedWidgetCandidate(post)));
}

function buildNearbyPersonalCandidates(
  personalCandidates: WidgetCandidate[],
  currentLocation: LocationCoords | null,
  nearbyRadiusMeters?: number
) {
  if (!currentLocation) {
    return [] as WidgetCandidate[];
  }

  return [...personalCandidates]
    .filter(hasWidgetCandidateCoordinates)
    .filter((candidate) => {
      const allowedDistance = Math.max(1, nearbyRadiusMeters ?? candidate.radius ?? 1);
      return (
        getDistanceMeters(currentLocation, {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        }) <= allowedDistance
      );
    })
    .sort((left, right) => {
      const timestampDelta = compareCandidatesByNewest(left, right);
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return (
        getDistanceMeters(currentLocation, {
          latitude: left.latitude,
          longitude: left.longitude,
        }) -
        getDistanceMeters(currentLocation, {
          latitude: right.latitude,
          longitude: right.longitude,
        })
      );
    });
}

function createWidgetSelectionResult(
  candidate: WidgetCandidate | null,
  selectionMode: WidgetSelectionMode,
  nearbyPlacesCount = 0
): WidgetSelectionResult {
  return {
    selectedNote: candidate,
    selectedCandidate: candidate,
    selectedLocationName: candidate?.locationName ?? null,
    nearbyPlacesCount,
    isIdleState: !candidate,
    selectionMode,
  };
}

export function buildOrderedWidgetSelections(options: {
  personalCandidates: WidgetCandidate[];
  sharedCandidates: WidgetCandidate[];
  currentLocation: LocationCoords | null;
  nearbyRadiusMeters?: number;
  preferredNoteId?: string | null;
}) {
  const {
    personalCandidates,
    sharedCandidates,
    currentLocation,
    nearbyRadiusMeters,
    preferredNoteId = null,
  } = options;

  const nearbyCandidates = buildNearbyPersonalCandidates(
    personalCandidates,
    currentLocation,
    nearbyRadiusMeters
  );
  const nearbyPlacesCount = Math.max(0, nearbyCandidates.length - 1);
  const orderedSelections: WidgetSelectionResult[] = [];
  const seenCandidateKeys = new Set<string>();
  const addCandidate = (
    candidate: WidgetCandidate | null,
    selectionMode: WidgetSelectionMode,
    nextNearbyPlacesCount = 0
  ) => {
    if (!candidate || seenCandidateKeys.has(candidate.candidateKey)) {
      return;
    }

    seenCandidateKeys.add(candidate.candidateKey);
    orderedSelections.push(createWidgetSelectionResult(candidate, selectionMode, nextNearbyPlacesCount));
  };

  const preferredCandidate = getPreferredWidgetCandidate(
    personalCandidates,
    sharedCandidates,
    preferredNoteId
  );
  const preferredPersonalCandidate =
    preferredCandidate?.source === 'personal' ? preferredCandidate : null;
  const preferredSharedCandidate =
    preferredCandidate?.source === 'shared' ? preferredCandidate : null;

  if (preferredPersonalCandidate) {
    const preferredIsNearby = nearbyCandidates.some(
      (candidate) => candidate.candidateKey === preferredPersonalCandidate.candidateKey
    );
    addCandidate(
      preferredPersonalCandidate,
      preferredIsNearby ? 'nearest_memory' : getSelectionModeForCandidate(preferredPersonalCandidate),
      preferredIsNearby ? nearbyPlacesCount : 0
    );
  }

  for (const candidate of nearbyCandidates) {
    addCandidate(candidate, 'nearest_memory', nearbyPlacesCount);
  }

  if (preferredSharedCandidate) {
    addCandidate(preferredSharedCandidate, 'shared_memory');
  }

  for (const candidate of [...personalCandidates].sort(compareCandidatesByNewest)) {
    addCandidate(candidate, getSelectionModeForCandidate(candidate));
  }

  for (const candidate of [...sharedCandidates].sort(compareCandidatesByNewest)) {
    addCandidate(candidate, 'shared_memory');
  }

  if (orderedSelections.length === 0) {
    orderedSelections.push(createWidgetSelectionResult(null, 'latest_memory'));
  }

  return orderedSelections;
}

export function selectWidgetNote(options: {
  notes: Array<Note | WidgetCandidate>;
  sharedPosts?: Array<SharedPost | WidgetCandidate>;
  currentLocation?: LocationCoords | null;
  nearbyRadiusMeters?: number;
  preferredNoteId?: string | null;
}): WidgetSelectionResult {
  const {
    notes,
    sharedPosts = [],
    currentLocation = null,
    nearbyRadiusMeters,
    preferredNoteId = null,
  } = options;

  const personalCandidates = normalizePersonalCandidates(notes).filter(
    (note) => isPhotoWidgetNote(note) || isTextWidgetNote(note)
  );
  const sharedCandidates = normalizeSharedCandidates(sharedPosts).filter(
    (note) => isPhotoWidgetNote(note) || isTextWidgetNote(note)
  );

  return (
    buildOrderedWidgetSelections({
      personalCandidates,
      sharedCandidates,
      currentLocation,
      nearbyRadiusMeters,
      preferredNoteId,
    })[0] ?? createWidgetSelectionResult(null, 'latest_memory')
  );
}
