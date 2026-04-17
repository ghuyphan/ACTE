import { Image } from 'expo-image';
import { memo, type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { DualCameraFacing } from '../../../services/dualCamera';
import {
  getDualCameraInsetMetrics,
} from './dualCameraLayout';

const COMPOSER_SIZE = 1080;
const {
  insetBorderWidth: INSET_BORDER_WIDTH,
  insetMargin: INSET_MARGIN,
  insetRadius: INSET_RADIUS,
  insetSize: INSET_SIZE,
} = getDualCameraInsetMetrics(COMPOSER_SIZE);

export type DualCaptureComposeRequest = {
  id: string;
  primaryUri: string;
  secondaryUri: string;
  primaryFacing: DualCameraFacing;
  secondaryFacing: DualCameraFacing;
};

type DualCaptureComposerProps = {
  request: DualCaptureComposeRequest | null;
  onComplete: (requestId: string, result: { uri: string | null; error?: string | null }) => void;
};

function MirroredImage({
  mirrored,
  uri,
}: {
  mirrored: boolean;
  uri: string;
}) {
  return (
    <Image
      source={{ uri }}
      style={[styles.image, mirrored ? styles.mirroredImage : null]}
      contentFit="cover"
      transition={0}
      cachePolicy="none"
    />
  );
}

const DualCaptureComposer = memo(function DualCaptureComposer({
  request,
  onComplete,
}: DualCaptureComposerProps) {
  const viewRef = useRef<View | null>(null);
  const [mainLoaded, setMainLoaded] = useState(false);
  const [insetLoaded, setInsetLoaded] = useState(false);

  useEffect(() => {
    setMainLoaded(false);
    setInsetLoaded(false);
  }, [request?.id]);

  useEffect(() => {
    if (!request || !mainLoaded || !insetLoaded) {
      return;
    }

    let cancelled = false;

    const capture = async () => {
      try {
        const { captureRef } = getViewShotModule();
        const capturedUri = await captureRef(viewRef, {
          fileName: `noto-dual-capture-${request.id}`,
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: COMPOSER_SIZE,
          height: COMPOSER_SIZE,
        });
        if (cancelled) return;

        onComplete(request.id, { uri: capturedUri });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'capture-failed';
          onComplete(request.id, { uri: null, error: message });
        }
      }
    };

    const timeout = setTimeout(() => {
      void capture();
    }, 10);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [insetLoaded, mainLoaded, onComplete, request]);

  if (!request) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.host}>
      <View ref={viewRef} collapsable={false} style={styles.canvas}>
        <View style={styles.mainImageWrap}>
          <MirroredImage
            mirrored={request.primaryFacing === 'front'}
            uri={request.primaryUri}
          />
        </View>
        <View style={styles.mainLoader}>
          <Image
            source={{ uri: request.primaryUri }}
            style={styles.hiddenLoaderImage}
            contentFit="cover"
            transition={0}
            cachePolicy="none"
            onLoad={() => setMainLoaded(true)}
            onError={() => setMainLoaded(false)}
          />
        </View>
        <View style={styles.insetShell}>
          <View style={styles.insetImageWrap}>
            <MirroredImage
              mirrored={request.secondaryFacing === 'front'}
              uri={request.secondaryUri}
            />
          </View>
          <View style={styles.insetLoader}>
            <Image
              source={{ uri: request.secondaryUri }}
              style={styles.hiddenLoaderImage}
              contentFit="cover"
              transition={0}
              cachePolicy="none"
              onLoad={() => setInsetLoaded(true)}
              onError={() => setInsetLoaded(false)}
            />
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: COMPOSER_SIZE,
    height: COMPOSER_SIZE,
    opacity: 0.01,
  },
  canvas: {
    width: COMPOSER_SIZE,
    height: COMPOSER_SIZE,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  mainImageWrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  insetShell: {
    position: 'absolute',
    top: INSET_MARGIN,
    left: INSET_MARGIN,
    width: INSET_SIZE,
    height: INSET_SIZE,
    borderRadius: INSET_RADIUS,
    overflow: 'hidden',
    borderWidth: INSET_BORDER_WIDTH,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#111111',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
  },
  insetImageWrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mirroredImage: {
    transform: [{ scaleX: -1 }],
  },
  hiddenLoaderImage: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  mainLoader: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
  insetLoader: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
});

export default DualCaptureComposer;
type ViewShotModule = {
  captureRef: <T>(
    viewRef: number | RefObject<T>,
    options?: {
      fileName?: string;
      width?: number;
      height?: number;
      format?: 'jpg' | 'png';
      quality?: number;
      result?: 'tmpfile';
    }
  ) => Promise<string>;
};

function getViewShotModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-view-shot') as ViewShotModule;
}
