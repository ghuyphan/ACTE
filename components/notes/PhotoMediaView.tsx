import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  badgeStyle?: StyleProp<ViewStyle>;
  onImageReady?: () => void;
};

type ExpoVideoPlayer = {
  loop: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  play: () => void;
  pause: () => void;
};

type ExpoVideoModule = {
  VideoView: React.ComponentType<Record<string, unknown>>;
  useVideoPlayer: (
    source: { uri: string },
    setup?: (player: ExpoVideoPlayer) => void
  ) => ExpoVideoPlayer;
};

const LIVE_PHOTO_PREVIEW_HOLD_MS = 170;

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

function NativeLivePhotoPreview({
  imageUrl,
  pairedVideoUri,
  style,
  imageStyle,
  showLiveBadge = true,
  enablePlayback = true,
  badgeStyle,
  onImageReady,
}: Required<Pick<PhotoMediaViewProps, 'imageUrl' | 'showLiveBadge' | 'enablePlayback'>> &
  Pick<PhotoMediaViewProps, 'style' | 'imageStyle' | 'badgeStyle' | 'onImageReady'> & {
    pairedVideoUri: string;
  }) {
  const { t } = useTranslation();
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
      badgeStyle={badgeStyle}
      onImageReady={onImageReady}
      t={t}
      expoVideo={expoVideo}
    />
  );
}

function VideoLivePhotoPreview({
  imageUrl,
  pairedVideoUri,
  style,
  imageStyle,
  showLiveBadge,
  enablePlayback,
  badgeStyle,
  onImageReady,
  t,
  expoVideo,
}: Required<Pick<PhotoMediaViewProps, 'imageUrl' | 'showLiveBadge' | 'enablePlayback'>> &
  Pick<PhotoMediaViewProps, 'style' | 'imageStyle' | 'badgeStyle' | 'onImageReady'> & {
    pairedVideoUri: string;
    t: ReturnType<typeof useTranslation>['t'];
    expoVideo: ExpoVideoModule;
  }) {
  const { VideoView, useVideoPlayer } = expoVideo;
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false);
  const player = useVideoPlayer({ uri: pairedVideoUri }, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.muted = true;
    nextPlayer.volume = 0;
  });
  const activePlayerRef = useRef<ExpoVideoPlayer | null>(player);
  const previewActiveRef = useRef(false);
  const previewHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPreviewHold = useCallback(() => {
    if (previewHoldTimeoutRef.current) {
      clearTimeout(previewHoldTimeoutRef.current);
      previewHoldTimeoutRef.current = null;
    }
  }, []);

  const stopPlayer = useCallback(() => {
    const activePlayer = activePlayerRef.current;
    if (activePlayer === player && previewActiveRef.current) {
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
    stopPlayer();
    previewActiveRef.current = false;
    setHasRenderedFirstFrame(false);
    setIsPreviewing(false);
  }, [clearPreviewHold, pairedVideoUri, stopPlayer]);

  useEffect(() => clearPreviewHold, [clearPreviewHold]);

  useEffect(() => {
    const activePlayer = activePlayerRef.current;
    if (activePlayer !== player) {
      return;
    }

    if (!isPreviewing) {
      return;
    }

    activePlayer.currentTime = 0;
    activePlayer.play();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isPreviewing, player]);

  const stopPreview = useCallback(() => {
    clearPreviewHold();
    stopPlayer();
    previewActiveRef.current = false;
    setIsPreviewing(false);
  }, [clearPreviewHold, stopPlayer]);

  const startPreview = useCallback(() => {
    if (!enablePlayback) {
      return;
    }

    previewActiveRef.current = true;
    setIsPreviewing(true);
  }, [enablePlayback]);

  const handlePressIn = useCallback((_event: GestureResponderEvent) => {
    if (!enablePlayback) {
      return;
    }

    // Recover if a prior touch sequence never delivered a clean press-out.
    stopPreview();

    previewHoldTimeoutRef.current = setTimeout(() => {
      previewHoldTimeoutRef.current = null;
      startPreview();
    }, LIVE_PHOTO_PREVIEW_HOLD_MS);
  }, [enablePlayback, startPreview, stopPreview]);

  const shouldShowVideo = isPreviewing && hasRenderedFirstFrame;

  return (
    <View style={style}>
      <VideoView
        player={isPreviewing ? player : null}
        style={[
          StyleSheet.absoluteFill,
          imageStyle,
          isPreviewing ? styles.previewVisible : styles.previewHidden,
        ]}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
        surfaceType="textureView"
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
  badgeStyle,
  onImageReady,
}: PhotoMediaViewProps) {
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

  return (
    <NativeLivePhotoPreview
      imageUrl={imageUrl}
      pairedVideoUri={pairedVideoUri}
      style={style}
      imageStyle={imageStyle}
      showLiveBadge={showLiveBadge}
      enablePlayback={enablePlayback}
      badgeStyle={badgeStyle}
      onImageReady={onImageReady}
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
