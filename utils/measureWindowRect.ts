import type { View } from 'react-native';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MeasurableView = View & {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

export function measureWindowRect(
  node: MeasurableView | null,
  fallbackSize?: { width: number; height: number }
): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) {
      resolve(
        fallbackSize
          ? {
              x: 0,
              y: 0,
              width: Math.max(1, fallbackSize.width),
              height: Math.max(1, fallbackSize.height),
            }
          : null
      );
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
      finish(
        fallbackSize
          ? {
              x: 0,
              y: 0,
              width: Math.max(1, fallbackSize.width),
              height: Math.max(1, fallbackSize.height),
            }
          : null
      );
    }, 32);

    node.measureInWindow((x, y, width, height) => {
      clearTimeout(fallbackTimeout);

      if (width <= 0 || height <= 0) {
        finish(
          fallbackSize
            ? {
                x: 0,
                y: 0,
                width: Math.max(1, fallbackSize.width),
                height: Math.max(1, fallbackSize.height),
              }
            : null
        );
        return;
      }

      finish({
        x,
        y,
        width: Math.max(1, width),
        height: Math.max(1, height),
      });
    });
  });
}
