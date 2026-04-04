import type * as Location from 'expo-location';
import type { Feature, Point } from 'geojson';
import type { Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import type { Note } from '../../services/database';

export const DEFAULT_REGION: Region = {
  latitude: 10.762622,
  longitude: 106.660172,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const GROUP_PRECISION = 5;
const CLUSTER_RADIUS = 48;
const CLUSTER_MAX_ZOOM = 16;
const MIN_LONGITUDE_DELTA = 0.000001;
const EARTH_RADIUS_METERS = 6371000;

export type MapFilterType = 'all' | 'text' | 'photo';

export interface MapFilterState {
  type: MapFilterType;
  favoritesOnly: boolean;
}

export interface MapPointGroup {
  id: string;
  latitude: number;
  longitude: number;
  notes: Note[];
  primaryType: Note['type'];
  photoCount: number;
  textCount: number;
}

export interface ClusterPointProperties {
  groupId: string;
  noteIds: string[];
  noteCount: number;
  photoCount: number;
  textCount: number;
  primaryType: Note['type'];
}

export interface ClusterAggregateProperties {
  noteCount: number;
  photoCount: number;
  textCount: number;
}

export interface MapClusterNode {
  id: string;
  latitude: number;
  longitude: number;
  isCluster: boolean;
  pointCount: number;
  noteIds: string[];
  primaryType: Note['type'];
  groupId?: string;
  expansionZoom?: number;
}

export interface NearbyNoteItem {
  note: Note;
  distanceMeters: number;
  latitude: number;
  longitude: number;
}

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export type MapClusterIndex = Supercluster<ClusterPointProperties, ClusterAggregateProperties>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function compareNearbyItems(left: NearbyNoteItem, right: NearbyNoteItem) {
  if (left.distanceMeters !== right.distanceMeters) {
    return left.distanceMeters - right.distanceMeters;
  }

  return right.note.createdAt.localeCompare(left.note.createdAt);
}

export function getInitialMapRegion(
  location: Location.LocationObject | null,
  notes: Note[]
): Region {
  if (location) {
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  if (notes.length > 0) {
    return {
      latitude: notes[0].latitude,
      longitude: notes[0].longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    };
  }

  return DEFAULT_REGION;
}

export function applyMapFilters(notes: Note[], filterState: MapFilterState): Note[] {
  return notes.filter((note) => {
    if (filterState.type !== 'all' && note.type !== filterState.type) {
      return false;
    }

    if (filterState.favoritesOnly && !note.isFavorite) {
      return false;
    }

    return true;
  });
}

export function buildMapPointGroups(notes: Note[]): MapPointGroup[] {
  const grouped = new Map<string, Note[]>();

  notes.forEach((note) => {
    const key = `${note.latitude.toFixed(GROUP_PRECISION)}:${note.longitude.toFixed(GROUP_PRECISION)}`;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(note);
    } else {
      grouped.set(key, [note]);
    }
  });

  return Array.from(grouped.entries()).map(([id, bucket]) => {
    const sortedNotes = [...bucket].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let photoCount = 0;
    let latitudeSum = 0;
    let longitudeSum = 0;

    sortedNotes.forEach((item) => {
      if (item.type === 'photo') {
        photoCount += 1;
      }

      latitudeSum += item.latitude;
      longitudeSum += item.longitude;
    });

    const textCount = sortedNotes.length - photoCount;

    return {
      id,
      latitude: latitudeSum / sortedNotes.length,
      longitude: longitudeSum / sortedNotes.length,
      notes: sortedNotes,
      primaryType: photoCount >= textCount ? 'photo' : 'text',
      photoCount,
      textCount,
    };
  });
}

export function getPointGroupMap(groups: MapPointGroup[]) {
  return new Map(groups.map((group) => [group.id, group] as const));
}

export function buildClusterIndex(groups: MapPointGroup[]): MapClusterIndex | null {
  if (groups.length === 0) {
    return null;
  }

  const index = new Supercluster<ClusterPointProperties, ClusterAggregateProperties>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minZoom: 0,
    minPoints: 2,
    map: (props) => ({
      noteCount: props.noteCount,
      photoCount: props.photoCount,
      textCount: props.textCount,
    }),
    reduce: (accumulated, props) => {
      accumulated.noteCount += props.noteCount;
      accumulated.photoCount += props.photoCount;
      accumulated.textCount += props.textCount;
    },
  });

  const features: Array<Feature<Point, ClusterPointProperties>> = groups.map((group) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [group.longitude, group.latitude],
    },
    properties: {
      groupId: group.id,
      noteIds: group.notes.map((note) => note.id),
      noteCount: group.notes.length,
      photoCount: group.photoCount,
      textCount: group.textCount,
      primaryType: group.primaryType,
    },
  }));

  index.load(features);
  return index;
}

