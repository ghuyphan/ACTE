import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { ScrollView, TextInput } = require('react-native');
  return {
    BottomSheetScrollView: ({ children, ...props }: { children: React.ReactNode }) => (
      <ScrollView {...props}>{children}</ScrollView>
    ),
    BottomSheetTextInput: TextInput,
  };
});

jest.mock('../components/notes/DynamicStickerCanvas', () => 'DynamicStickerCanvas');
jest.mock('../components/notes/NoteDoodleCanvas', () => 'NoteDoodleCanvas');
jest.mock('../components/notes/NoteStickerCanvas', () => 'NoteStickerCanvas');
jest.mock('../components/notes/PhotoCaptionChip', () => 'PhotoCaptionChip');
jest.mock('../components/notes/PhotoMediaView', () => 'PhotoMediaView');
jest.mock('../components/ui/PremiumNoteFinishOverlay', () => 'PremiumNoteFinishOverlay');
jest.mock('../components/ui/StickerPastePopover', () => 'StickerPastePopover');
jest.mock('../components/ui/TransientStatusChip', () => 'TransientStatusChip');
jest.mock('../components/notes/detail/NoteDetailActionSection', () => 'NoteDetailActionSection');
jest.mock('../components/notes/detail/NoteDetailEditToolbar', () => 'NoteDetailEditToolbar');
jest.mock('../components/notes/detail/NoteDetailInfoSection', () => 'NoteDetailInfoSection');
jest.mock('../components/notes/detail/NoteDetailStatusBadges', () => 'NoteDetailStatusBadges');
jest.mock('../components/notes/detail/PolaroidExportAnimation', () => 'PolaroidExportAnimation');
jest.mock('../components/notes/detail/PolaroidExportView', () => 'PolaroidExportView');

import NoteDetailSheetContent from '../components/notes/detail/NoteDetailSheetContent';
import { Platform, ScrollView } from 'react-native';

const baseProps = {
  cardAnimatedStyle: {},
  colors: {
    card: '#ffffff',
    text: '#111111',
    secondaryText: '#666666',
    primary: '#0000ff',
    border: '#dddddd',
    overlay: '#000000',
    shadow: '#000000',
    destructive: '#ff0000',
    subdued: '#f5f5f5',
    background: '#fafafa',
  },
  contentInputRef: { current: null },
  dismissPastePrompt: jest.fn(),
  doodleModeEnabled: false,
  editContent: 'Edited note',
  editDoodleStrokes: [],
  editIconAnimatedStyle: {},
  editLocation: 'Cafe',
  editNoteColor: null,
  editRadius: 150,
  editStickerPlacements: [],
  favoriteFilledIconStyle: {},
  favoriteFilledTintStyle: {},
  favoriteOutlineIconStyle: {},
  infoSectionAnimatedStyle: {},
  importingSticker: false,
  interactionFeedback: null,
  isDark: false,
  isDeleting: false,
  isEditing: false,
  loading: true,
  locationInputRef: { current: null },
  locationSelection: undefined,
  lockedPremiumNoteColorIds: [],
  note: null,
  onClearDoodle: jest.fn(),
  onClose: jest.fn(),
  onConfirmPasteFromPrompt: jest.fn(),
  onDelete: jest.fn(),
  onDownloadPolaroid: jest.fn(),
  onInfoSectionLayout: jest.fn(),
  onLocationChangeText: jest.fn(),
  onLocationFieldLayout: jest.fn(),
  onLocationFocus: jest.fn(),
  onLocationSelectionChange: jest.fn(),
  onPolaroidAnimationFinished: jest.fn(),
  onPolaroidCaptureReady: jest.fn(),
  onPressStickerCanvas: jest.fn(),
  onSaveEdit: jest.fn(),
  onShowCardPastePrompt: jest.fn(),
  onShowStickerSourceOptions: jest.fn(),
  onStartEditing: jest.fn(),
  onStickerAction: jest.fn(),
  onToggleDoodleMode: jest.fn(),
  onToggleFavorite: jest.fn(),
  onToggleStickerMode: jest.fn(),
  onToggleStickerMotionLock: jest.fn(),
  onUndoDoodle: jest.fn(),
  pastePrompt: { visible: false, x: 0, y: 0 },
  polaroidAnimationSuccess: false,
  polaroidAnimationUri: null,
  polaroidCaptureRef: { current: null },
  polaroidExporting: false,
  polaroidFallbackLocationLabel: 'Unknown place',
  previewOnlyNoteColorIds: [],
  saveIconAnimatedStyle: {},
  scrollContainerRef: { current: null },
  selectedStickerId: null,
  setEditContent: jest.fn(),
  setEditDoodleStrokes: jest.fn(),
  setEditNoteColor: jest.fn(),
  setEditRadius: jest.fn(),
  setEditStickerPlacements: jest.fn(),
  setSelectedStickerId: jest.fn(),
  showPremiumColorAlert: jest.fn(),
  showPolaroidCapture: false,
  stickerModeEnabled: false,
  t: ((_: string, fallback?: string) => fallback ?? '') as any,
};

const note = {
  id: 'note-1',
  type: 'text',
  content: 'Hello there',
  caption: null,
  photoLocalUri: null,
  photoSyncedLocalUri: null,
  photoRemoteBase64: null,
  isLivePhoto: false,
  pairedVideoLocalUri: null,
  pairedVideoSyncedLocalUri: null,
  pairedVideoRemotePath: null,
  locationName: 'Cafe',
  promptId: null,
  promptTextSnapshot: null,
  promptAnswer: null,
  moodEmoji: null,
  noteColor: null,
  latitude: 10.77,
  longitude: 106.69,
  radius: 150,
  isFavorite: false,
  hasDoodle: false,
  doodleStrokesJson: null,
  hasStickers: false,
  stickerPlacementsJson: null,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: null,
} as const;

describe('NoteDetailSheetContent', () => {
  it('renders from loading to loaded note without hook-order errors', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const screen = render(<NoteDetailSheetContent {...baseProps} />);
    screen.rerender(
      <NoteDetailSheetContent
        {...baseProps}
        loading={false}
        note={note as any}
      />
    );

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Expected static flag was missing')
    );

    consoleErrorSpy.mockRestore();
  });

  it('only adds extra Android bottom padding while the keyboard is visible', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const hidden = render(
        <NoteDetailSheetContent
          {...baseProps}
          loading={false}
          note={note as any}
          androidKeyboardVisible={false}
        />
      );

      const hiddenScrollView = hidden.UNSAFE_getByType(ScrollView);
      expect(hiddenScrollView.props.contentContainerStyle).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ paddingBottom: 60 }),
          null,
        ])
      );

      hidden.rerender(
        <NoteDetailSheetContent
          {...baseProps}
          loading={false}
          note={note as any}
          androidKeyboardVisible
        />
      );

      const visibleScrollView = hidden.UNSAFE_getByType(ScrollView);
      expect(visibleScrollView.props.contentContainerStyle).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ paddingBottom: 60 }),
          expect.objectContaining({ paddingBottom: 80 }),
        ])
      );
    } finally {
      Platform.OS = originalPlatform;
    }
  });
});
