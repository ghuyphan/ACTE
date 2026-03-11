import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import type { MapClusterNode } from '../../hooks/map/mapDomain';
import type { ThemeColors } from '../../hooks/useTheme';

interface MapCanvasProps {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  isDark: boolean;
  markerNodes: MapClusterNode[];
  selectedGroupId: string | null;
  onMapPress: () => void;
  onMapReady: () => void;
  onRegionChangeComplete: (region: Region) => void;
  onLeafPress: (groupId: string) => void;
  onClusterPress: (node: MapClusterNode) => void;
  colors: ThemeColors;
}

function getClusterSize(pointCount: number) {
  if (pointCount < 10) {
    return 34;
  }

  if (pointCount < 25) {
    return 40;
  }

  return 46;
}

export default function MapCanvas({
  mapRef,
  initialRegion,
  isDark,
  markerNodes,
  selectedGroupId,
  onMapPress,
  onMapReady,
  onRegionChangeComplete,
  onLeafPress,
  onClusterPress,
  colors,
}: MapCanvasProps) {
  return (
    <MapView
      testID="map-canvas"
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      onPress={onMapPress}
      onMapReady={onMapReady}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation
      showsMyLocationButton={false}
      userInterfaceStyle={isDark ? 'dark' : 'light'}
    >
      {markerNodes.map((node) => {
        if (node.isCluster) {
          const size = getClusterSize(node.pointCount);
          return (
            <Marker
              key={node.id}
              testID={`cluster-marker-${node.id}`}
              coordinate={{ latitude: node.latitude, longitude: node.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={(event) => {
                event.stopPropagation?.();
                onClusterPress(node);
              }}
            >
              <View
                style={[
                  styles.clusterMarker,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: `${colors.primary}E0`,
                    borderColor: 'rgba(255,255,255,0.95)',
                  },
                ]}
              >
                <Text style={styles.clusterText}>{node.pointCount}</Text>
              </View>
            </Marker>
          );
        }

        const isSelected = node.groupId != null && node.groupId === selectedGroupId;
        const markerColor = node.primaryType === 'photo' ? '#FF6B6B' : colors.accent;

        return (
          <Marker
            key={node.id}
            testID={`leaf-marker-${node.groupId ?? node.id}`}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={(event) => {
              event.stopPropagation?.();
              if (node.groupId) {
                onLeafPress(node.groupId);
              }
            }}
          >
            {node.pointCount > 1 ? (
              <View
                style={[
                  styles.groupMarker,
                  {
                    backgroundColor: isSelected ? colors.accent : markerColor,
                    borderColor: 'white',
                  },
                ]}
              >
                <Text style={styles.groupMarkerText}>{node.pointCount}</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.singleMarker,
                  {
                    borderColor: isSelected ? colors.accent : 'white',
                    backgroundColor: isSelected ? `${colors.accent}44` : `${markerColor}30`,
                  },
                ]}
              >
                <View style={[styles.singleMarkerCore, { backgroundColor: isSelected ? colors.accent : markerColor }]} />
              </View>
            )}
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  clusterMarker: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  clusterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'System',
  },
  groupMarker: {
    minWidth: 33,
    height: 33,
    borderRadius: 16.5,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  groupMarkerText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'System',
  },
  singleMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleMarkerCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
