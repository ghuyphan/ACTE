import { memo, useMemo } from 'react';
import { Canvas } from '@shopify/react-native-skia';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getPhotoFilterPreset, type PhotoFilterId } from '../../../services/photoFilters';
import { PhotoFilterLayerStack } from './PhotoFilterLayerStack';

interface LiveCameraFilterOverlayProps {
  filterId: PhotoFilterId;
  height: number;
  style?: StyleProp<ViewStyle>;
  width: number;
}

export const LiveCameraFilterOverlay = memo(function LiveCameraFilterOverlay({
  filterId,
  height,
  style,
  width,
}: LiveCameraFilterOverlayProps) {
  const previewLayers = useMemo(
    () => getPhotoFilterPreset(filterId).previewLayers,
    [filterId]
  );

  if (!previewLayers.length) {
    return null;
  }

  return (
    <View pointerEvents="none" style={style}>
      <Canvas style={StyleSheet.absoluteFill}>
        <PhotoFilterLayerStack width={width} height={height} layers={previewLayers} />
      </Canvas>
    </View>
  );
});
