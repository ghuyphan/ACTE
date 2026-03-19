import { PanResponder, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export default function NoteDoodleCanvas({
  strokes,
  editable = false,
  activeColor = '#1C1C1E',
  onChangeStrokes,
}: NoteDoodleCanvasProps) {
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const draftStrokeIndexRef = useRef<number | null>(null);
  const strokesRef = useRef(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

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

          const x = clamp01(event.nativeEvent.locationX / layout.width);
          const y = clamp01(event.nativeEvent.locationY / layout.height);
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

          const x = clamp01(event.nativeEvent.locationX / layout.width);
          const y = clamp01(event.nativeEvent.locationY / layout.height);

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
    [activeColor, editable, layout.height, layout.width, onChangeStrokes]
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    });
  };

  return (
    <View
      style={styles.canvas}
      onLayout={handleLayout}
      {...(editable ? panResponder.panHandlers : {})}
    >
      {strokes.map((stroke, strokeIndex) =>
        stroke.points.map((value, pointIndex) => {
          if (pointIndex % 2 !== 0) {
            return null;
          }

          const x = value;
          const y = stroke.points[pointIndex + 1] ?? 0;

          return (
            <View
              key={`${strokeIndex}:${pointIndex}`}
              style={[
                styles.dot,
                {
                  backgroundColor: stroke.color,
                  left: `${clamp01(x) * 100}%`,
                  top: `${clamp01(y) * 100}%`,
                },
              ]}
            />
          );
        })
      )}
      {strokes.map((stroke, strokeIndex) =>
        stroke.points.map((value, pointIndex) => {
          if (pointIndex % 2 !== 0 || pointIndex >= stroke.points.length - 2) {
            return null;
          }

          const startX = clamp01(value) * layout.width;
          const startY = clamp01(stroke.points[pointIndex + 1] ?? 0) * layout.height;
          const endX = clamp01(stroke.points[pointIndex + 2] ?? 0) * layout.width;
          const endY = clamp01(stroke.points[pointIndex + 3] ?? 0) * layout.height;
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
