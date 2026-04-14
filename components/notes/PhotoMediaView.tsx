import { Image } from 'expo-image';
import * as Haptics from '../../hooks/useHaptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  type ImageStyle,
  type GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import LivePhotoIcon from '../ui/LivePhotoIcon';

type PhotoMediaViewProps = {
  imageUrl: string;
  isLivePhoto?: boolean;
  pairedVideoUri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  showLiveBadge?: boolean;
  enablePlayback?: boolean;
  autoPreviewOnceOnEnable?: boolean;
  badgeStyle?: StyleProp<ViewStyle>;
  onImageReady?: () => void;
};

type ExpoVideoPlayerSubscription = {
  remove: () => void;
};

type ExpoVideoPlayer = {
  loop: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  play: () => void;
  pause: () => void;
  addListener?: (eventName: 'playToEnd', listener: () => void) => ExpoVideoPlayerSubscription;
};

type ExpoVideoModule = {
  VideoView: React.ComponentType<Record<string, unknown>>;
  useVideoPlayer: (
    source: { uri: string },
    setup?: (player: ExpoVideoPlayer) => void
  ) => ExpoVideoPlayer;
};

const LIVE_PHOTO_PREVIEW_HOLD_MS = 170;
const LIVE_PHOTO_AUTO_PREVIEW_DELAY_MS = 420;

function hasExpoVideoNativeModule() {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  const expoModules = (globalThis as {
    expo?: {
      modules?: {
        ExpoVideo?: unknown;
        NativeModulesProxy?: Record<string, unknown>;
      };
    };
  }).expo?.modules;

  if (!expoModules) {
    return false;
  }

  return Boolean(expoModules.ExpoVideo || expoModules.NativeModulesProxy?.ExpoVideo);
}

function getExpoVideoModule(): ExpoVideoModule | null {
  if (!hasExpoVideoNativeModule()) {
    return null;
  }
  return { VideoView, useVideoPlayer };
}

function LivePhotoBadge({ badgeStyle }: Pick<PhotoMediaViewProps, 'badgeStyle'>) {
  return (
    <View style={[styles.liveBadge, badgeStyle]}>
      <LivePhotoIcon size={18} color="#FFFFFF" />
    </View>
  );
}

function StaticPhotoView({
  imageUrl,
  isLivePhoto = false,
  style,
  imageStyle,
  showLiveBadge = true,
  badgeStyle,
  onImageReady,
}: Pick<
  PhotoMediaViewProps,
  'imageUrl' | 'isLivePhoto' | 'style' | 'imageStyle' | 'showLiveBadge' | 'badgeStyle' | 'onImageReady'
>) {
  return (
    <View style={style}>
      <Image
        source={{ uri: imageUrl }}
        style={imageStyle}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
        onLoad={onImageReady}
        onError={onImageReady}
      />
      {isLivePhoto && showLiveBadge ? <LivePhotoBadge badgeStyle={badgeStyle} /> : null}
    </View>
  );
}

