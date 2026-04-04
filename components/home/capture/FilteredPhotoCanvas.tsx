import { memo, useMemo } from 'react';
import { Canvas, ColorMatrix, Group, Image as SkiaImage, Paint, useImage as useSkiaImage } from '@shopify/react-native-skia';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { getPhotoFilterPreset, type PhotoFilterId } from '../../../services/photoFilters';

export type FilteredPhotoCanvasProps = {
  sourceUri: string;
  filterId: PhotoFilterId;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

export const FilteredPhotoCanvas = memo(function FilteredPhotoCanvas({
  sourceUri,
  filterId,
  width,
  height,
  style,
}: FilteredPhotoCanvasProps) {
  const image = useSkiaImage(sourceUri);
  const filterPreset = useMemo(() => getPhotoFilterPreset(filterId), [filterId]);

  if (!image) {
    return <View style={style} />;
  }

  return (
    <Canvas style={style}>
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
  );
});
