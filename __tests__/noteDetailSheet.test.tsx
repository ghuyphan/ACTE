import React from 'react';
import { Alert, Keyboard, Platform, ScrollView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { interactiveDismissDisabled } from '@expo/ui/swift-ui/modifiers';

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

const mockGetNoteById = jest.fn<Promise<unknown>, [string]>();
const mockDeleteNote = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockUpdateNote = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockToggleFavorite = jest.fn<Promise<boolean>, [string]>(async () => true);
const mockSaveNoteDoodle = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockClearNoteDoodle = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockSaveNoteStickerPlacementsWithAssets = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockHasClipboardStickerImage = jest.fn<Promise<boolean>, []>(async () => false);
const mockImportStickerAssetFromClipboard = jest.fn<Promise<unknown>, [unknown]>(async () => ({
  id: 'detail-sticker-asset-1',
  ownerUid: '__local__',
  localUri: 'file:///documents/stickers/detail-sticker-asset-1.png',
  remotePath: null,
  mimeType: 'image/png',
  width: 120,
  height: 120,
  createdAt: '2026-03-27T00:00:00.000Z',
  updatedAt: null,
  source: 'clipboard',
}));
const mockImportStickerAsset = jest.fn();
const mockCreateStickerImportSourceFromSubjectCutout = jest.fn();
const mockPrepareStickerSubjectCutout = jest.fn();
const mockCleanupSubjectCutoutImportSource = jest.fn();
const mockShouldImportSourceDirectlyAsSticker = jest.fn();
const mockCleanupStickerTempUri = jest.fn();
const mockCleanupStickerTempUris = jest.fn();
const mockPrepareStampCutterDraft = jest.fn();
const mockExportStampCutoutImageSource = jest.fn();
const mockRouterPush = jest.fn();
const mockImpactAsync = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockNotificationAsync = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockSetActiveNote = jest.fn();
const mockClearActiveNote = jest.fn();
const mockDeleteSharedNote = jest.fn(async () => undefined);
const mockUpdateSharedNote = jest.fn(async () => undefined);
let mockSharedPosts: any[] = [];
let latestAppBottomSheetProps: any = null;
const mockNotesStore = {
  getNoteById: (noteId: string) => mockGetNoteById(noteId),
  deleteNote: (noteId: string) => mockDeleteNote(noteId),
  updateNote: (noteId: string, updates: unknown) => mockUpdateNote(noteId, updates),
  toggleFavorite: (noteId: string) => mockToggleFavorite(noteId),
  refreshNotes: jest.fn(async () => undefined),
};

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BottomSheet: ({ children, isPresented, onIsPresentedChange }: any) => {
      const wasPresentedRef = React.useRef(isPresented);

      React.useEffect(() => {
        if (wasPresentedRef.current && !isPresented) {
          onIsPresentedChange?.(false);
        }

        wasPresentedRef.current = isPresented;
      }, [isPresented, onIsPresentedChange]);

      return <View>{children}</View>;
    },
    Group: ({ children }: any) => <View>{children}</View>,
    Host: ({ children }: any) => <View>{children}</View>,
    RNHostView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  environment: jest.fn(),
  interactiveDismissDisabled: jest.fn(),
  presentationDragIndicator: jest.fn(),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-sensors', () => ({
  DeviceMotion: {
    isAvailableAsync: jest.fn(async () => false),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: (type: unknown) => mockImpactAsync(type),
  notificationAsync: (type: unknown) => mockNotificationAsync(type),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { location?: string; value?: string }) => {
      if (typeof fallbackOrOptions === 'string') {
        return fallbackOrOptions;
      }
      if (key === 'noteDetail.sharePhotoMsg') {
        return `Photo Memory at ${fallbackOrOptions?.location ?? 'Unknown Place'}`;
      }
      if (key === 'noteDetail.radiusValue') {
        return `Reminder radius: ${fallbackOrOptions?.value ?? ''}`;
      }
      return key;
    },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  CardGradients: [['#333333', '#555555']],
  useTheme: () => ({
    isDark: false,
    colors: {
      background: '#FAF9F6',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      accent: '#FF9F0A',
      border: '#E5E5EA',
      danger: '#FF3B30',
      success: '#34C759',
      gradient: ['#FFC107', '#FF9F0A'],
      captureButtonBg: '#1C1C1E',
      tabBarBg: 'rgba(250,249,246,0.92)',
      captureCardText: '#1C1C1E',
      captureCardPlaceholder: 'rgba(28,28,30,0.48)',
      captureCardBorder: 'rgba(255,255,255,0.22)',
      captureGlassFill: 'rgba(255,252,246,0.62)',
      captureGlassBorder: 'rgba(255,255,255,0.3)',
      captureGlassText: '#2B2621',
      captureGlassIcon: 'rgba(43,38,33,0.52)',
      captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
      captureGlassColorScheme: 'light',
      captureCameraOverlay: 'rgba(28,28,30,0.48)',
      captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
      captureCameraOverlayText: '#FFFDFC',
      captureFlashOverlay: 'rgba(255,250,242,0.96)',
    },
  }),
}));

