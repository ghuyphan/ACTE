import { memo } from 'react';
import {
  FractalNoise,
  LinearGradient,
  RadialGradient,
  Rect,
} from '@shopify/react-native-skia';
import type { PhotoFilterLayer } from '../../../services/photoFilters';

interface PhotoFilterLayerStackProps {
  height: number;
  layers: PhotoFilterLayer[];
  width: number;
}

export const PhotoFilterLayerStack = memo(function PhotoFilterLayerStack({
  height,
  layers,
  width,
}: PhotoFilterLayerStackProps) {
  return (
    <>
      {layers.map((layer, index) => {
        if (layer.type === 'solid') {
          return (
            <Rect
              key={`filter-layer-${index}`}
              x={0}
              y={0}
              width={width}
              height={height}
              color={layer.color}
              opacity={layer.opacity}
              blendMode={layer.blendMode}
            />
          );
        }

        if (layer.type === 'linearGradient') {
          return (
            <Rect
              key={`filter-layer-${index}`}
              x={0}
              y={0}
              width={width}
              height={height}
              opacity={layer.opacity}
              blendMode={layer.blendMode}
            >
              <LinearGradient
                start={{ x: width * layer.start.x, y: height * layer.start.y }}
                end={{ x: width * layer.end.x, y: height * layer.end.y }}
                colors={layer.colors}
                positions={layer.positions}
              />
            </Rect>
          );
        }

        if (layer.type === 'radialGradient') {
          return (
            <Rect
              key={`filter-layer-${index}`}
              x={0}
              y={0}
              width={width}
              height={height}
              opacity={layer.opacity}
              blendMode={layer.blendMode}
            >
              <RadialGradient
                c={{ x: width * layer.center.x, y: height * layer.center.y }}
                r={Math.max(width, height) * layer.radius}
                colors={layer.colors}
                positions={layer.positions}
              />
            </Rect>
          );
        }

        return (
          <Rect
            key={`filter-layer-${index}`}
            x={0}
            y={0}
            width={width}
            height={height}
            opacity={layer.opacity}
            blendMode={layer.blendMode}
          >
            <FractalNoise
              freqX={layer.freqX}
              freqY={layer.freqY}
              octaves={layer.octaves}
              seed={layer.seed}
              tileWidth={Math.max(96, width * layer.tileScale)}
              tileHeight={Math.max(96, height * layer.tileScale)}
            />
          </Rect>
        );
      })}
    </>
  );
});