function VideoLivePhotoPreview({
  imageUrl,
  pairedVideoUri,
  style,
  imageStyle,
  showLiveBadge,
  enablePlayback,
  autoPreviewOnceOnEnable,
  badgeStyle,
  onImageReady,
  t,
  expoVideo,
}: Required<
  Pick<
    PhotoMediaViewProps,
    'imageUrl' | 'showLiveBadge' | 'enablePlayback' | 'autoPreviewOnceOnEnable'
  >
> &
  Pick<PhotoMediaViewProps, 'style' | 'imageStyle' | 'badgeStyle' | 'onImageReady'> & {
    pairedVideoUri: string;
    t: ReturnType<typeof useTranslation>['t'];
    expoVideo: ExpoVideoModule;
  }) {
  const { VideoView, useVideoPlayer } = expoVideo;
  const reduceMotionEnabled = useReducedMotion();
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false);
  const player = useVideoPlayer({ uri: pairedVideoUri }, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.muted = true;
    nextPlayer.volume = 0;
  });
  const activePlayerRef = useRef<ExpoVideoPlayer | null>(player);
  const previewModeRef = useRef<'auto' | 'manual' | null>(null);
  const previewHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoPreviewedRef = useRef(false);

  const clearPreviewHold = useCallback(() => {
    if (previewHoldTimeoutRef.current) {
      clearTimeout(previewHoldTimeoutRef.current);
      previewHoldTimeoutRef.current = null;
    }
  }, []);

  const clearAutoPreview = useCallback(() => {
    if (autoPreviewTimeoutRef.current) {
      clearTimeout(autoPreviewTimeoutRef.current);
      autoPreviewTimeoutRef.current = null;
    }
  }, []);

  const stopPlayer = useCallback(() => {
    const activePlayer = activePlayerRef.current;
    if (activePlayer === player && previewModeRef.current) {
      activePlayer.pause();
      activePlayer.currentTime = 0;
    }
  }, [player]);

  useEffect(() => {
    activePlayerRef.current = player;

    return () => {
      if (activePlayerRef.current === player) {
        activePlayerRef.current = null;
      }
    };
  }, [player]);

  useEffect(() => {
    clearPreviewHold();
    clearAutoPreview();
    stopPlayer();
    previewModeRef.current = null;
    setHasRenderedFirstFrame(false);
    setIsPreviewing(false);
    hasAutoPreviewedRef.current = false;
  }, [clearAutoPreview, clearPreviewHold, pairedVideoUri, stopPlayer]);

  useEffect(() => clearPreviewHold, [clearPreviewHold]);
  useEffect(() => clearAutoPreview, [clearAutoPreview]);

  useEffect(() => {
    const activePlayer = activePlayerRef.current;
    if (activePlayer !== player || !isPreviewing) {
      return;
    }

    activePlayer.currentTime = 0;
    activePlayer.play();
    if (previewModeRef.current === 'manual') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isPreviewing, player]);

  const stopPreview = useCallback(() => {
    clearPreviewHold();
    clearAutoPreview();
    stopPlayer();
    previewModeRef.current = null;
    setIsPreviewing(false);
  }, [clearAutoPreview, clearPreviewHold, stopPlayer]);

  const startPreview = useCallback((mode: 'auto' | 'manual') => {
    if (!enablePlayback) {
      return;
    }

    previewModeRef.current = mode;
    setIsPreviewing(true);
  }, [enablePlayback]);

  const handlePressIn = useCallback((_event: GestureResponderEvent) => {
    if (!enablePlayback) {
      return;
    }

    stopPreview();

    previewHoldTimeoutRef.current = setTimeout(() => {
      previewHoldTimeoutRef.current = null;
      startPreview('manual');
    }, LIVE_PHOTO_PREVIEW_HOLD_MS);
  }, [enablePlayback, startPreview, stopPreview]);

  useEffect(() => {
    if (
      !enablePlayback ||
      !autoPreviewOnceOnEnable ||
      reduceMotionEnabled ||
      hasAutoPreviewedRef.current
    ) {
      return;
    }

    autoPreviewTimeoutRef.current = setTimeout(() => {
      autoPreviewTimeoutRef.current = null;
      if (!previewModeRef.current && !hasAutoPreviewedRef.current) {
        hasAutoPreviewedRef.current = true;
        startPreview('auto');
      }
    }, LIVE_PHOTO_AUTO_PREVIEW_DELAY_MS);

    return clearAutoPreview;
  }, [
    autoPreviewOnceOnEnable,
    clearAutoPreview,
    enablePlayback,
    reduceMotionEnabled,
    startPreview,
  ]);

  useEffect(() => {
    const activePlayer = activePlayerRef.current;
    if (activePlayer !== player || !activePlayer.addListener) {
      return;
    }

    const subscription = activePlayer.addListener('playToEnd', () => {
      stopPreview();
    });

    return () => {
      subscription.remove();
    };
  }, [player, stopPreview]);

  const shouldShowVideo = isPreviewing && hasRenderedFirstFrame;

  return (
    <View style={style}>
      <VideoView
        // Keep the native player attached for the life of the view. Toggling
        // the `player` prop on Android can trip an expo-video detach race.
        player={player}
        style={[
          StyleSheet.absoluteFill,
          imageStyle,
          shouldShowVideo ? styles.previewVisible : styles.previewHidden,
        ]}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
        useExoShutter={false}
        onFirstFrameRender={() => {
          setHasRenderedFirstFrame(true);
        }}
      />
      <Image
        source={{ uri: imageUrl }}
        style={[
          StyleSheet.absoluteFill,
          imageStyle,
          shouldShowVideo ? styles.previewHidden : styles.previewVisible,
        ]}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
        onLoad={onImageReady}
        onError={onImageReady}
      />
      <Pressable
        accessibilityLabel={t('common.previewLivePhotoMotion', 'Preview live photo motion')}
        onPressIn={handlePressIn}
        onPressOut={stopPreview}
        onResponderTerminate={stopPreview}
        onTouchCancel={stopPreview}
        style={StyleSheet.absoluteFill}
      >
        {showLiveBadge ? <LivePhotoBadge badgeStyle={badgeStyle} /> : null}
      </Pressable>
    </View>
  );
}

export default function PhotoMediaView({
  imageUrl,
  isLivePhoto = false,
  pairedVideoUri = null,
  style,
  imageStyle,
  showLiveBadge = true,
  enablePlayback = true,
  autoPreviewOnceOnEnable = false,
  badgeStyle,
  onImageReady,
}: PhotoMediaViewProps) {
  const { t } = useTranslation();

  if (!isLivePhoto || !pairedVideoUri) {
    return (
      <StaticPhotoView
        imageUrl={imageUrl}
        isLivePhoto={isLivePhoto}
        style={style}
        imageStyle={imageStyle}
        showLiveBadge={showLiveBadge}
        badgeStyle={badgeStyle}
        onImageReady={onImageReady}
      />
    );
  }

  const expoVideo = getExpoVideoModule();
  if (!expoVideo) {
    return (
      <StaticPhotoView
        imageUrl={imageUrl}
        isLivePhoto
        style={style}
        imageStyle={imageStyle}
        showLiveBadge={showLiveBadge}
        badgeStyle={badgeStyle}
        onImageReady={onImageReady}
      />
    );
  }

  return (
    <VideoLivePhotoPreview
      imageUrl={imageUrl}
      pairedVideoUri={pairedVideoUri}
      style={style}
      imageStyle={imageStyle}
      showLiveBadge={showLiveBadge}
      enablePlayback={enablePlayback}
      autoPreviewOnceOnEnable={autoPreviewOnceOnEnable}
      badgeStyle={badgeStyle}
      onImageReady={onImageReady}
      t={t}
      expoVideo={expoVideo}
    />
  );
}

const styles = StyleSheet.create({
  previewVisible: {
    opacity: 1,
  },
  previewHidden: {
    opacity: 0,
  },
  liveBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 12, 14, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
