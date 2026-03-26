import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';

export interface DoodleStroke {
  color: string;
  points: number[];
}

interface NoteDoodleCanvasProps {
  strokes: DoodleStroke[];
  editable?: boolean;
  activeColor?: string;
  onChangeStrokes?: (nextStrokes: DoodleStroke[]) => void;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
}

interface DoodlePoint {
  x: number;
  y: number;
}

interface SkiaPathLike {
  moveTo: (x: number, y: number) => unknown;
  lineTo: (x: number, y: number) => unknown;
  quadTo: (x1: number, y1: number, x2: number, y2: number) => unknown;
  addCircle?: (x: number, y: number, radius: number) => unknown;
  reset?: () => unknown;
}

interface RenderedStroke {
  color: string;
  path: SkiaPathLike | null;
  dot: DoodlePoint | null;
  fallbackPoints: DoodlePoint[] | null;
}

interface DraftPreview {
  color: string;
  path: SkiaPathLike | null;
  dot: DoodlePoint | null;
  fallbackPoints: DoodlePoint[] | null;
}

interface SkiaLayerProps {
  renderedStrokes: RenderedStroke[];
  draftPath: SharedValue<SkiaPathLike | null>;
  draftVisible: SharedValue<number>;
  draftColor: string;
  showDraft: boolean;
  strokeWidth: number;
}

interface FallbackLayerProps {
  renderedStrokes: RenderedStroke[];
  layout: CanvasLayout;
  strokeWidth: number;
}

interface DraftFallbackLayerProps {
  draftFallbackPoints: DoodlePoint[];
  draftColor: string;
  layout: CanvasLayout;
  strokeWidth: number;
}

function strokesMatch(first: DoodleStroke | null | undefined, second: DoodleStroke | null | undefined) {
  if (!first || !second) {
    return false;
  }

  return (
    first.color === second.color &&
    first.points.length === second.points.length &&
    first.points.every((point, index) => point === second.points[index])
  );
}

const DEFAULT_STROKE_WIDTH = 6;
const DEFAULT_SINGLE_POINT_RADIUS = DEFAULT_STROKE_WIDTH / 2;
const MIN_POINT_DISTANCE = 0.0035;
const MIN_STAMP_SPACING = 0.008;
const MAX_SEGMENT_SUBDIVISIONS = 12;

type SkiaRendererModule = {
  Canvas: ComponentType<any>;
  Circle: ComponentType<any>;
  Path: ComponentType<any>;
  notifyChange?: <T>(value: SharedValue<T>) => void;
  Skia?: {
    Path?: {
      Make: () => SkiaPathLike;
    };
  };
};

let skiaRendererModule: SkiaRendererModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  skiaRendererModule = require('@shopify/react-native-skia');
} catch {
  skiaRendererModule = null;
}

