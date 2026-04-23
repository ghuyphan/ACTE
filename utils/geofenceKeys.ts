export function getGeofenceCooldownKey(scope: 'note' | 'location', id: string) {
  return `geofence.cooldown.${scope}.${id}`;
}

export function getLocationCooldownId(locationName: string | null, latitude?: number, longitude?: number) {
  const normalizedLocationName = locationName?.trim().toLowerCase() ?? '';
  if (normalizedLocationName && typeof latitude === 'number' && typeof longitude === 'number') {
    return `${normalizedLocationName}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  }

  if (normalizedLocationName) {
    return normalizedLocationName;
  }

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  }

  return 'unknown-location';
}

export function getSkipNextEnterKey(noteId: string) {
  return `geofence.skip_next_enter.${noteId}`;
}

export function getSkipNextEnterPlaceKey(placeKey: string) {
  return `geofence.skip_next_enter_place.${placeKey}`;
}
