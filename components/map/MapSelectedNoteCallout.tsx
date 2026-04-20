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
  showOrb = true,
}: MapSelectedNoteCalloutProps) {
  const title = note.locationName?.trim() || null;
  const previewText = getPreviewText(note);
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
          <View
            style={[
              styles.mediaWrap,
              {
                backgroundColor: photoUri ? 'transparent' : `${colors.primary}12`,
                borderColor: `${colors.border}88`,
              },
            ]}
          >
            {photoUri ? (
              <Image
                testID={`note-callout-photo-${note.id}`}
                source={{ uri: photoUri }}
                style={styles.cardImage}
                contentFit="cover"
                transition={0}
              />
            ) : (
              <Ionicons name="document-text" size={16} color={colors.primary} />
            )}
          </View>
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
    width: 188,
    alignItems: 'center',
    gap: 8,
  },
  cardOnlyContainer: {
    width: 188,
    gap: 0,
  },
  cardStack: {
    width: 188,
    alignItems: 'center',
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
    width: 188,
    minHeight: 82,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  mediaWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  pointerWrap: {
    marginTop: -6,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    width: 14,
    height: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 3,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
});
