export interface WidgetProps {
  noteType: 'text' | 'photo';
  text: string;
  noteColorId?: string;
  locationName: string;
  date: string;
  noteCount: number;
  nearbyPlacesCount: number;
  isLivePhoto: boolean;
  backgroundImageUrl?: string;
  backgroundImageBase64?: string;
  backgroundGradientStartColor?: string;
  backgroundGradientEndColor?: string;
  hasDoodle: boolean;
  doodleStrokesJson?: string | null;
  hasStickers: boolean;
  stickerPlacementsJson?: string | null;
  isIdleState: boolean;
  idleText: string;
  savedCountText: string;
  nearbyPlacesLabelText: string;
  memoryReminderText: string;
  accessorySaveMemoryText: string;
  accessoryAddFirstPlaceText: string;
  accessoryMemoryNearbyText: string;
  accessoryOpenAppText: string;
  accessoryAddLabelText: string;
  accessorySavedLabelText: string;
  accessoryNearLabelText: string;
  livePhotoBadgeText: string;
  isSharedContent: boolean;
  authorDisplayName: string;
  authorInitials: string;
  authorAvatarImageUrl?: string;
  authorAvatarImageBase64?: string;
  primaryActionUrl: string;
  badgeActionUrl?: string;
}

export interface WidgetTimelineEntry {
  date: Date;
  props: WidgetProps;
}

export type WidgetSelectionMode =
  | 'nearest_memory'
  | 'photo_memory'
  | 'shared_memory'
  | 'latest_memory';

export const WIDGET_PAYLOAD_FIELD_NAMES = [
  'noteType',
  'text',
  'noteColorId',
  'locationName',
  'date',
  'noteCount',
  'nearbyPlacesCount',
  'isLivePhoto',
  'backgroundImageUrl',
  'backgroundImageBase64',
  'backgroundGradientStartColor',
  'backgroundGradientEndColor',
  'hasDoodle',
  'doodleStrokesJson',
  'hasStickers',
  'stickerPlacementsJson',
  'isIdleState',
  'idleText',
  'savedCountText',
  'nearbyPlacesLabelText',
  'memoryReminderText',
  'accessorySaveMemoryText',
  'accessoryAddFirstPlaceText',
  'accessoryMemoryNearbyText',
  'accessoryOpenAppText',
  'accessoryAddLabelText',
  'accessorySavedLabelText',
  'accessoryNearLabelText',
  'livePhotoBadgeText',
  'isSharedContent',
  'authorDisplayName',
  'authorInitials',
  'authorAvatarImageUrl',
  'authorAvatarImageBase64',
  'primaryActionUrl',
  'badgeActionUrl',
] as const;

export function sanitizeWidgetPropsForBridge(props: WidgetProps) {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined && value !== null)
  ) as WidgetProps;
}

export function getWidgetPropsSignature(props: WidgetProps) {
  return JSON.stringify(sanitizeWidgetPropsForBridge(props));
}

export function isStoredWidgetProps(value: unknown): value is WidgetProps {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'noteType' in value &&
      'text' in value &&
      'isIdleState' in value
  );
}
