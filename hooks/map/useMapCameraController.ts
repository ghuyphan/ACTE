import { useCallback, useRef, useState, type RefObject } from 'react';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

const PROGRAMMATIC_REGION_TOLERANCE = 0.0005;
const PREVIEW_FOCUS_REGION_GUARD_MS = 900;

type MapRegionChangeDetails = {
  isGesture?: boolean;
};

interface UseMapCameraControllerParams {
  mapRef: RefObject<MapView | null>;
  setVisibleRegion: (region: Region) => void;
  setProgrammaticVisibleRegion: (region: Region) => void;
}

function areRegionsClose(left: Region | null, right: Region) {
  if (!left) {
    return false;
  }

  return (
    Math.abs(left.latitude - right.latitude) < PROGRAMMATIC_REGION_TOLERANCE &&
    Math.abs(left.longitude - right.longitude) < PROGRAMMATIC_REGION_TOLERANCE &&
    Math.abs(left.latitudeDelta - right.latitudeDelta) < PROGRAMMATIC_REGION_TOLERANCE &&
    Math.abs(left.longitudeDelta - right.longitudeDelta) < PROGRAMMATIC_REGION_TOLERANCE
  );
}

export function useMapCameraController({
  mapRef,
  setVisibleRegion,
  setProgrammaticVisibleRegion,
}: UseMapCameraControllerParams) {
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const pendingProgrammaticRegionRef = useRef<Region | null>(null);
  const nearbyPreviewFocusGuardUntilRef = useRef(0);

  const clearPreviewFocusGuard = useCallback(() => {
    nearbyPreviewFocusGuardUntilRef.current = 0;
  }, []);

  const updateProgrammaticRegion = useCallback(
    (region: Region, options?: { freezeNearbyPreviewSession?: boolean }) => {
      pendingProgrammaticRegionRef.current = region;
      if (options?.freezeNearbyPreviewSession) {
        nearbyPreviewFocusGuardUntilRef.current = Date.now() + PREVIEW_FOCUS_REGION_GUARD_MS;
      }
      setProgrammaticVisibleRegion(region);
    },
    [setProgrammaticVisibleRegion]
  );

  const animateToRegion = useCallback(
    (region: Region, duration: number, options?: { freezeNearbyPreviewSession?: boolean }) => {
      updateProgrammaticRegion(region, options);
      mapRef.current?.animateToRegion(region, duration);
    },
    [mapRef, updateProgrammaticRegion]
  );

  const handleRegionChangeComplete = useCallback(
    (region: Region, details?: MapRegionChangeDetails) => {
      setSettledRegion(region);
      const isGoogleMapsGesture = details?.isGesture;
      const isInsidePreviewFocusGuard = Date.now() <= nearbyPreviewFocusGuardUntilRef.current;
      const matchesPendingProgrammaticRegion = areRegionsClose(pendingProgrammaticRegionRef.current, region);

      if (isGoogleMapsGesture === false || matchesPendingProgrammaticRegion || isInsidePreviewFocusGuard) {
        pendingProgrammaticRegionRef.current = null;
        setProgrammaticVisibleRegion(region);
        return;
      }

      nearbyPreviewFocusGuardUntilRef.current = 0;
      pendingProgrammaticRegionRef.current = null;
      setVisibleRegion(region);
    },
    [setProgrammaticVisibleRegion, setVisibleRegion]
  );

  return {
    animateToRegion,
    clearPreviewFocusGuard,
    handleRegionChangeComplete,
    settledRegion,
  };
}
