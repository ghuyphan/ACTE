import { useMemo } from 'react';
import type { Note } from '../../../services/database';
import { getDistanceMeters, getReminderPlaceGroups } from '../../../services/reminderSelection';
import type { SharedPost } from '../../../services/sharedFeedService';
import type { SharedPlacePulseAvatar } from '../../home/SharedPlacePulseStrip';

const PLACE_PULSE_RADIUS_METERS = 500;
const SHARED_PLACE_PULSE_MAX_AVATARS = 3;
const SHARED_PLACE_PULSE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_SHARED_PLACE_PULSE_AVATARS: SharedPlacePulseAvatar[] = [];

type CurrentLocation = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type UseHomePlacePulseOptions = {
  captureTarget: 'private' | 'shared';
  location: CurrentLocation | null;
  notes: Note[];
  sharedEnabled: boolean;
  sharedPosts: SharedPost[];
  sharedReady: boolean;
  userUid: string | null | undefined;
};

function hasFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getSharedPlacePulseFallbackLabel(post: SharedPost) {
  const trimmedName = post.authorDisplayName?.trim();
  if (trimmedName) {
    return (trimmedName[0] ?? '?').toUpperCase();
  }

  return '?';
}

export function useHomePlacePulse({
  captureTarget,
  location,
  notes,
  sharedEnabled,
  sharedPosts,
  sharedReady,
  userUid,
}: UseHomePlacePulseOptions) {
  const placePulseSummary = useMemo(() => {
    if (!location) {
      return {
        nearbyNoteCount: 0,
        targetNoteId: null as string | null,
      };
    }

    const nearbyGroups = getReminderPlaceGroups(notes)
      .map((group) => ({
        group,
        distanceMeters: getDistanceMeters(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: group.latitude,
            longitude: group.longitude,
          }
        ),
      }))
      .filter((entry) => entry.distanceMeters <= PLACE_PULSE_RADIUS_METERS)
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    const highlightedPlace = nearbyGroups[0]?.group ?? null;
    const latestNearbyNote = highlightedPlace
      ? [...highlightedPlace.notes].sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        )[0] ?? null
      : null;

    return {
      nearbyNoteCount: nearbyGroups.reduce((sum, entry) => sum + entry.group.notes.length, 0),
      targetNoteId: latestNearbyNote?.id ?? null,
    };
  }, [location, notes]);

  const sharedPlacePulseSummary = useMemo(() => {
    if (captureTarget !== 'private' || !location || !sharedEnabled || !sharedReady) {
      return {
        nearbySharedPostCount: 0,
        targetPostId: null as string | null,
        avatars: EMPTY_SHARED_PLACE_PULSE_AVATARS,
        overflowCount: 0,
      };
    }

    const currentCoordinates = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    const minimumCreatedAt = Date.now() - SHARED_PLACE_PULSE_MAX_AGE_MS;

    const nearbySharedPosts = sharedPosts
      .filter((post) => {
        if (userUid && post.authorUid === userUid) {
          return false;
        }

        if (!hasFiniteCoordinate(post.latitude) || !hasFiniteCoordinate(post.longitude)) {
          return false;
        }

        const createdAtMs = new Date(post.createdAt).getTime();
        if (!Number.isFinite(createdAtMs) || createdAtMs < minimumCreatedAt) {
          return false;
        }

        return (
          getDistanceMeters(currentCoordinates, {
            latitude: post.latitude,
            longitude: post.longitude,
          }) <= PLACE_PULSE_RADIUS_METERS
        );
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );

    const uniqueNearbyAuthorIds = new Set<string>();
    for (const post of nearbySharedPosts) {
      uniqueNearbyAuthorIds.add(post.authorUid.trim() || post.id);
    }

    const avatars: SharedPlacePulseAvatar[] = [];
    const renderedAuthorIds = new Set<string>();

    for (const post of nearbySharedPosts) {
      const authorKey = post.authorUid.trim() || post.id;
      if (renderedAuthorIds.has(authorKey)) {
        continue;
      }

      renderedAuthorIds.add(authorKey);
      avatars.push({
        id: authorKey,
        photoUrl: post.authorPhotoURLSnapshot,
        fallbackLabel: getSharedPlacePulseFallbackLabel(post),
      });

      if (avatars.length >= SHARED_PLACE_PULSE_MAX_AVATARS) {
        break;
      }
    }

    return {
      nearbySharedPostCount: nearbySharedPosts.length,
      targetPostId: nearbySharedPosts[0]?.id ?? null,
      avatars,
      overflowCount: Math.max(uniqueNearbyAuthorIds.size - avatars.length, 0),
    };
  }, [captureTarget, location, sharedEnabled, sharedPosts, sharedReady, userUid]);

  return {
    placePulseSummary,
    sharedPlacePulseSummary,
  };
}
