import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ThemeColors } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';

interface MapSelectedNoteCalloutProps {
  note: Note;
  colors: ThemeColors;
  visible: boolean;
  reduceMotionEnabled: boolean;
  showOrb?: boolean;
}

function getPreviewText(note: Note) {
  const primarySource = note.type === 'text'
    ? note.content
    : note.caption || note.promptAnswer || note.promptTextSnapshot || note.locationName || '';
  const normalized = formatNoteTextWithEmoji(primarySource, note.moodEmoji).trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 52 ? `${normalized.slice(0, 51)}...` : normalized;
}

function MapSelectedNoteCallout({
  note,
  colors,
  visible,
  reduceMotionEnabled,
  showOrb = true,
}: MapSelectedNoteCalloutProps) {
  const title = note.locationName?.trim() || null;
  const previewText = getPreviewText(note);
  const photoUri = getNotePhotoUri(note);
  const visibilityProgress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      visibilityProgress.value = visible ? 1 : 0;
      return;
    }

    visibilityProgress.value = visible
      ? withSpring(1, {
          damping: 20,
          stiffness: 220,
          mass: 0.82,
        })
      : withTiming(0, {
          duration: 180,
        });
  }, [reduceMotionEnabled, visibilityProgress, visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: visibilityProgress.value,
      transform: [
        { translateY: interpolate(visibilityProgress.value, [0, 1], [10, 0]) },
        { scale: interpolate(visibilityProgress.value, [0, 1], [0.96, 1]) },
      ],
    };
  }, [visibilityProgress]);

  return (
    <Animated.View
      testID={`note-marker-${note.id}`}
      style={[styles.container, !showOrb ? styles.cardOnlyContainer : null, animatedStyle]}
    >
      {showOrb ? (
        <View
          style={[
            styles.orb,
            {
              borderColor: colors.primary,
              backgroundColor: colors.card,
              shadowColor: colors.border,
            },
          ]}
        >
          {photoUri ? (
            <Image
              testID={`photo-marker-${note.id}`}
              source={{ uri: photoUri }}
              style={styles.image}
              contentFit="cover"
              transition={0}
            />
          ) : (
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="document-text" size={18} color={colors.primary} />
            </View>
          )}
        </View>
      ) : null}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.border,
          },
        ]}
      >
        {title ? (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {previewText ? (
          <Text style={[styles.text, { color: colors.secondaryText }]} numberOfLines={2}>
            {previewText}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default memo(MapSelectedNoteCallout);

const styles = StyleSheet.create({
  container: {
    width: 176,
    alignItems: 'center',
    gap: 8,
  },
  cardOnlyContainer: {
    width: 168,
    gap: 0,
  },
  orb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 168,
    minHeight: 68,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 2,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
});