export function regionToBoundingBox(region: Region): [number, number, number, number] {
  const lngDelta = Math.max(region.longitudeDelta, MIN_LONGITUDE_DELTA);
  const latDelta = Math.max(region.latitudeDelta, MIN_LONGITUDE_DELTA);

  const west = clamp(region.longitude - lngDelta / 2, -180, 180);
  const east = clamp(region.longitude + lngDelta / 2, -180, 180);
  const south = clamp(region.latitude - latDelta / 2, -90, 90);
  const north = clamp(region.latitude + latDelta / 2, -90, 90);

  return [west, south, east, north];
}

export function regionToZoom(region: Region): number {
  const lngDelta = Math.max(region.longitudeDelta, MIN_LONGITUDE_DELTA);
  const zoom = Math.round(Math.log2(360 / lngDelta));
  return clamp(zoom, 0, 20);
}

function isClusterFeature(
  feature: Supercluster.ClusterFeature<ClusterAggregateProperties> | Supercluster.PointFeature<ClusterPointProperties>
): feature is Supercluster.ClusterFeature<ClusterAggregateProperties> {
  return (feature.properties as { cluster?: boolean }).cluster === true;
}

export function getMapClusterNodes(
  clusterIndex: MapClusterIndex | null,
  region: Region,
  groupMap: Map<string, MapPointGroup>
): MapClusterNode[] {
  if (!clusterIndex) {
    return [];
  }

  const bbox = regionToBoundingBox(region);
  const zoom = regionToZoom(region);
  const clusters = clusterIndex.getClusters(bbox, zoom);

  return clusters.map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;

    if (isClusterFeature(feature)) {
      const { cluster_id: clusterId, point_count: pointCount, photoCount = 0, textCount = 0 } = feature.properties;
      const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);

      return {
        id: `cluster-${clusterId}`,
        latitude,
        longitude,
        isCluster: true,
        pointCount,
        noteIds: [],
        primaryType: photoCount >= textCount ? 'photo' : 'text',
        expansionZoom,
      } satisfies MapClusterNode;
    }

    const properties = feature.properties;
    const group = groupMap.get(properties.groupId);
    const pointCount = group?.notes.length ?? properties.noteCount;

    return {
      id: `group-${properties.groupId}`,
      latitude,
      longitude,
      isCluster: false,
      pointCount,
      noteIds: properties.noteIds,
      primaryType: properties.primaryType,
      groupId: properties.groupId,
    } satisfies MapClusterNode;
  });
}

export function getRegionCenter(region: Region): CoordinatePoint {
  return {
    latitude: region.latitude,
    longitude: region.longitude,
  };
}

export function getDistanceMeters(from: CoordinatePoint, to: CoordinatePoint): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function getNotesInRegion(notes: Note[], region: Region, scale = 1.35): Note[] {
  const latPad = region.latitudeDelta * scale;
  const lonPad = region.longitudeDelta * scale;
  const minLat = region.latitude - latPad / 2;
  const maxLat = region.latitude + latPad / 2;
  const minLon = region.longitude - lonPad / 2;
  const maxLon = region.longitude + lonPad / 2;

  return notes.filter((note) =>
    note.latitude >= minLat &&
    note.latitude <= maxLat &&
    note.longitude >= minLon &&
    note.longitude <= maxLon
  );
}

export function getNearbyNoteItems(
  notes: Note[],
  anchor: CoordinatePoint,
  limit = 20
): NearbyNoteItem[] {
  if (limit <= 0 || notes.length === 0) {
    return [];
  }

  const nearbyItems: NearbyNoteItem[] = [];

  notes.forEach((note) => {
    const nextItem = {
      note,
      latitude: note.latitude,
      longitude: note.longitude,
      distanceMeters: getDistanceMeters(anchor, {
        latitude: note.latitude,
        longitude: note.longitude,
      }),
    };
    const insertIndex = nearbyItems.findIndex((item) => compareNearbyItems(nextItem, item) < 0);

    if (insertIndex === -1) {
      nearbyItems.push(nextItem);
    } else {
      nearbyItems.splice(insertIndex, 0, nextItem);
    }

    if (nearbyItems.length > limit) {
      nearbyItems.pop();
    }
  });

  return nearbyItems;
}