jest.mock('../hooks/useActiveNote', () => ({
  useActiveNote: () => ({
    setActiveNote: mockSetActiveNote,
    clearActiveNote: mockClearActiveNote,
  }),
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockRouterPush(...args),
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    deleteSharedNote: mockDeleteSharedNote,
    sharedPosts: mockSharedPosts,
    updateSharedNote: mockUpdateSharedNote,
  }),
}));

jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => ({
    tier: 'free',
    isPurchaseAvailable: false,
    plusPriceLabel: null,
    presentPaywallIfNeeded: jest.fn(async () => ({ status: 'unavailable' })),
    restorePurchases: jest.fn(async () => ({ status: 'unavailable' })),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => mockNotesStore,
}));

jest.mock('../services/noteDoodles', () => ({
  getNoteDoodle: jest.fn(async () => null),
  parseNoteDoodleStrokes: (strokesJson: string | null | undefined) => {
    if (!strokesJson) {
      return [];
    }

    return JSON.parse(strokesJson);
  },
  saveNoteDoodle: (noteId: string, strokesJson: string) => mockSaveNoteDoodle(noteId, strokesJson),
  clearNoteDoodle: (noteId: string) => mockClearNoteDoodle(noteId),
}));

jest.mock('../services/noteStickers', () => ({
  bringStickerPlacementToFront: jest.fn((placements: any[]) => placements),
  createStickerPlacement: jest.fn((asset: any, existingPlacements: any[] = []) => ({
    id: `detail-placement-${existingPlacements.length + 1}`,
    assetId: asset.id,
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    zIndex: existingPlacements.length + 1,
    opacity: 1,
    outlineEnabled: true,
    motionLocked: false,
    asset,
  })),
  duplicateStickerPlacement: jest.fn((placements: any[]) => placements),
  importStickerAsset: (...args: unknown[]) => mockImportStickerAsset(...args),
  parseNoteStickerPlacements: jest.fn((placementsJson: string | null | undefined) => {
    if (!placementsJson) {
      return [];
    }

    return JSON.parse(placementsJson);
  }),
  shouldImportSourceDirectlyAsSticker: (...args: unknown[]) =>
    mockShouldImportSourceDirectlyAsSticker(...args),
  saveNoteStickerPlacementsWithAssets: (noteId: string, placements: unknown) =>
    mockSaveNoteStickerPlacementsWithAssets(noteId, placements),
  clearNoteStickers: jest.fn(async () => undefined),
  setStickerPlacementMotionLocked: jest.fn((placements: any[], placementId: string, motionLocked: boolean) =>
    placements.map((placement: any) =>
      placement.id === placementId ? { ...placement, motionLocked } : placement
    )
  ),
  setStickerPlacementOutlineEnabled: jest.fn((placements: any[], placementId: string, outlineEnabled: boolean) =>
    placements.map((placement: any) =>
      placement.id === placementId ? { ...placement, outlineEnabled } : placement
    )
  ),
  updateStickerPlacementTransform: jest.fn((placements: any[]) => placements),
}));

