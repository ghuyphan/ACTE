import { memo, useMemo } from 'react';
import { Canvas, ColorMatrix, Group, Image as SkiaImage, Paint, useImage as useSkiaImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getPhotoFilterPreset, type PhotoFilterId } from '../../../services/photoFilters';

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
        </Canvas>
      ) : null}
    </View>
  );
});
