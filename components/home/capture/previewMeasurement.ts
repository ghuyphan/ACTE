import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import type { WindowRect } from './stickerCreationTypes';

export type MeasurableView = View & {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

export function areWindowRectsEqual(left: WindowRect | null, right: WindowRect) {
  return (
    left !== null &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function measureWindowRect(node: MeasurableView | null): Promise<WindowRect | null> {
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

export function usePreviewMeasurement(resolveFallbackRect: () => WindowRect) {
  const previewRef = useRef<View | null>(null);
  const [previewWindowRect, setPreviewWindowRect] = useState<WindowRect | null>(null);

  const measurePreviewInWindow = useCallback(async () => {
    const nextRect = await measureWindowRect(previewRef.current as MeasurableView | null);
    if (!nextRect) {
      return null;
    }

    setPreviewWindowRect((current) => {
      if (areWindowRectsEqual(current, nextRect)) {
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

  const getPreviewSourceRect = useCallback(async () => {
    const latestRect = await measurePreviewInWindow();
    return latestRect ?? previewWindowRect ?? resolveFallbackRect();
  }, [measurePreviewInWindow, previewWindowRect, resolveFallbackRect]);

  return {
    getPreviewSourceRect,
    previewRef,
    schedulePreviewMeasurement,
  };
}
