import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useTheme } from '../../../hooks/useTheme';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import type { StampCutterDraft } from '../../../services/stampCutter';
import StampStickerArtwork from '../../notes/StampStickerArtwork';
import {
  getStampFrameMetrics,
} from '../../notes/stampFrameMetrics';
import StickerCreationOverlay from './StickerCreationOverlay';
import type {
  StickerCreationAnimatedStyle,
} from './StickerCreationOverlay';
import type { WindowRect } from './stickerCreationTypes';

const PREVIEW_HORIZONTAL_PADDING = 52;
const PREVIEW_MAX_WIDTH = 360;
const PREVIEW_MAX_HEIGHT_RATIO = 0.52;

type MeasurableView = View & {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

interface StampPreviewEditorProps {
  visible: boolean;
  draft: StampCutterDraft | null;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onCompletePlacement: (payload: {
    placement: NoteStickerPlacement;
    sourceRect: WindowRect;
  }) => void;
  onConfirm: () => NoteStickerPlacement | null | Promise<NoteStickerPlacement | null>;
}

function measureWindowRect(node: MeasurableView | null): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (rect: WindowRect | null) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(rect);
    };
    const fallbackTimeout = setTimeout(() => {
      finish(null);
    }, 32);

    node.measureInWindow((x, y, width, height) => {
      clearTimeout(fallbackTimeout);

      if (width <= 0 || height <= 0) {
        finish(null);
        return;
      }

      finish({ x, y, width, height });
    });
  });
}

function StampPreviewEditor({
  visible,
  draft,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  onClose,
  onCompletePlacement,
  onConfirm,
}: StampPreviewEditorProps) {
  const { isDark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const previewRef = useRef<View | null>(null);
  const [previewWindowRect, setPreviewWindowRect] = useState<WindowRect | null>(null);
  const previewUri = draft?.source.uri ?? null;
  const sourceSize = useMemo(
    () => ({
      width: Math.max(1, draft?.width ?? 1),
      height: Math.max(1, draft?.height ?? 1),
    }),
    [draft?.height, draft?.width]
  );
  const previewSize = useMemo(() => {
    const maxWidth = Math.min(windowWidth - PREVIEW_HORIZONTAL_PADDING, PREVIEW_MAX_WIDTH);
    const maxHeight = Math.max(180, windowHeight * PREVIEW_MAX_HEIGHT_RATIO);
    const sourceAspect = sourceSize.width / sourceSize.height;
    let width = Math.max(120, maxWidth);
    let height = width / sourceAspect;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * sourceAspect;
    }

    return {
      width: Math.max(120, width),
      height: Math.max(120, height),
    };
  }, [sourceSize.height, sourceSize.width, windowHeight, windowWidth]);
  const stampMetrics = useMemo(
    () => getStampFrameMetrics(previewSize.width, previewSize.height),
    [previewSize.height, previewSize.width]
  );

  const resolvePreviewFallbackRect = useCallback(() => ({
    x: (windowWidth - previewSize.width) / 2,
    y: (windowHeight - previewSize.height) / 2,
    width: previewSize.width,
    height: previewSize.height,
  }), [previewSize.height, previewSize.width, windowHeight, windowWidth]);

  const measurePreviewInWindow = useCallback(async () => {
    const nextRect = await measureWindowRect(previewRef.current as MeasurableView | null);
    if (!nextRect) {
      return null;
    }

    setPreviewWindowRect((current) => {
      if (
        current &&
        current.x === nextRect.x &&
        current.y === nextRect.y &&
        current.width === nextRect.width &&
        current.height === nextRect.height
      ) {
        return current;
      }

      return nextRect;
    });
    return nextRect;
  }, []);

  const schedulePreviewMeasurement = useCallback(() => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        void measurePreviewInWindow();
      });
      return;
    }

    setTimeout(() => {
      void measurePreviewInWindow();
    }, 0);
  }, [measurePreviewInWindow]);

  const handleConfirmCreation = useCallback(async () => {
    const placement = await onConfirm();
    if (!placement) {
      return null;
    }

    const latestRect = await measurePreviewInWindow();
    return {
      placement,
      sourceRect: latestRect ?? previewWindowRect ?? resolvePreviewFallbackRect(),
    };
  }, [measurePreviewInWindow, onConfirm, previewWindowRect, resolvePreviewFallbackRect]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    schedulePreviewMeasurement();
  }, [previewSize.height, previewSize.width, schedulePreviewMeasurement, visible]);

  if (!draft || !previewUri) {
    return null;
  }

  const stampArtwork = (
    <StampStickerArtwork
      localUri={previewUri}
      metrics={stampMetrics}
      shadowEnabled={false}
      width={previewSize.width}
      height={previewSize.height}
      paperTestID="stamp-preview-paper"
      artworkTestID="stamp-preview-artwork"
    />
  );

  const renderStage = ({
    busy,
    contentAnimatedStyle,
  }: {
    busy: boolean;
    contentAnimatedStyle: StickerCreationAnimatedStyle;
    focusAnimatedStyle: StickerCreationAnimatedStyle;
  }) => (
    <View style={styles.stageArea}>
      <Reanimated.View
        ref={previewRef}
        collapsable={false}
        pointerEvents={busy ? 'none' : 'auto'}
        onLayout={schedulePreviewMeasurement}
        style={[
          styles.previewWrap,
          contentAnimatedStyle,
          {
            shadowColor: isDark ? '#000000' : 'rgba(76,57,31,0.42)',
          },
        ]}
      >
        {stampArtwork}
      </Reanimated.View>
    </View>
  );

  return (
    <StickerCreationOverlay
      visible={visible}
      loading={loading}
      title={title}
      subtitle={subtitle}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      testIDPrefix="stamp-preview"
      resetKey={previewUri}
      onClose={onClose}
      onConfirm={handleConfirmCreation}
      onCompletePlacement={onCompletePlacement}
      renderStage={renderStage}
    />
  );
}

export default memo(StampPreviewEditor);

const styles = StyleSheet.create({
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  previewWrap: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
});