jest.mock('../utils/stickerClipboard', () => ({
  ClipboardStickerError: class ClipboardStickerError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  hasClipboardStickerImage: () => mockHasClipboardStickerImage(),
  importStickerAssetFromClipboard: (messages: unknown) => mockImportStickerAssetFromClipboard(messages),
}));

jest.mock('../services/stickerSubjectCutout', () => ({
  SubjectCutoutError: class SubjectCutoutError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  createStickerImportSourceFromSubjectCutout: (...args: unknown[]) =>
    mockCreateStickerImportSourceFromSubjectCutout(...args),
  prepareStickerSubjectCutout: () => mockPrepareStickerSubjectCutout(),
  cleanupSubjectCutoutImportSource: (...args: unknown[]) =>
    mockCleanupSubjectCutoutImportSource(...args),
}));

jest.mock('../services/stickerTempFiles', () => ({
  cleanupStickerTempUri: (...args: unknown[]) => mockCleanupStickerTempUri(...args),
  cleanupStickerTempUris: (...args: unknown[]) => mockCleanupStickerTempUris(...args),
}));

jest.mock('../services/stampCutter', () => {
  const actual = jest.requireActual('../services/stampCutter');
  return {
    ...actual,
    prepareStampCutterDraft: (...args: unknown[]) => mockPrepareStampCutterDraft(...args),
    exportStampCutoutImageSource: (...args: unknown[]) => mockExportStampCutoutImageSource(...args),
  };
});

jest.mock('../utils/interactionFeedback', () => ({
  emitInteractionFeedback: jest.fn(),
}));

jest.mock('../utils/dateUtils', () => ({
  formatDate: () => 'Mar 10, 2026',
  formatNoteTimestamp: () => '2 hr. ago',
}));

jest.mock('../utils/platform', () => ({
  isOlderIOS: false,
}));

jest.mock('../components/ui/TransientStatusChip', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockTransientStatusChip() {
    return <View />;
  };
});

jest.mock('../components/sheets/AppBottomSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockAppBottomSheet(props: any) {
    if (props.visible) {
      latestAppBottomSheetProps = props;
    }
    return <View>{props.children}</View>;
  };
});

jest.mock('../components/notes/NoteDoodleCanvas', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteDoodleCanvas(props: any) {
      return (
        <View testID="mock-note-doodle-canvas">
          <Text testID="mock-note-doodle-editable">{String(props.editable)}</Text>
          <Text testID="mock-note-doodle-count">{String(props.strokes?.length ?? 0)}</Text>
          <Pressable
            testID="mock-note-doodle-commit"
            onPress={() =>
              props.onChangeStrokes?.([
                { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
                { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
              ])
            }
          />
        </View>
      );
    },
  };
});

jest.mock('../components/notes/NoteStickerCanvas', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteStickerCanvas(props: any) {
      const selectedPlacement = props.placements?.find(
        (placement: any) => placement.id === props.selectedPlacementId
      );

      return (
        <View testID="mock-note-sticker-canvas">
          <Text testID="mock-note-sticker-count">{String(props.placements?.length ?? 0)}</Text>
          <Text testID="mock-note-sticker-editable">{String(props.editable)}</Text>
          <Text testID="mock-note-sticker-selected">{String(props.selectedPlacementId ?? 'null')}</Text>
          <Pressable
            testID="mock-note-sticker-select-first"
            onPress={() => props.onChangeSelectedPlacementId?.(props.placements?.[0]?.id ?? null)}
          />
          {selectedPlacement ? (
            <>
              <Pressable
                testID={`note-sticker-lock-toggle-${selectedPlacement.id}`}
                onPress={() => props.onToggleSelectedPlacementMotionLock?.(selectedPlacement.id)}
              />
              {selectedPlacement.renderMode !== 'stamp' ? (
                <Pressable
                  testID={`note-sticker-outline-toggle-${selectedPlacement.id}`}
                  onPress={() => props.onToggleSelectedPlacementOutline?.(selectedPlacement.id)}
                />
              ) : null}
              <Pressable
                testID={`note-sticker-remove-${selectedPlacement.id}`}
                onPress={() => props.onRemoveSelectedPlacement?.(selectedPlacement.id)}
              />
            </>
          ) : null}
        </View>
      );
    },
  };
});

