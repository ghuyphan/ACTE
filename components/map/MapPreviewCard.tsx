import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import type { MapPointGroup } from '../../hooks/map/mapDomain';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Note } from '../../services/database';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

interface MapPreviewCardProps {
  selectedGroup: MapPointGroup | null;
  selectedNote: Note | null;
  selectedNoteIndex: number;
  bottomOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onOpen: () => void;
  onInteraction?: () => void;
}

export default function MapPreviewCard({
  selectedGroup,
  selectedNote,
  selectedNoteIndex,
  bottomOffset,
  onPrev,
  onNext,
  onOpen,
  onInteraction,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const railOffsetY = useSharedValue(0);
  const prevBottomOffsetRef = useRef(bottomOffset);

  const preview = useMemo(() => {
    if (!selectedNote) {
      return '';
    }

    if (selectedNote.type === 'photo') {
      return `📷 ${t('map.photoNote', 'Photo Note')}`;
    }

    return selectedNote.content.substring(0, 120) + (selectedNote.content.length > 120 ? '…' : '');
  }, [selectedNote, t]);

  useEffect(() => {
    const prevBottom = prevBottomOffsetRef.current;
    const delta = prevBottom - bottomOffset;
    prevBottomOffsetRef.current = bottomOffset;

    railOffsetY.value = delta;
    if (reduceMotionEnabled) {
      railOffsetY.value = withTiming(0, { duration: 80 });
    } else {
      railOffsetY.value = withSpring(0, {
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      });
    }
  }, [bottomOffset, railOffsetY, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: railOffsetY.value }],
  }));

  if (!selectedNote) {
    return null;
  }

  return (
    <Reanimated.View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
        },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
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
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {selectedNote.locationName || t('map.unknownLocation', 'Unknown')}
          </Text>
          <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
            {preview}
          </Text>

          <View style={styles.footer}>
            {selectedGroup && selectedGroup.notes.length > 1 ? (
              <View style={styles.pager}>
                <Pressable
                  testID="map-preview-prev"
                  style={styles.pagerButton}
                  onPress={() => {
                    onInteraction?.();
                    onPrev();
                  }}
                >
                  <Ionicons name="chevron-back" size={14} color={colors.text} />
                </Pressable>
                <Text style={[styles.pagerText, { color: colors.secondaryText }]}>
                  {selectedNoteIndex + 1}/{selectedGroup.notes.length}
                </Text>
                <Pressable
                  testID="map-preview-next"
                  style={styles.pagerButton}
                  onPress={() => {
                    onInteraction?.();
                    onNext();
                  }}
                >
                  <Ionicons name="chevron-forward" size={14} color={colors.text} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.groupText, { color: colors.secondaryText }]}>
                {t('map.singleNote', 'Pinned note')}
              </Text>
            )}

            <Pressable
              testID="map-preview-open"
              style={[styles.actionButton, { backgroundColor: `${colors.primary}1F` }]}
              onPress={() => {
                onInteraction?.();
                onOpen();
              }}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('map.openNote', 'Open note')}
              </Text>
            </Pressable>
          </View>
        </GlassView>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 12,
  },
  card: {
    borderRadius: 18,
  },
  inner: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
    fontFamily: 'System',
  },
  content: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 10,
    fontFamily: 'System',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pagerButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagerText: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 38,
    textAlign: 'center',
    fontFamily: 'System',
  },
  groupText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
