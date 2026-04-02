import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  type ImageStyle,
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

let cachedExpoVideoModule: ExpoVideoModule | null | undefined;

function hasExpoVideoNativeModule() {
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
  if (cachedExpoVideoModule !== undefined) {
    return cachedExpoVideoModule;
  }

  if (!hasExpoVideoNativeModule()) {
    cachedExpoVideoModule = null;
    return cachedExpoVideoModule;
  }

  try {
    cachedExpoVideoModule = require('expo-video') as ExpoVideoModule;
  } catch {
    cachedExpoVideoModule = null;
  }

  return cachedExpoVideoModule;
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
}: Pick<
  PhotoMediaViewProps,
  'imageUrl' | 'isLivePhoto' | 'style' | 'imageStyle' | 'showLiveBadge' | 'badgeStyle'
>) {
  return (
    <View style={style}>
      <Image
        source={{ uri: imageUrl }}
        style={imageStyle}
        contentFit="cover"
        transition={200}
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
}: Required<Pick<PhotoMediaViewProps, 'imageUrl' | 'showLiveBadge' | 'enablePlayback'>> &
  Pick<PhotoMediaViewProps, 'style' | 'imageStyle' | 'badgeStyle'> & {
    pairedVideoUri: string;
  }) {
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
      />
    );
  }

  const { VideoView, useVideoPlayer } = expoVideo;
  const [isPreviewing, setIsPreviewing] = useState(false);
  const player = useVideoPlayer({ uri: pairedVideoUri }, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = true;
    nextPlayer.volume = 0;
  });

  const stopPreview = useCallback(() => {
    setIsPreviewing(false);
    player.pause();
    player.currentTime = 0;
  }, [player]);

  const startPreview = useCallback(() => {
    if (!enablePlayback) {
      return;
    }

    setIsPreviewing(true);
    player.currentTime = 0;
    player.play();
  }, [enablePlayback, player]);

  useEffect(() => stopPreview, [stopPreview]);

  return (
    <View style={style}>
      <Image
        source={{ uri: imageUrl }}
        style={imageStyle}
        contentFit="cover"
        transition={200}
      />
      {isPreviewing ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, imageStyle]}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
          surfaceType="textureView"
          useExoShutter={false}
        />
      ) : null}
      <Pressable
        accessibilityLabel="Preview live photo motion"
        delayLongPress={170}
        onLongPress={startPreview}
        onPressOut={stopPreview}
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
    />
  );
}

const styles = StyleSheet.create({
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
