import { useEffect, useState } from 'react';
import { getPersistentItem, setPersistentItem } from '../../utils/appStorage';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';

const LIVE_PHOTO_CAMERA_HINT_SEEN_KEY = 'noto.capture.live-photo-hint-seen.v1';

type UseLivePhotoCameraHintOptions = {
  capturedPhoto: string | null;
  captureMode: string;
  isCameraPreviewActive: boolean;
  isModeSwitchAnimating: boolean;
  isQuotaExhausted: boolean;
};

export function useLivePhotoCameraHint({
  capturedPhoto,
  captureMode,
  isCameraPreviewActive,
  isModeSwitchAnimating,
  isQuotaExhausted,
}: UseLivePhotoCameraHintOptions) {
  const [hasSeenLivePhotoCameraHint, setHasSeenLivePhotoCameraHint] = useState<boolean | null>(null);
  const [showLivePhotoCameraHint, setShowLivePhotoCameraHint] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getPersistentItem(LIVE_PHOTO_CAMERA_HINT_SEEN_KEY).then((value) => {
      if (!cancelled) {
        setHasSeenLivePhotoCameraHint(Boolean(value));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const isCameraHintEligible =
      captureMode === 'camera' &&
      isCameraPreviewActive &&
      !isModeSwitchAnimating &&
      !capturedPhoto &&
      !isQuotaExhausted;

    if (hasSeenLivePhotoCameraHint !== false || !isCameraHintEligible) {
      if (showLivePhotoCameraHint) {
        setShowLivePhotoCameraHint(false);
      }
      return;
    }

    let cancelled = false;
    let revealTimeout: ReturnType<typeof setTimeout> | null = null;
    const idleHandle = scheduleOnIdle(() => {
      revealTimeout = setTimeout(() => {
        if (!cancelled) {
          setShowLivePhotoCameraHint(true);
        }
      }, 140);
    });

    return () => {
      cancelled = true;
      idleHandle.cancel();
      if (revealTimeout) {
        clearTimeout(revealTimeout);
      }
    };
  }, [
    capturedPhoto,
    captureMode,
    hasSeenLivePhotoCameraHint,
    isCameraPreviewActive,
    isModeSwitchAnimating,
    isQuotaExhausted,
    showLivePhotoCameraHint,
  ]);

  useEffect(() => {
    if (hasSeenLivePhotoCameraHint !== false || !capturedPhoto) {
      return;
    }

    setHasSeenLivePhotoCameraHint(true);
    void setPersistentItem(LIVE_PHOTO_CAMERA_HINT_SEEN_KEY, '1');
  }, [capturedPhoto, hasSeenLivePhotoCameraHint]);

  return showLivePhotoCameraHint;
}
