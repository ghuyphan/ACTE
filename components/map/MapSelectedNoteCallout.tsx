import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';

interface MapSelectedNoteCalloutProps {
  note: Note;
  colors: ThemeColors;
}

function getPreviewText(note: Note) {
  const primarySource = note.type === 'text'
    ? note.content
    : note.promptAnswer || note.promptTextSnapshot || note.locationName || '';
  const normalized = formatNoteTextWithEmoji(primarySource, note.moodEmoji).trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 52 ? `${normalized.slice(0, 51)}...` : normalized;
}

function MapSelectedNoteCallout({ note, colors }: MapSelectedNoteCalloutProps) {
  const title = note.locationName?.trim() || null;
  const previewText = getPreviewText(note);

  return (
    <View testID={`note-marker-${note.id}`} style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            shadowColor: 'rgba(43,38,33,0.14)',
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
    </View>
  );
}

export default memo(MapSelectedNoteCallout);

const styles = StyleSheet.create({
  container: {
    width: 184,
    alignItems: 'center',
    paddingBottom: 8,
  },
  card: {
    width: 168,
    minHeight: 68,
    borderRadius: 14,
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
    fontFamily: 'System',
    marginBottom: 2,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    fontFamily: 'System',
  },
});
