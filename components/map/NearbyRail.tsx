import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isOlderIOS } from '../../utils/platform';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';
import type { NearbyNoteItem } from '../../hooks/map/mapDomain';

interface NearbyRailProps {
  items: NearbyNoteItem[];
  selectedNoteId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPressNote: (noteId: string) => void;
  onInteraction?: () => void;
}

interface NearbyCardProps {
  item: NearbyNoteItem;
  selectedNoteId: string | null;
  onPressNote: (noteId: string) => void;
  onInteraction?: () => void;
}

function formatDistanceLabel(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  const km = distanceMeters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)}km`;
}

function NearbyCard({ item, selectedNoteId, onPressNote, onInteraction }: NearbyCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const isActive = item.note.id === selectedNoteId;

  return (
    <View>
      <Pressable
        testID={`nearby-note-${item.note.id}`}
        style={[
          styles.card,
          {
            borderColor: isActive ? `${colors.primary}55` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            backgroundColor: isActive
              ? `${colors.primary}14`
              : isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(255,255,255,0.72)',
          },
        ]}
        onPress={() => {
          onInteraction?.();
          onPressNote(item.note.id);
        }}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.note.locationName || t('map.unknownLocation', 'Unknown')}
        </Text>
        <Text style={[styles.cardContent, { color: colors.secondaryText }]} numberOfLines={2}>
          {item.note.type === 'photo'
            ? t('map.photoNote', 'Photo Note')
            : item.note.content || t('map.noContent', 'No note content')}
        </Text>

        <View style={styles.cardMetaRow}>
          <View style={styles.cardMetaItem}>
            <Ionicons name="navigate" size={12} color={colors.secondaryText} />
            <Text style={[styles.cardMetaText, { color: colors.secondaryText }]}>
              {formatDistanceLabel(item.distanceMeters)}
            </Text>
          </View>
          {item.note.isFavorite ? <Ionicons name="heart" size={12} color={colors.primary} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

export default function NearbyRail({
  items,
  selectedNoteId,
  collapsed,
  onToggleCollapsed,
  onPressNote,
  onInteraction,
}: NearbyRailProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReducedMotion();
  const listRef = useRef<FlatList<NearbyNoteItem>>(null);
  const expandProgress = useSharedValue(collapsed ? 0 : 1);

  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.note.id === selectedNoteId),
    [items, selectedNoteId]
  );

  useEffect(() => {
    const toValue = collapsed ? 0 : 1;
    if (reduceMotionEnabled) {
      expandProgress.value = withTiming(toValue, { duration: 80 });
    } else {
      expandProgress.value = withSpring(toValue, {
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      });
    }
  }, [collapsed, expandProgress, reduceMotionEnabled]);

  useEffect(() => {
    if (collapsed || selectedIndex <= -1 || !listRef.current) {
      return;
    }

    listRef.current.scrollToIndex({
      animated: !reduceMotionEnabled,
      index: selectedIndex,
      viewPosition: 0.5,
    });
  }, [collapsed, reduceMotionEnabled, selectedIndex]);

  const renderItem: ListRenderItem<NearbyNoteItem> = ({ item }) => (
    <NearbyCard
      item={item}
      selectedNoteId={selectedNoteId}
      onPressNote={onPressNote}
      onInteraction={onInteraction}
    />
  );

  const animatedStyle = useAnimatedStyle(() => ({
    maxHeight: expandProgress.value * 140,
    opacity: expandProgress.value,
  }));

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + 4,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.container}>
        <GlassView
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={[
            styles.inner,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {isOlderIOS ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
                  borderRadius: 18,
                },
              ]}
            />
          ) : null}
          <View style={[styles.headerRow, { marginBottom: collapsed ? 0 : 8 }]}>
            <View style={styles.headerLabelWrap}>
              <Text style={[styles.headerLabel, { color: colors.text }]}>
                {t('map.nearbyTitle', 'Nearby')}
              </Text>
              <Text style={[styles.headerCount, { color: colors.secondaryText }]}>
                {items.length}
              </Text>
            </View>
            <Pressable
              testID="nearby-toggle"
              style={styles.collapseButton}
              onPress={() => {
                onInteraction?.();
                onToggleCollapsed();
              }}
            >
              <Ionicons
                name={collapsed ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.secondaryText}
              />
              <Text style={[styles.collapseText, { color: colors.secondaryText }]}>
                {collapsed ? t('map.expandNearby', 'Expand') : t('map.collapseNearby', 'Collapse')}
              </Text>
            </Pressable>
          </View>

          <Reanimated.View
            pointerEvents={collapsed ? 'none' : 'auto'}
            style={[animatedStyle, { overflow: 'hidden' }]}
          >
            {items.length > 0 ? (
              <FlatList
                ref={listRef}
                testID="nearby-list"
                horizontal
                data={items}
                keyExtractor={(item) => item.note.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsHorizontalScrollIndicator={false}
                onScrollToIndexFailed={() => undefined}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                  {t('map.nearbyEmpty', 'No nearby notes match your filters')}
                </Text>
              </View>
            )}
          </Reanimated.View>
        </GlassView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 11,
  },
  container: {
    borderRadius: 18,
  },
  inner: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  headerCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  collapseText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  listContent: {
    paddingBottom: 2,
    gap: 8,
  },
  card: {
    width: 210,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
    fontFamily: 'System',
  },
  cardContent: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    fontFamily: 'System',
  },
  cardMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'System',
  },
  emptyState: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: 'System',
  },
});