function clamp01(value: number) {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

function pairStrokePoints(points: number[]): DoodlePoint[] {
  const paired: DoodlePoint[] = [];

  for (let index = 0; index < points.length; index += 2) {
    paired.push({
      x: clamp01(points[index] ?? 0),
      y: clamp01(points[index + 1] ?? 0),
    });
  }

  return paired;
}

function distanceBetweenPoints(start: DoodlePoint, end: DoodlePoint) {
  'worklet';
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function scalePoint(point: DoodlePoint, width: number, height: number) {
  'worklet';
  return {
    x: point.x * width,
    y: point.y * height,
  };
}

function appendSmoothSkiaPath(path: SkiaPathLike, points: number[], width: number, height: number) {
  'worklet';

  if (points.length < 2) {
    return;
  }

  if (points.length === 2) {
    const centerX = points[0] * width;
    const centerY = points[1] * height;

    if (path.addCircle) {
      path.addCircle(centerX, centerY, DEFAULT_SINGLE_POINT_RADIUS);
    } else {
      path.moveTo(centerX, centerY);
      path.lineTo(centerX, centerY);
    }

    return;
  }

  if (points.length === 4) {
    path.moveTo(points[0] * width, points[1] * height);
    path.lineTo(points[2] * width, points[3] * height);
    return;
  }

  path.moveTo(points[0] * width, points[1] * height);

  for (let index = 2; index < points.length - 2; index += 2) {
    const currentX = points[index] * width;
    const currentY = points[index + 1] * height;
    const nextX = points[index + 2] * width;
    const nextY = points[index + 3] * height;

    path.quadTo(currentX, currentY, (currentX + nextX) / 2, (currentY + nextY) / 2);
  }

  const penultimateX = points[points.length - 4] * width;
  const penultimateY = points[points.length - 3] * height;
  const lastX = points[points.length - 2] * width;
  const lastY = points[points.length - 1] * height;
  path.quadTo(penultimateX, penultimateY, lastX, lastY);
}

function buildSmoothSkiaPath(points: DoodlePoint[], width: number, height: number) {
  const nextPath = skiaRendererModule?.Skia?.Path?.Make?.();

  if (!nextPath || points.length < 2) {
    return null;
  }

  appendSmoothSkiaPath(nextPath, points.flatMap((point) => [point.x, point.y]), width, height);
  return nextPath;
}

function createEmptySkiaPath() {
  return skiaRendererModule?.Skia?.Path?.Make?.() ?? null;
}

function interpolateLine(start: DoodlePoint, end: DoodlePoint) {
  const distance = distanceBetweenPoints(start, end);
  const subdivisions = Math.max(1, Math.min(MAX_SEGMENT_SUBDIVISIONS, Math.ceil(distance / MIN_STAMP_SPACING)));
  const points: DoodlePoint[] = [];

  for (let step = 0; step <= subdivisions; step += 1) {
    const progress = step / subdivisions;
    points.push({
      x: clamp01(start.x + (end.x - start.x) * progress),
      y: clamp01(start.y + (end.y - start.y) * progress),
    });
  }

  return points;
}

function interpolateCurve(
  previous: DoodlePoint,
  start: DoodlePoint,
  end: DoodlePoint,
  next: DoodlePoint
) {
  const distance = distanceBetweenPoints(start, end);
  const subdivisions = Math.max(2, Math.min(MAX_SEGMENT_SUBDIVISIONS, Math.ceil(distance / MIN_STAMP_SPACING)));
  const points: DoodlePoint[] = [];

  for (let step = 0; step <= subdivisions; step += 1) {
    const progress = step / subdivisions;
    const progressSquared = progress * progress;
    const progressCubed = progressSquared * progress;

    const x =
      0.5 *
      ((2 * start.x) +
        (-previous.x + end.x) * progress +
        (2 * previous.x - 5 * start.x + 4 * end.x - next.x) * progressSquared +
        (-previous.x + 3 * start.x - 3 * end.x + next.x) * progressCubed);
    const y =
      0.5 *
      ((2 * start.y) +
        (-previous.y + end.y) * progress +
        (2 * previous.y - 5 * start.y + 4 * end.y - next.y) * progressSquared +
        (-previous.y + 3 * start.y - 3 * end.y + next.y) * progressCubed);

    points.push({ x: clamp01(x), y: clamp01(y) });
  }

  return points;
}

function buildFallbackStrokePoints(points: DoodlePoint[]) {
  if (points.length <= 1) {
    return points;
  }

  if (points.length === 2) {
    return interpolateLine(points[0], points[1]);
  }

  const smoothed: DoodlePoint[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const start = points[index];
    const end = points[index + 1];
    const next = points[index + 2] ?? end;
    const segmentPoints = interpolateCurve(previous, start, end, next);

    if (index > 0) {
      segmentPoints.shift();
    }

    smoothed.push(...segmentPoints);
  }

  return smoothed;
}

function normalizeTouchPoint(locationX: number, locationY: number, layout: CanvasLayout) {
  'worklet';

  return {
    x: clamp01(locationX / layout.width),
    y: clamp01(locationY / layout.height),
  };
}

function appendPointIfNeeded(points: number[], point: DoodlePoint) {
  'worklet';

  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];

  if (lastX === undefined || lastY === undefined) {
    points.push(point.x, point.y);
    return true;
  }

  if (distanceBetweenPoints({ x: lastX, y: lastY }, point) < MIN_POINT_DISTANCE) {
    return false;
  }

  points.push(point.x, point.y);
  return true;
}

interface CanvasLayout {
  width: number;
  height: number;
}

interface CachedRenderedStroke extends RenderedStroke {
  width: number;
  height: number;
  useSkia: boolean;
}

export type RenderedStrokeCache = WeakMap<DoodleStroke, CachedRenderedStroke>;

export function createRenderedStrokeCache(): RenderedStrokeCache {
  return new WeakMap();
}

export function getOrCreateRenderedStroke(
  cache: RenderedStrokeCache,
  stroke: DoodleStroke,
  width: number,
  height: number,
  useSkia: boolean
): RenderedStroke {
  const cached = cache.get(stroke);

  if (cached && cached.width === width && cached.height === height && cached.useSkia === useSkia) {
    return cached;
  }

  const points = pairStrokePoints(stroke.points);
  const nextRenderedStroke: CachedRenderedStroke = {
    color: stroke.color,
    path: useSkia ? buildSmoothSkiaPath(points, width, height) : null,
    dot: points.length === 1 ? scalePoint(points[0], width, height) : null,
    fallbackPoints: useSkia ? null : buildFallbackStrokePoints(points),
    width,
    height,
    useSkia,
  };

  cache.set(stroke, nextRenderedStroke);
  return nextRenderedStroke;
}

const SkiaLayer = memo(function SkiaLayer({
  renderedStrokes,
  draftPath,
  draftVisible,
  draftColor,
  showDraft,
  strokeWidth,
}: SkiaLayerProps) {
  const SkiaCanvas = (skiaRendererModule?.Canvas ?? null) as ComponentType<any> | null;
  const SkiaPath = (skiaRendererModule?.Path ?? null) as ComponentType<any> | null;
  const SkiaCircle = (skiaRendererModule?.Circle ?? null) as ComponentType<any> | null;
  const singlePointRadius = strokeWidth / 2;

  if (!SkiaCanvas || !SkiaPath || !SkiaCircle) {
    return null;
  }

  return (
    <SkiaCanvas pointerEvents="none" style={styles.skiaCanvas}>
      {renderedStrokes.map((stroke, index) =>
        stroke.path ? (
          <SkiaPath
            key={`stroke-${index}`}
            path={stroke.path}
            color={stroke.color}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        ) : null
      )}
      {renderedStrokes.map((stroke, index) =>
        stroke.dot ? (
          <SkiaCircle
            key={`dot-${index}`}
            cx={stroke.dot.x}
            cy={stroke.dot.y}
            r={singlePointRadius}
            color={stroke.color}
          />
        ) : null
      )}
      <SkiaPath
        key="draft-path"
        path={draftPath}
        color={draftColor}
        opacity={showDraft ? draftVisible : 0}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
    </SkiaCanvas>
  );
});

const CommittedFallbackLayer = memo(function CommittedFallbackLayer({
  renderedStrokes,
  layout,
  strokeWidth,
}: FallbackLayerProps) {
  return (
    <View pointerEvents="none" style={styles.fallbackCanvas}>
      {renderedStrokes.map((stroke, strokeIndex) =>
        (stroke.fallbackPoints ?? []).map((point, pointIndex) => (
          <View
            key={`${strokeIndex}:dot:${pointIndex}`}
            style={[
              getDotStyle(strokeWidth),
              {
                backgroundColor: stroke.color,
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
              },
            ]}
          />
        ))
      )}
      {renderedStrokes.map((stroke, strokeIndex) =>
        (stroke.fallbackPoints ?? []).map((point, pointIndex, fallbackPoints) => {
          const nextPoint = fallbackPoints[pointIndex + 1];

          if (!nextPoint) {
            return null;
          }

          const startX = point.x * layout.width;
          const startY = point.y * layout.height;
          const endX = nextPoint.x * layout.width;
          const endY = nextPoint.y * layout.height;
          const deltaX = endX - startX;
          const deltaY = endY - startY;
          const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          if (length <= 0) {
            return null;
          }

          const angle = Math.atan2(deltaY, deltaX);

          return (
            <View
              key={`${strokeIndex}:segment:${pointIndex}`}
              style={[
                styles.segment,
                getSegmentStyle(strokeWidth),
                {
                  backgroundColor: stroke.color,
                  width: length,
                  left: (startX + endX) / 2,
                  top: (startY + endY) / 2,
                  transform: [
                    { translateX: -length / 2 },
                    { translateY: -strokeWidth / 2 },
                    { rotate: `${angle}rad` },
                  ],
                },
              ]}
            />
          );
        })
      )}
    </View>
  );
});

const DraftFallbackLayer = memo(function DraftFallbackLayer({
  draftFallbackPoints,
  draftColor,
  layout,
  strokeWidth,
}: DraftFallbackLayerProps) {
  if (draftFallbackPoints.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.fallbackCanvas}>
      {draftFallbackPoints.map((point, pointIndex) => (
        <View
          key={`draft-dot:${pointIndex}`}
          style={[
            getDotStyle(strokeWidth),
            {
              backgroundColor: draftColor,
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
            },
          ]}
        />
      ))}
      {draftFallbackPoints.map((point, pointIndex, fallbackPoints) => {
        const nextPoint = fallbackPoints[pointIndex + 1];

        if (!nextPoint) {
          return null;
        }

        const startX = point.x * layout.width;
        const startY = point.y * layout.height;
        const endX = nextPoint.x * layout.width;
        const endY = nextPoint.y * layout.height;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (length <= 0) {
          return null;
        }

        const angle = Math.atan2(deltaY, deltaX);

        return (
          <View
            key={`draft-segment:${pointIndex}`}
            style={[
              styles.segment,
              getSegmentStyle(strokeWidth),
              {
                backgroundColor: draftColor,
                width: length,
                left: (startX + endX) / 2,
                top: (startY + endY) / 2,
                transform: [
                  { translateX: -length / 2 },
                  { translateY: -strokeWidth / 2 },
                  { rotate: `${angle}rad` },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
});

export default function NoteDoodleCanvas({
  strokes,
  editable = false,
  activeColor = '#1C1C1E',
  onChangeStrokes,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: NoteDoodleCanvasProps) {
  const [layout, setLayout] = useState<CanvasLayout>({ width: 1, height: 1 });
  const [draftPreview, setDraftPreview] = useState<DraftPreview | null>(null);
  const strokesRef = useRef(strokes);
  const pendingDraftResetStrokeRef = useRef<DoodleStroke | null>(null);
  const draftStrokeRef = useRef<DoodleStroke | null>(null);
  const draftPreviewRef = useRef<DraftPreview | null>(null);
  const queuedDraftPreviewRef = useRef<DraftPreview | null>(null);
  const draftFrameRef = useRef<number | null>(null);
  const draftResetFrameRef = useRef<number | null>(null);
  const renderCacheRef = useRef<RenderedStrokeCache>(createRenderedStrokeCache());
  const draftPointsValue = useSharedValue<number[]>([]);
  const draftCommitQueuedValue = useSharedValue(0);
  const draftPathRevisionValue = useSharedValue(0);
  const draftVisibleValue = useSharedValue(0);
  const draftDimensionsValue = useSharedValue({ width: 1, height: 1 });
  const draftPathValue = useSharedValue<SkiaPathLike | null>(createEmptySkiaPath());

  useEffect(() => {
    draftDimensionsValue.value = { width: layout.width, height: layout.height };
  }, [draftDimensionsValue, layout.height, layout.width]);

  useAnimatedReaction(
    () => ({
      revision: draftPathRevisionValue.value,
      width: draftDimensionsValue.value.width,
      height: draftDimensionsValue.value.height,
    }),
    ({ width, height }) => {
      const path = draftPathValue.value;

      if (!path) {
        return;
      }

      path.reset?.();
      appendSmoothSkiaPath(path, draftPointsValue.value, width, height);
      skiaRendererModule?.notifyChange?.(draftPathValue as SharedValue<SkiaPathLike | null>);
    }
  );

  useEffect(() => {
    return () => {
      if (draftFrameRef.current !== null) {
        cancelAnimationFrame(draftFrameRef.current);
      }

      if (draftResetFrameRef.current !== null) {
        cancelAnimationFrame(draftResetFrameRef.current);
      }
    };
  }, []);

  const flushDraftPreview = useCallback((nextPreview: DraftPreview | null) => {
    queuedDraftPreviewRef.current = nextPreview;

    if (draftFrameRef.current !== null) {
      return;
    }

    draftFrameRef.current = requestAnimationFrame(() => {
      draftFrameRef.current = null;
      setDraftPreview(queuedDraftPreviewRef.current);
    });
  }, []);

  const clearLiveDraftState = useCallback(() => {
    draftStrokeRef.current = null;
    draftPreviewRef.current = null;
    queuedDraftPreviewRef.current = null;
    draftCommitQueuedValue.value = 0;
    draftPointsValue.value = [];
    draftPathRevisionValue.value += 1;
    draftVisibleValue.value = 0;

    if (draftFrameRef.current !== null) {
      cancelAnimationFrame(draftFrameRef.current);
      draftFrameRef.current = null;
    }

    setDraftPreview(null);
  }, [draftCommitQueuedValue, draftPathRevisionValue, draftPointsValue, draftVisibleValue]);

  const resetDraftState = useCallback(() => {
    pendingDraftResetStrokeRef.current = null;

    if (draftResetFrameRef.current !== null) {
      cancelAnimationFrame(draftResetFrameRef.current);
      draftResetFrameRef.current = null;
    }

    clearLiveDraftState();
  }, [clearLiveDraftState]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    const pendingDraftResetStroke = pendingDraftResetStrokeRef.current;
    const latestCommittedStroke = strokes[strokes.length - 1] ?? null;

    if (!pendingDraftResetStroke || !strokesMatch(pendingDraftResetStroke, latestCommittedStroke)) {
      return;
    }

    if (draftResetFrameRef.current !== null) {
      return;
    }

    draftResetFrameRef.current = requestAnimationFrame(() => {
      draftResetFrameRef.current = null;
      resetDraftState();
    });
  }, [resetDraftState, strokes]);

  const commitStroke = useCallback(
    (points: number[], color: string) => {
      if (!onChangeStrokes || points.length < 2) {
        return;
      }

      onChangeStrokes([
        ...strokesRef.current,
        {
          color,
          points: [...points],
        },
      ]);
    },
    [onChangeStrokes]
  );

  const commitFallbackDraftStroke = useCallback(() => {
    const currentDraft = draftStrokeRef.current;

    if (currentDraft) {
      commitStroke(currentDraft.points, currentDraft.color);
    }

    resetDraftState();
  }, [commitStroke, resetDraftState]);

  const commitSkiaDraftStroke = useCallback(
    (points: number[], color: string) => {
      if (!onChangeStrokes || points.length < 2) {
        resetDraftState();
        return;
      }

      const nextStroke = {
        color,
        points: [...points],
      };
      pendingDraftResetStrokeRef.current = nextStroke;

      onChangeStrokes([
        ...strokesRef.current,
        nextStroke,
      ]);
    },
    [onChangeStrokes, resetDraftState]
  );

  const SkiaCanvas = (skiaRendererModule?.Canvas ?? null) as ComponentType<any> | null;
  const SkiaPath = (skiaRendererModule?.Path ?? null) as ComponentType<any> | null;
  const SkiaCircle = (skiaRendererModule?.Circle ?? null) as ComponentType<any> | null;
  const canUseSkia = Boolean(SkiaCanvas && SkiaPath && SkiaCircle && skiaRendererModule?.Skia?.Path?.Make);

  const commitTapDot = useCallback(
    (point: DoodlePoint) => {
      if (canUseSkia) {
        commitSkiaDraftStroke([point.x, point.y], activeColor);
        return;
      }

      commitStroke([point.x, point.y], activeColor);
    },
    [activeColor, canUseSkia, commitSkiaDraftStroke, commitStroke]
  );

  const beginFallbackDraftStroke = useCallback(
    (point: DoodlePoint) => {
      const nextDraft = { color: activeColor, points: [point.x, point.y] };
      const nextPreview = {
        color: activeColor,
        path: null,
        dot: scalePoint(point, layout.width, layout.height),
        fallbackPoints: [point],
      };

      draftStrokeRef.current = nextDraft;
      draftPreviewRef.current = nextPreview;
      flushDraftPreview(nextPreview);
    },
    [activeColor, flushDraftPreview, layout.height, layout.width]
  );

  const moveFallbackDraftStroke = useCallback(
    (point: DoodlePoint) => {
      const currentDraft = draftStrokeRef.current;

      if (!currentDraft || !appendPointIfNeeded(currentDraft.points, point)) {
        return;
      }

      const currentPreview = draftPreviewRef.current;
      const draftPoints = pairStrokePoints(currentDraft.points);
      const nextFallbackPoints = currentPreview?.fallbackPoints
        ? [...currentPreview.fallbackPoints, point]
        : [draftPoints[0], point];
      const nextPreview = {
        color: activeColor,
        path: null,
        dot: null,
        fallbackPoints: nextFallbackPoints,
      };

      draftPreviewRef.current = nextPreview;
      flushDraftPreview(nextPreview);
    },
    [activeColor, flushDraftPreview]
  );

  const finalizeFallbackDraftStroke = useCallback(
    (success: boolean) => {
      if (success) {
        commitFallbackDraftStroke();
        return;
      }

      resetDraftState();
    },
    [commitFallbackDraftStroke, resetDraftState]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(false)
        .enabled(editable && Boolean(onChangeStrokes))
        .maxPointers(1)
        .minDistance(1)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          const point = normalizeTouchPoint(event.x, event.y, draftDimensionsValue.value);

          if (canUseSkia) {
            draftCommitQueuedValue.value = 0;
            draftPointsValue.value = [point.x, point.y];
            draftPathRevisionValue.value += 1;
            draftVisibleValue.value = 1;
            return;
          }

          runOnJS(beginFallbackDraftStroke)(point);
        })
        .onUpdate((event) => {
          const point = normalizeTouchPoint(event.x, event.y, draftDimensionsValue.value);

          if (canUseSkia) {
            const nextPoints = [...draftPointsValue.value];

            if (!appendPointIfNeeded(nextPoints, point)) {
              return;
            }

            draftPointsValue.value = nextPoints;
            draftPathRevisionValue.value += 1;
            draftVisibleValue.value = 1;
            return;
          }

          runOnJS(moveFallbackDraftStroke)(point);
        })
        .onEnd((event) => {
          if (canUseSkia) {
            const completedPoints = draftPointsValue.value.slice();

            if (completedPoints.length < 2) {
              const point = normalizeTouchPoint(event.x, event.y, draftDimensionsValue.value);
              completedPoints.push(point.x, point.y);
            }

            if (completedPoints.length >= 2) {
              draftCommitQueuedValue.value = 1;
              runOnJS(commitSkiaDraftStroke)(completedPoints, activeColor);
              return;
            }
          }
        })
        .onFinalize((_, success) => {
          if (canUseSkia) {
            if (draftCommitQueuedValue.value === 1) {
              return;
            }

            runOnJS(resetDraftState)();
            return;
          }

          runOnJS(finalizeFallbackDraftStroke)(success);
        }),
    [
      activeColor,
      beginFallbackDraftStroke,
      canUseSkia,
      commitSkiaDraftStroke,
      draftCommitQueuedValue,
      draftDimensionsValue,
      draftPathRevisionValue,
      draftPointsValue,
      draftVisibleValue,
      editable,
      finalizeFallbackDraftStroke,
      moveFallbackDraftStroke,
      onChangeStrokes,
      resetDraftState,
    ]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(false)
        .enabled(editable && Boolean(onChangeStrokes))
        .maxDuration(250)
        .maxDistance(8)
        .onEnd((event, success) => {
          if (!success) {
            return;
          }

          const point = normalizeTouchPoint(event.x, event.y, draftDimensionsValue.value);
          runOnJS(commitTapDot)(point);
        }),
    [commitTapDot, draftDimensionsValue, editable, onChangeStrokes]
  );

  useEffect(() => {
    if (!editable) {
      resetDraftState();
    }
  }, [editable, resetDraftState]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout((currentLayout) => {
        const nextWidth = Math.max(width, 1);
        const nextHeight = Math.max(height, 1);

        if (currentLayout.width === nextWidth && currentLayout.height === nextHeight) {
          return currentLayout;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
      draftDimensionsValue.value = {
        width: Math.max(width, 1),
        height: Math.max(height, 1),
      };
      draftPathRevisionValue.value += 1;
    },
    [draftDimensionsValue, draftPathRevisionValue]
  );

  const renderedStrokes = useMemo<RenderedStroke[]>(
    () =>
      strokes.map((stroke) =>
        getOrCreateRenderedStroke(renderCacheRef.current, stroke, layout.width, layout.height, canUseSkia)
      ),
    [canUseSkia, layout.height, layout.width, strokes]
  );
  const draftFallbackPoints = draftPreview?.fallbackPoints ?? [];
  const draftColor = draftPreview?.color ?? activeColor;

  const canvasContent = canUseSkia && SkiaCanvas && SkiaPath && SkiaCircle ? (
    <>
      <SkiaLayer
        renderedStrokes={renderedStrokes}
        draftPath={draftPathValue}
        draftVisible={draftVisibleValue}
        draftColor={activeColor}
        showDraft={editable}
        strokeWidth={strokeWidth}
      />
    </>
  ) : (
    <>
      <CommittedFallbackLayer renderedStrokes={renderedStrokes} layout={layout} strokeWidth={strokeWidth} />
      <DraftFallbackLayer
        draftFallbackPoints={draftFallbackPoints}
        draftColor={draftColor}
        layout={layout}
        strokeWidth={strokeWidth}
      />
    </>
  );

  return (
    <GestureDetector gesture={Gesture.Exclusive(tapGesture, panGesture)}>
      <View style={[styles.canvas, style]} onLayout={handleLayout}>
        {canvasContent}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  skiaCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  segment: {
    position: 'absolute',
  },
});

function getDotStyle(strokeWidth: number) {
  return {
    position: 'absolute' as const,
    width: strokeWidth,
    height: strokeWidth,
    borderRadius: strokeWidth / 2,
    marginLeft: -(strokeWidth / 2),
    marginTop: -(strokeWidth / 2),
  };
}

function getSegmentStyle(strokeWidth: number) {
  return {
    height: strokeWidth,
    borderRadius: strokeWidth / 2,
  };
}
