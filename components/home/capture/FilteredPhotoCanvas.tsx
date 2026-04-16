import { memo, useMemo } from 'react';
import {
  Canvas,
  ColorMatrix,
  FractalNoise,
  Group,
  Image as SkiaImage,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
  useImage as useSkiaImage,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  getPhotoFilterPreset,
  type PhotoFilterId,
  type PhotoFilterLayer,
} from '../../../services/photoFilters';

export type FilteredPhotoCanvasProps = {
  sourceUri: string;
  filterId: PhotoFilterId;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  onImageReady?: () => void;
};

export const FilteredPhotoCanvas = memo(function FilteredPhotoCanvas({
  sourceUri,
  filterId,
  width,
  height,
  style,
  onImageReady,
}: FilteredPhotoCanvasProps) {
  const image = useSkiaImage(sourceUri);
  const filterPreset = useMemo(() => getPhotoFilterPreset(filterId), [filterId]);
  const filterLayers = filterPreset.layers ?? [];

  const renderFilterLayer = (layer: PhotoFilterLayer, index: number) => {
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
  };

  return (
    <View style={style}>
      <Image
        source={{ uri: sourceUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
        onLoad={onImageReady}
        onError={onImageReady}
      />
      {image ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group
            layer={
              filterPreset.id === 'original'
                ? undefined
                : (
                  <Paint>
                    <ColorMatrix matrix={filterPreset.matrix} />
                  </Paint>
                )
            }
          >
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={width}
              height={height}
              fit="cover"
            />
          </Group>
          {filterLayers.map(renderFilterLayer)}
        </Canvas>
      ) : null}
    </View>
  );
});