jest.mock('../components/home/capture/StampCutterEditor', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');

  return function MockStampCutterEditor(props: any) {
    if (!props.visible) {
      return null;
    }

    return (
      <View testID="stamp-cutter-editor">
        <Pressable
          testID="stamp-cutter-confirm"
          onPress={async () => {
            const placement = await props.onConfirm({
              viewportSize: { width: 320, height: 320 },
              selectionRect: { x: 40, y: 48, width: 160, height: 192 },
              transform: { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
            });

            if (placement) {
              props.onCompletePlacement({
                placement,
                sourceRect: { x: 40, y: 48, width: 160, height: 192 },
              });
            }
          }}
        />
        <Pressable testID="stamp-cutter-close" onPress={props.onClose} />
      </View>
    );
  };
});

import NoteDetailSheet from '../components/notes/NoteDetailSheet';

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteSharedNote.mockClear();
  mockUpdateSharedNote.mockClear();
  mockSharedPosts = [];
  latestAppBottomSheetProps = null;
  mockHasClipboardStickerImage.mockResolvedValue(false);
  mockGetNoteById.mockResolvedValue({
    id: 'note-1',
    type: 'text',
    content: 'Original note',
    photoLocalUri: null,
    photoRemoteBase64: null,
    locationName: 'Old place',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    hasDoodle: false,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: null,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockImportStickerAsset.mockResolvedValue({
    id: 'detail-sticker-asset-1',
    ownerUid: '__local__',
    localUri: 'file:///documents/stickers/detail-sticker-asset-1.png',
    remotePath: null,
    mimeType: 'image/png',
    width: 120,
    height: 120,
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: null,
    source: 'import',
  });
  mockCreateStickerImportSourceFromSubjectCutout.mockImplementation(async (source: any) => ({
    source: {
      uri: 'file:///cache/detail-subject-cutout.png',
      mimeType: 'image/png',
      name: source?.name ?? 'subject-cutout.png',
    },
    cleanupUri: 'file:///cache/detail-subject-cutout.png',
  }));
  mockPrepareStickerSubjectCutout.mockResolvedValue({ available: true, ready: true });
  mockCleanupSubjectCutoutImportSource.mockResolvedValue(undefined);
  mockCleanupStickerTempUri.mockResolvedValue(undefined);
  mockCleanupStickerTempUris.mockResolvedValue(undefined);
  mockPrepareStampCutterDraft.mockResolvedValue({
    source: {
      uri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
      name: 'photo.jpg',
    },
    sourceSize: { width: 1600, height: 1200 },
    previewUri: 'file:///tmp/stamp-cutter-preview.jpg',
    cleanupUri: 'file:///tmp/stamp-cutter-preview.jpg',
  });
  mockExportStampCutoutImageSource.mockResolvedValue({
    source: {
      uri: 'file:///tmp/cut-stamp.png',
      mimeType: 'image/png',
      name: 'cut-stamp.png',
    },
    cleanupUri: null,
    intermediateCleanupUri: null,
  });
  mockShouldImportSourceDirectlyAsSticker.mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('NoteDetailSheet', () => {
  it('toggles favorite from the detail card', async () => {
    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-favorite')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-favorite'));
    });

    expect(mockToggleFavorite).toHaveBeenCalledWith('note-1');
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('hides the favorite action in edit mode', async () => {
    const { getByTestId, queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await waitFor(() => {
      expect(getByTestId('note-detail-doodle-toggle')).toBeTruthy();
    });

    expect(queryByTestId('note-detail-favorite')).toBeNull();
  });

  it('shows both the shared and live badges for a live photo shared by the active user', async () => {
    mockSharedPosts = [
      {
        id: 'post-1',
        authorUid: 'user-1',
        sourceNoteId: 'note-1',
        audienceUserIds: ['user-1', 'friend-1'],
        type: 'photo',
        text: '',
        photoPath: 'shared-posts/post-1.jpg',
        photoLocalUri: null,
        placeName: 'Old place',
        createdAt: '2026-03-23T00:00:00.000Z',
        updatedAt: null,
      },
    ];
    mockGetNoteById.mockResolvedValue({
      id: 'note-1',
      type: 'photo',
      content: '',
      photoLocalUri: 'file:///photo.jpg',
      photoRemoteBase64: null,
      isLivePhoto: true,
      pairedVideoLocalUri: 'file:///photo.mov',
      locationName: 'Old place',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-shared-post')).toBeTruthy();
      expect(getByTestId('note-detail-live-photo')).toBeTruthy();
    });
  });

  it('does not show the shared badge for posts shared by other people', async () => {
    mockSharedPosts = [
      {
        id: 'post-2',
        authorUid: 'friend-1',
        sourceNoteId: 'note-1',
        audienceUserIds: ['friend-1', 'user-1'],
        type: 'text',
        text: 'Shared by someone else',
        photoPath: null,
        photoLocalUri: null,
        placeName: 'Old place',
        createdAt: '2026-03-23T00:00:00.000Z',
        updatedAt: null,
      },
    ];

    const { queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
    });

    expect(queryByTestId('note-detail-shared-post')).toBeNull();
  });

  it('saves edited content, location, and radius', async () => {
    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await act(async () => {
      fireEvent.changeText(getByTestId('note-detail-content-input'), 'Updated note');
      fireEvent.changeText(getByTestId('note-detail-location-input'), 'New place');
      fireEvent.press(getByTestId('note-detail-radius-250'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockUpdateNote).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({
        content: 'Updated note',
        locationName: 'New place',
        radius: 250,
      })
    );
    expect(mockUpdateSharedNote).not.toHaveBeenCalled();
  });

  it('uses keyboard-aware scrolling on iOS', async () => {
    const { UNSAFE_getByType } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
    });

    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scrollView.props.keyboardDismissMode).toBe('interactive');
  });

  it('renders the location as plain text until edit mode opens', async () => {
    const { getByText, queryByTestId, getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByText('Old place')).toBeTruthy();
    });

    expect(queryByTestId('note-detail-location-input')).toBeNull();

    fireEvent.press(getByTestId('note-detail-edit'));

    await waitFor(() => {
      expect(getByTestId('note-detail-location-input')).toBeTruthy();
    });
  });

  it('disables interactive sheet dismissal while editing', async () => {
    const { getByTestId, queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await waitFor(() => {
      expect(interactiveDismissDisabled).toHaveBeenCalledWith(true);
      expect(queryByTestId('note-detail-dismiss-keyboard')).toBeNull();
    });
  });

  it('dismisses the keyboard when the sheet closes', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss');
    const onClose = jest.fn();
    const { rerender } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={onClose} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
    });

    rerender(<NoteDetailSheet noteId="note-1" visible={false} onClose={onClose} />);

    await waitFor(() => {
      expect(dismissSpy).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('uses fill-parent keyboard behavior while editing Android note detail sheets', async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const { getByTestId } = render(<NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />);

      await waitFor(() => {
        expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
        expect(latestAppBottomSheetProps?.androidDynamicSizing).toBe(false);
        expect(latestAppBottomSheetProps?.androidSnapPoints).toEqual(['92%']);
      });

      fireEvent.press(getByTestId('note-detail-edit'));

      await waitFor(() => {
        expect(latestAppBottomSheetProps?.androidKeyboardBehavior).toBe('fillParent');
      });
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('shows a paste popover on card long press in edit mode and pastes a sticker', async () => {
    mockHasClipboardStickerImage.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await act(async () => {
      fireEvent(getByTestId('note-detail-card-paste-surface'), 'longPress', {
        nativeEvent: { locationX: 150, locationY: 210 },
      });
    });

    expect(getByTestId('note-detail-card-paste-popover')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-card-paste-action'));
    });

    await waitFor(() => {
      expect(mockImportStickerAssetFromClipboard).toHaveBeenCalled();
      expect(getByTestId('mock-note-sticker-count')).toHaveTextContent('1');
    });

    expect(queryByTestId('note-detail-card-paste-popover')).toBeNull();
  });

  it('uses inline sticker controls in note detail edit mode', async () => {
    mockHasClipboardStickerImage.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await act(async () => {
      fireEvent(getByTestId('note-detail-card-paste-surface'), 'longPress', {
        nativeEvent: { locationX: 120, locationY: 180 },
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-card-paste-action'));
    });

    await waitFor(() => {
      expect(getByTestId('mock-note-sticker-count')).toHaveTextContent('1');
    });

    fireEvent.press(getByTestId('mock-note-sticker-select-first'));

    expect(getByTestId('note-sticker-lock-toggle-detail-placement-1')).toBeTruthy();
    expect(getByTestId('note-sticker-outline-toggle-detail-placement-1')).toBeTruthy();
    expect(getByTestId('note-sticker-remove-detail-placement-1')).toBeTruthy();
    expect(queryByTestId('note-detail-sticker-motion-lock')).toBeNull();
    expect(queryByTestId('note-detail-sticker-outline-toggle')).toBeNull();
    expect(queryByTestId('note-detail-sticker-remove')).toBeNull();
  });

  it('opens cut stamp from the detail sticker source sheet and imports the cropped result', async () => {
    const mockImagePicker = jest.requireMock('expo-image-picker') as {
      getMediaLibraryPermissionsAsync: jest.Mock;
      requestMediaLibraryPermissionsAsync: jest.Mock;
      launchImageLibraryAsync: jest.Mock;
    };

    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          mimeType: 'image/jpeg',
          fileName: 'photo.jpg',
          width: 1600,
          height: 1200,
        },
      ],
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-sticker-toggle'));

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-sticker-import'));
    });

    expect(getByTestId('sticker-source-option-cut-stamp')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('sticker-source-option-cut-stamp'));
    });

    await waitFor(() => {
      expect(getByTestId('stamp-cutter-editor')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('stamp-cutter-confirm'));
    });

    await waitFor(() => {
      expect(getByTestId('mock-note-sticker-count')).toHaveTextContent('1');
    });

    expect(mockPrepareStampCutterDraft).toHaveBeenCalledWith(
      {
        uri: 'file:///photo.jpg',
        mimeType: 'image/jpeg',
        name: 'photo.jpg',
      },
      1600,
      1200
    );
    expect(mockImportStickerAsset).toHaveBeenCalledWith(
      {
        uri: 'file:///tmp/cut-stamp.png',
        mimeType: 'image/png',
        name: 'cut-stamp.png',
      },
      undefined
    );
  });

  it('does not hijack text-input long press in the note editor', async () => {
    mockHasClipboardStickerImage.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await act(async () => {
      fireEvent(getByTestId('note-detail-content-input'), 'longPress');
    });

    expect(queryByTestId('note-detail-card-paste-popover')).toBeNull();
    expect(mockHasClipboardStickerImage).not.toHaveBeenCalled();
  });

  it('shows saved doodles and lets you edit them', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'note-1',
      type: 'text',
      content: 'Original note',
      photoLocalUri: null,
      photoRemoteBase64: null,
      locationName: 'Old place',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('mock-note-doodle-count')).toHaveTextContent('1');
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-doodle-toggle'));
    expect(getByTestId('mock-note-doodle-editable')).toHaveTextContent('true');

    fireEvent.press(getByTestId('mock-note-doodle-commit'));

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', {
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([
        { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
      ]),
    });
    expect(mockSaveNoteDoodle).toHaveBeenCalledWith(
      'note-1',
      JSON.stringify([
        { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
      ])
    );
  });

  it('saves a photo caption when editing a photo note', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'photo-1',
      type: 'photo',
      content: 'file:///photos/photo-1.jpg',
      caption: null,
      photoLocalUri: 'file:///photos/photo-1.jpg',
      photoRemoteBase64: null,
      locationName: 'Coffee shop',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="photo-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await act(async () => {
      fireEvent.changeText(getByTestId('note-detail-photo-caption-input'), 'Golden hour on the way home');
    });

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockUpdateNote).toHaveBeenCalledWith(
      'photo-1',
      expect.objectContaining({
        caption: 'Golden hour on the way home',
      })
    );
  });

  it('shows and saves doodles on photo notes', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'photo-1',
      type: 'photo',
      content: 'file:///photos/photo-1.jpg',
      photoLocalUri: 'file:///photos/photo-1.jpg',
      photoRemoteBase64: null,
      locationName: 'Coffee shop',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="photo-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('mock-note-doodle-count')).toHaveTextContent('1');
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-doodle-toggle'));
    expect(getByTestId('mock-note-doodle-editable')).toHaveTextContent('true');

    fireEvent.press(getByTestId('mock-note-doodle-commit'));

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockSaveNoteDoodle).toHaveBeenCalledWith(
      'photo-1',
      JSON.stringify([
        { color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFFFFF', points: [0.3, 0.3, 0.4, 0.4] },
      ])
    );
  });

  it('locks sticker motion and persists it when saving edits', async () => {
    const stickerPlacements = [
      {
        id: 'detail-placement-1',
        assetId: 'detail-sticker-asset-1',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        outlineEnabled: true,
        asset: {
          id: 'detail-sticker-asset-1',
          ownerUid: '__local__',
          localUri: 'file:///documents/stickers/detail-sticker-asset-1.png',
          remotePath: null,
          mimeType: 'image/png',
          width: 120,
          height: 120,
          createdAt: '2026-03-27T00:00:00.000Z',
          updatedAt: null,
          source: 'import',
        },
      },
    ];

    mockGetNoteById.mockResolvedValue({
      id: 'note-1',
      type: 'text',
      content: 'Original note',
      photoLocalUri: null,
      photoRemoteBase64: null,
      locationName: 'Old place',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasStickers: true,
      stickerPlacementsJson: JSON.stringify(stickerPlacements),
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-sticker-toggle'));
    fireEvent.press(getByTestId('mock-note-sticker-select-first'));
    await waitFor(() => {
      expect(getByTestId('mock-note-sticker-selected')).toHaveTextContent('detail-placement-1');
    });
    fireEvent.press(getByTestId('note-sticker-lock-toggle-detail-placement-1'));

    await act(async () => {
      fireEvent.press(getByTestId('note-detail-edit'));
    });

    expect(mockUpdateNote).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({
        hasStickers: true,
        stickerPlacementsJson: JSON.stringify([
          {
            ...stickerPlacements[0],
            motionLocked: true,
          },
        ]),
      })
    );
    expect(mockSaveNoteStickerPlacementsWithAssets).toHaveBeenCalledWith('note-1', [
      {
        ...stickerPlacements[0],
        motionLocked: true,
      },
    ]);
  });

  it('imports transparent png stickers directly without subject cutout while editing', async () => {
    const mockImagePicker = jest.requireMock('expo-image-picker') as {
      getMediaLibraryPermissionsAsync: jest.Mock;
      requestMediaLibraryPermissionsAsync: jest.Mock;
      launchImageLibraryAsync: jest.Mock;
    };
    mockShouldImportSourceDirectlyAsSticker.mockResolvedValue(true);
    mockImagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///transparent-detail-sticker.png',
          mimeType: 'image/png',
          fileName: 'transparent-detail-sticker.png',
        },
      ],
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));
    fireEvent.press(getByTestId('note-detail-sticker-toggle'));
    await act(async () => {
      fireEvent.press(getByTestId('note-detail-sticker-import'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('sticker-source-option-create-sticker'));
    });

    await waitFor(() => {
      expect(mockImportStickerAsset).toHaveBeenCalledWith(
        {
          uri: 'file:///transparent-detail-sticker.png',
          mimeType: 'image/png',
          name: 'transparent-detail-sticker.png',
        },
        { requiresTransparency: true }
      );
    });

    expect(mockCreateStickerImportSourceFromSubjectCutout).not.toHaveBeenCalled();
    expect(mockCleanupSubjectCutoutImportSource).toHaveBeenCalledWith(null);
  });

  it('anchors the photo location cursor at the start when edit mode opens', async () => {
    mockGetNoteById.mockResolvedValue({
      id: 'photo-1',
      type: 'photo',
      content: 'file:///photos/photo-1.jpg',
      photoLocalUri: 'file:///photos/photo-1.jpg',
      photoRemoteBase64: null,
      locationName: '1, Amphitheatre Parkway, Mountain View',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    const { getByTestId } = render(
      <NoteDetailSheet noteId="photo-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-edit')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-edit'));

    await waitFor(() => {
      expect(getByTestId('note-detail-location-input').props.selection).toEqual({ start: 0, end: 0 });
    });
  });

  it('confirms deletes before removing a note', async () => {
    const onClose = jest.fn();
    const onClosed = jest.fn();
    const { getByTestId, rerender } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={onClose} onClosed={onClosed} />
    );

    await waitFor(() => {
      expect(getByTestId('note-detail-delete')).toBeTruthy();
    });

    fireEvent.press(getByTestId('note-detail-delete'));
    expect(Alert.alert).toHaveBeenCalled();

    const alertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertArgs[2] as { text?: string; onPress?: () => void }[];
    const destructiveButton = buttons.find((button) => button.text === 'Delete');
    expect(destructiveButton?.onPress).toBeTruthy();

    await act(async () => {
      destructiveButton?.onPress?.();
    });

    expect(onClose).toHaveBeenCalled();

    rerender(
      <NoteDetailSheet noteId="note-1" visible={false} onClose={onClose} onClosed={onClosed} />
    );

    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalledWith('note-1');
    });

    expect(mockDeleteSharedNote).not.toHaveBeenCalled();
    expect(onClosed).toHaveBeenCalled();
  });

  it('does not render the legacy share-to-room action', async () => {
    const { queryByTestId } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
    });

    expect(queryByTestId('note-detail-share-room')).toBeNull();
  });

  it('ignores stale note loads when the selected note changes quickly', async () => {
    let resolveFirstNote: ((value: unknown) => void) | null = null;
    let resolveSecondNote: ((value: unknown) => void) | null = null;

    mockGetNoteById.mockImplementation((noteId: string) => new Promise((resolve) => {
      if (noteId === 'note-1') {
        resolveFirstNote = resolve;
        return;
      }

      resolveSecondNote = resolve;
    }));

    const { queryByText, rerender } = render(
      <NoteDetailSheet noteId="note-1" visible onClose={() => undefined} />
    );

    rerender(
      <NoteDetailSheet noteId="note-2" visible onClose={() => undefined} />
    );

    await act(async () => {
      resolveSecondNote?.({
        id: 'note-2',
        type: 'text',
        content: 'Second note',
        photoLocalUri: null,
        photoRemoteBase64: null,
        locationName: 'New place',
        latitude: 10.78,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      });
    });

    await waitFor(() => {
      expect(queryByText('Second note')).toBeTruthy();
    });

    await act(async () => {
      resolveFirstNote?.({
        id: 'note-1',
        type: 'text',
        content: 'First note',
        photoLocalUri: null,
        photoRemoteBase64: null,
        locationName: 'Old place',
        latitude: 10.77,
        longitude: 106.69,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
      });
    });

    expect(queryByText('Second note')).toBeTruthy();
    expect(queryByText('First note')).toBeNull();
  });
});
