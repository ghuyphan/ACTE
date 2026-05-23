import type { Note } from './database';
import { getDistanceMeters } from './reminderSelection';

export type MemoryPromptReason =
  | 'new_place'
  | 'repeat_place'
  | 'favorite_place'
  | 'photo'
  | 'time_of_day'
  | 'fallback';

export interface MemoryPromptSuggestion {
  id: string;
  text: string;
  reason: MemoryPromptReason;
}

export interface BuildMemoryPromptOptions {
  captureMode: 'text' | 'camera';
  now?: Date;
  notes: Note[];
  location?: {
    coords: {
      latitude: number;
      longitude: number;
    };
  } | null;
}

const NEARBY_PROMPT_RADIUS_METERS = 120;

function getHour(now: Date) {
  const hour = now.getHours();
  return Number.isFinite(hour) ? hour : 12;
}

function getNearbyNotes(notes: Note[], location: BuildMemoryPromptOptions['location']) {
  if (!location) {
    return [];
  }

  const current = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };

  return notes.filter((note) => (
    getDistanceMeters(current, {
      latitude: note.latitude,
      longitude: note.longitude,
    }) <= NEARBY_PROMPT_RADIUS_METERS
  ));
}

export function buildMemoryPromptSuggestion({
  captureMode,
  now = new Date(),
  notes,
  location = null,
}: BuildMemoryPromptOptions): MemoryPromptSuggestion {
  const nearbyNotes = getNearbyNotes(notes, location);
  const favoriteNearbyNote = nearbyNotes.find((note) => note.isFavorite);

  if (favoriteNearbyNote) {
    return {
      id: 'favorite-place',
      text: 'What makes this spot worth coming back to?',
      reason: 'favorite_place',
    };
  }

  if (nearbyNotes.length >= 2) {
    return {
      id: 'repeat-place',
      text: 'What changed since last time you were here?',
      reason: 'repeat_place',
    };
  }

  if (nearbyNotes.length === 0 && location) {
    return {
      id: 'new-place',
      text: 'What should future you remember about this spot?',
      reason: 'new_place',
    };
  }

  if (captureMode === 'camera') {
    return {
      id: 'photo-frame',
      text: "What's happening outside the frame?",
      reason: 'photo',
    };
  }

  const hour = getHour(now);
  if (hour >= 18 || hour < 5) {
    return {
      id: 'evening-check-in',
      text: 'What made today worth keeping?',
      reason: 'time_of_day',
    };
  }

  return {
    id: 'future-you',
    text: 'Leave a tiny clue for future you.',
    reason: 'fallback',
  };
}
