import { GestureResponderEvent, PanResponder, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface DoodleStroke {
  color: string;
  points: number[];
}

interface NoteDoodleCanvasProps {
  strokes: DoodleStroke[];
  editable?: boolean;
  activeColor?: string;
  onChangeStrokes?: (nextStrokes: DoodleStroke[]) => void;
}

const STROKE_WIDTH = 6;
const MIN_STAMP_SPACING = 0.008;
const MAX_SEGMENT_SUBDIVISIONS = 12;

interface DoodlePoint {
  x: number;
  y: number;
}

function clamp01(value: number) {
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
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
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
    const tension2 = progress * progress;
    const tension3 = tension2 * progress;

    const x =
      0.5 *
      ((2 * start.x) +
        (-previous.x + end.x) * progress +
        (2 * previous.x - 5 * start.x + 4 * end.x - next.x) * tension2 +
        (-previous.x + 3 * start.x - 3 * end.x + next.x) * tension3);
    const y =
      0.5 *
      ((2 * start.y) +
        (-previous.y + end.y) * progress +
        (2 * previous.y - 5 * start.y + 4 * end.y - next.y) * tension2 +
        (-previous.y + 3 * start.y - 3 * end.y + next.y) * tension3);

    points.push({ x: clamp01(x), y: clamp01(y) });
  }

  return points;
}

function smoothStrokePoints(rawPoints: number[]) {
  const points = pairStrokePoints(rawPoints);

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

export default function NoteDoodleCanvas({
  strokes,
  editable = false,
  activeColor = '#1C1C1E',
  onChangeStrokes,
}: NoteDoodleCanvasProps) {
  const [layout, setLayout] = useState({ width: 1, height: 1, pageX: 0, pageY: 0 });
  const canvasRef = useRef<View | null>(null);
  const draftStrokeIndexRef = useRef<number | null>(null);
  const strokesRef = useRef(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const syncCanvasFrame = useCallback((fallbackWidth?: number, fallbackHeight?: number) => {
    requestAnimationFrame(() => {
      canvasRef.current?.measureInWindow((pageX, pageY, measuredWidth, measuredHeight) => {
        setLayout({
          width: Math.max(fallbackWidth ?? measuredWidth, 1),
          height: Math.max(fallbackHeight ?? measuredHeight, 1),
          pageX,
          pageY,
        });
      });
    });
  }, []);

  const getNormalizedPoint = useCallback((event: GestureResponderEvent) => {
    const x = clamp01((event.nativeEvent.pageX - layout.pageX) / layout.width);
    const y = clamp01((event.nativeEvent.pageY - layout.pageY) / layout.height);
    return { x, y };
  }, [layout.height, layout.pageX, layout.pageY, layout.width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editable,
        onMoveShouldSetPanResponder: () => editable,
        onStartShouldSetPanResponderCapture: () => editable,
        onMoveShouldSetPanResponderCapture: () => editable,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (!editable || !onChangeStrokes) {
            return;
          }

          syncCanvasFrame();
          const { x, y } = getNormalizedPoint(event);
          const nextStrokes = [...strokesRef.current, { color: activeColor, points: [x, y] }];
          strokesRef.current = nextStrokes;
          draftStrokeIndexRef.current = nextStrokes.length - 1;
          onChangeStrokes(nextStrokes);
        },
        onPanResponderMove: (event) => {
          if (!editable || !onChangeStrokes) {
            return;
          }

          const draftIndex = draftStrokeIndexRef.current;
          if (draftIndex === null) {
            return;
          }

          const { x, y } = getNormalizedPoint(event);

          const nextStrokes = strokesRef.current.map((stroke, index) =>
              index === draftIndex
                ? { ...stroke, points: [...stroke.points, x, y] }
                : stroke
            );
          strokesRef.current = nextStrokes;
          onChangeStrokes(nextStrokes);
        },
        onPanResponderRelease: () => {
          draftStrokeIndexRef.current = null;
        },
        onPanResponderTerminate: () => {
          draftStrokeIndexRef.current = null;
        },
      }),
    [activeColor, editable, getNormalizedPoint, onChangeStrokes, syncCanvasFrame]
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    syncCanvasFrame(width, height);
  };

  const renderedStrokes = useMemo(
    () =>
      strokes.map((stroke) => ({
        color: stroke.color,
        points: smoothStrokePoints(stroke.points),
      })),
    [strokes]
  );

  return (
    <View
      ref={canvasRef}
      style={styles.canvas}
      onLayout={handleLayout}
      {...(editable ? panResponder.panHandlers : {})}
    >
      {renderedStrokes.map((stroke, strokeIndex) =>
        stroke.points.map((point, pointIndex) => {
          return (
            <View
              key={`${strokeIndex}:${pointIndex}`}
              pointerEvents="none"
              style={[
                styles.dot,
                {
                  backgroundColor: stroke.color,
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                },
              ]}
            />
          );
        })
      )}
      {renderedStrokes.map((stroke, strokeIndex) =>
        stroke.points.map((point, pointIndex) => {
          const nextPoint = stroke.points[pointIndex + 1];

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
              key={`segment-${strokeIndex}:${pointIndex}`}
              pointerEvents="none"
              style={[
                styles.segment,
                {
                  backgroundColor: stroke.color,
                  width: length,
                  left: (startX + endX) / 2,
                  top: (startY + endY) / 2,
                  transform: [
                    { translateX: -length / 2 },
                    { translateY: -STROKE_WIDTH / 2 },
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
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    aspectRatio: 1.25,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: STROKE_WIDTH,
    height: STROKE_WIDTH,
    borderRadius: STROKE_WIDTH / 2,
    marginLeft: -(STROKE_WIDTH / 2),
    marginTop: -(STROKE_WIDTH / 2),
  },
  segment: {
    position: 'absolute',
    height: STROKE_WIDTH,
    borderRadius: STROKE_WIDTH / 2,
  },
});
