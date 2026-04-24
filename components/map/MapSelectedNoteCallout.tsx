import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ThemeColors } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';

interface MapSelectedNoteCalloutProps {
  note: Note;
  colors: ThemeColors;
  showOrb?: boolean;
}

function getPreviewText(note: Note, title: string | null) {
  const primarySource = note.type === 'text'
    ? note.content
    : note.caption || note.promptAnswer || note.promptTextSnapshot || note.locationName || '';
  const normalized = formatNoteTextWithEmoji(primarySource, note.moodEmoji).trim();
  const normalizedTitle = title?.trim();

  if (!normalized || normalized === normalizedTitle) {
    return null;
  }

  return normalized.length > 58 ? `${normalized.slice(0, 57)}...` : normalized;
}

function MapSelectedNoteCallout({
  note,
  colors,
  showOrb = true,
}: MapSelectedNoteCalloutProps) {
  const title = note.locationName?.trim() || null;
  const previewText = getPreviewText(note, title);
  const photoUri = getNotePhotoUri(note);

  return (
    <View
      testID={`note-marker-${note.id}`}
      style={[styles.container, !showOrb ? styles.cardOnlyContainer : null]}
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
      <View style={styles.cardStack}>
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
          <View style={styles.copyWrap}>
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
          {photoUri ? (
            <View
              style={[
                styles.mediaWrap,
                {
                  borderColor: `${colors.border}88`,
                },
              ]}
            >
              <Image
                testID={`note-callout-photo-${note.id}`}
                source={{ uri: photoUri }}
                style={styles.cardImage}
                contentFit="cover"
                transition={0}
              />
            </View>
          ) : null}
        </View>
        {!showOrb ? (
          <View style={styles.pointerWrap}>
            <View
              style={[
                styles.pointer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(MapSelectedNoteCallout);

const styles = StyleSheet.create({
  container: {
    width: 196,
    alignItems: 'center',
    gap: 8,
  },
  cardOnlyContainer: {
    width: 196,
    gap: 0,
  },
  cardStack: {
    width: 196,
    alignItems: 'center',
  },
  orb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 5,
  },
  image: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 196,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 14,
    elevation: 5,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  mediaWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  pointerWrap: {
    marginTop: -7,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    width: 12,
    height: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    marginBottom: 2,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
});
