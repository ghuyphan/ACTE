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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
  },
});
