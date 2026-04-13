import { HomeFeedItem } from '../../home/feedItems';
import {
  getGradientStickerMotionVariant,
  getNoteColorStickerMotion,
  getTextNoteCardGradient,
  type StickerMotionVariant,
} from '../../../services/noteAppearance';
import {
  getNotePreviewText,
  getSharedPostPreviewText,
} from '../../../services/noteTextPresentation';
import { parseNoteDoodleStrokes, type NoteDoodleStroke } from '../../../services/noteDoodles';
import { parseNoteStickerPlacements, type NoteStickerPlacement } from '../../../services/noteStickers';
import { getNotePhotoUri } from '../../../services/photoStorage';

export interface NotesGridTileModel {
  item: HomeFeedItem;
  noteId: string;
  isPhotoTile: boolean;
  baseImageUri: string | null;
  tileText: string;
  doodleStrokes: NoteDoodleStroke[];
  stickerPlacements: NoteStickerPlacement[];
  textGradient: readonly [string, string, ...string[]];
  stickerMotionVariant: StickerMotionVariant;
  showPhotoPlaceholder: boolean;
  usesSharedCache: boolean;
}

export function buildNotesGridTileModels(
  items: HomeFeedItem[],
  options: {
    photoFallbackLabel: string;
    showDecorations: boolean;
  }
): NotesGridTileModel[] {
  return items.map((item) => {
    const isNote = item.kind === 'note';
    const noteId = isNote ? item.note.id : item.post.id;
    const isPhotoTile = (isNote ? item.note.type : item.post.type) === 'photo';
    const doodleStrokesJson = isNote
      ? item.note.doodleStrokesJson
      : item.post.doodleStrokesJson ?? null;
    const stickerPlacementsJson = isNote
      ? item.note.stickerPlacementsJson ?? null
      : item.post.stickerPlacementsJson ?? null;
    const tileText = isNote
      ? getNotePreviewText(item.note, {
          photoLabel: options.photoFallbackLabel,
          emptyLabel: '',
        })
      : getSharedPostPreviewText(item.post, {
          photoLabel: options.photoFallbackLabel,
          emptyLabel: '',
        });
    const noteColor = isNote ? item.note.noteColor : item.post.noteColor;
    const noteEmoji = isNote ? item.note.moodEmoji : null;
    const textGradient = getTextNoteCardGradient({
      text: tileText,
      noteId,
      emoji: noteEmoji,
      noteColor,
    });

    return {
      item,
      noteId,
      isPhotoTile,
      baseImageUri: isNote
        ? getNotePhotoUri(item.note)
        : item.post.type === 'photo'
          ? item.post.photoLocalUri ?? null
          : null,
      tileText,
      doodleStrokes: options.showDecorations ? parseNoteDoodleStrokes(doodleStrokesJson) : [],
      stickerPlacements: options.showDecorations
        ? parseNoteStickerPlacements(stickerPlacementsJson)
        : [],
      textGradient: textGradient as readonly [string, string, ...string[]],
      stickerMotionVariant: isPhotoTile
        ? 'physics'
        : getNoteColorStickerMotion(noteColor) ?? getGradientStickerMotionVariant(textGradient),
      showPhotoPlaceholder: item.kind === 'shared-post' && item.post.type === 'photo',
      usesSharedCache: item.kind === 'shared-post',
    };
  });
}
