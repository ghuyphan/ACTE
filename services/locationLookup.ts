import * as Location from 'expo-location';

const REVERSE_GEOCODE_TIMEOUT_MS = 1500;
const LOCATION_CACHE_PRECISION = 4;

const reverseGeocodeCache = new Map<string, string | null>();

function getReverseGeocodeCacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(LOCATION_CACHE_PRECISION)},${longitude.toFixed(LOCATION_CACHE_PRECISION)}`;
}

function formatLocationName(placemark: Location.LocationGeocodedAddress | null | undefined) {
  if (!placemark) {
    return null;
  }

  const parts = [placemark.name, placemark.street, placemark.city]
    .map((part) => part?.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

export async function resolveLocationNameFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const cacheKey = getReverseGeocodeCacheKey(latitude, longitude);
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey) ?? null;
  }

  const timeoutToken = Symbol('reverse-geocode-timeout');

  try {
    const results = await Promise.race<
      Location.LocationGeocodedAddress[] | typeof timeoutToken
    >([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<typeof timeoutToken>((resolve) => {
        setTimeout(() => resolve(timeoutToken), REVERSE_GEOCODE_TIMEOUT_MS);
      }),
    ]);

    if (results === timeoutToken) {
      return null;
    }

    const formattedName = formatLocationName(results[0]);
    reverseGeocodeCache.set(cacheKey, formattedName);
    return formattedName;
  } catch {
    return null;
  }
}
