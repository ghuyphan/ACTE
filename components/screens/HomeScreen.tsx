import { useFocusEffect, useIsFocused, useScrollToTop } from '@react-navigation/native';
import * as FileSystem from '../../utils/fileSystem';
import * as Haptics from '../../hooks/useHaptics';
import * as ImagePicker from 'expo-image-picker';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import {
  type ComponentProps,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type View as ReactNativeView,
} from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CaptureAudienceStrip from '../home/CaptureAudienceStrip';
import CaptureCard, { type CaptureCardHandle } from '../home/CaptureCard';
import CaptureModeMorphOverlay, {
  type CaptureModeMorphRect,
  type CaptureModeMorphTransition,
} from '../home/capture/CaptureModeMorphOverlay';
import { CARD_SIZE } from '../home/capture/captureCardStyles';
import { getCaptureCardTopPadding } from '../home/capture/captureCardLayout';
import type { DualCaptureComposeRequest } from '../home/capture/DualCaptureComposer';
import type { DualCameraPreviewHandle } from '../home/capture/DualCameraPreview';
import {
  findHomeFeedItemIndex,
  getHomeFeedItemKey,
} from '../home/feedItems';
import HomeFeedEmptyState from '../home/HomeFeedEmptyState';
import NotesFeed from '../home/NotesFeed';
import PlacePulseStrip from '../home/PlacePulseStrip';
import SavedNotePolaroidReveal from '../home/SavedNotePolaroidReveal';
import SharedPlacePulseStrip from '../home/SharedPlacePulseStrip';
import HomeFeedSurface from './home/HomeFeedSurface';
import HomeScreenChrome from './home/HomeScreenChrome';
import { useHomePlacePulse } from './home/useHomePlacePulse';
import { useHomeFeedViewModel } from '../../hooks/app/useHomeFeedViewModel';
import { useHomeRefresh } from '../../hooks/app/useHomeRefresh';
import { useHomeSharedActions } from '../../hooks/app/useHomeSharedActions';
import { useStableHomeSharedFeedSnapshot } from '../../hooks/app/useStableHomeSharedFeedSnapshot';
import { useLivePhotoCameraHint } from '../../hooks/app/useLivePhotoCameraHint';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useActiveFeedTarget } from '../../hooks/useActiveFeedTarget';
import { useAuth } from '../../hooks/useAuth';
import { useCaptureFlow } from '../../hooks/useCaptureFlow';
import { useFeedFocus } from '../../hooks/useFeedFocus';
import { useHomeStartupReady } from '../../hooks/app/useHomeStartupReady';
import {
  useGeofence,
  type ForegroundLocationRequestResult,
  type ReminderPermissionRequestResult,
} from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { startAppSpan } from '../../utils/appDiagnostics';
import { showAppAlert } from '../../utils/alert';
import { useNotesStore } from '../../hooks/useNotes';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useSubscription } from '../../hooks/useSubscription';
import { useTheme } from '../../hooks/useTheme';
import { useBottomTabVisualInset } from '../../hooks/useBottomTabVisualInset';
import { useSavedNoteRevealUi } from '../../hooks/ui/useSavedNoteRevealUi';
import {
  canCreatePhotoNote,
  countPhotoNotesCreatedToday,
  getRemainingPhotoSlots,
} from '../../constants/subscription';
import {
  PREMIUM_NOTE_COLOR_IDS,
  resolveSavedTextNoteColor,
} from '../../services/noteAppearance';
import { resolveAutoNoteEmoji } from '../../services/noteDecorations';
import { buildMemoryPromptSuggestion } from '../../services/memoryPrompts';
import { saveNoteDoodle } from '../../services/noteDoodles';
import {
  PREMIUM_PHOTO_FILTER_IDS,
  renderFilteredPhotoToFile,
  type PhotoFilterId,
} from '../../services/photoFilters';
import {
  LIVE_PHOTO_MAX_DURATION_SECONDS,
  persistLivePhotoVideo,
} from '../../services/livePhotoProcessing';
import { resolveLocationNameFromCoordinates } from '../../services/locationLookup';
import {
  saveNoteStickerPlacementsWithAssets,
  type NoteStickerPlacement,
} from '../../services/noteStickers';
import {
  getPhotoLibraryImportPickerOptions,
  type PhotoLibraryImportIntent,
} from '../../services/photoLibraryImport';
import {
  getFallbackFreeNoteColor,
  getPremiumNoteSaveDecision,
  isPreviewablePremiumNoteColor,
  PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS,
} from '../../services/premiumNoteFinish';
import { generateNoteId, type Note } from '../../services/database';
import {
  createSequentialDualCameraStillCapture,
  getDualCameraAvailability,
  type DualCameraStillCapture,
} from '../../services/dualCamera';
import { getReminderPlaceGroups } from '../../services/reminderSelection';
import {
  getSharedFeedErrorMessage,
} from '../../services/sharedFeedService';
import type { NotesRouteTransitionRect } from '../../utils/notesRouteTransition';
import { setPendingNotesRouteTransition } from '../../utils/notesRouteTransition';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../../utils/appStorage';
import { setAndroidSoftInputMode } from '../../utils/androidSoftInputMode';
import { isIOS26OrNewer } from '../../utils/platform';
import {
  CAPTURE_DRAFT_STORAGE_KEY,
  getRequiredPersistedCaptureDraftPhotoUris,
  isPersistableCaptureDraft,
  parsePersistedCaptureDraft,
  type PersistedCaptureDraft,
} from './home/captureDraftPersistence';
import { useUnreadSharedChatCount } from './home/useUnreadSharedChatCount';
import { CaptureChrome } from '../../constants/theme';

const REMINDER_RECOVERY_PROMPT_KEY_PREFIX = 'noto.home.reminder-recovery-prompt.v1.';
const CAPTURE_MODE_MORPH_OPEN_SWITCH_DELAY_MS = 320;
const CAPTURE_MODE_MORPH_CLOSE_SWITCH_DELAY_MS = 48;
type SaveButtonState = 'idle' | 'saving' | 'success';

type MapSaveCoordinate = {
  latitude: number;
  longitude: number;
};

export default function HomeScreen() {
  const { openSharedManageAt, mapSaveAt, mapSaveLat, mapSaveLon } = useLocalSearchParams<{
    openSharedManageAt?: string;
    mapSaveAt?: string;
    mapSaveLat?: string;
    mapSaveLon?: string;
  }>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const { colors, isDark, appTheme } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const bottomTabVisualInset = useBottomTabVisualInset();
  const { setSavedNoteRevealActive } = useSavedNoteRevealUi();
  const {
    notes,
    phase: notesPhaseFromStore,
    loading,
    refreshNotes,
    createNote,
    initialLoadComplete: notesInitialLoadComplete,
  } = useNotesStore();
  const notesPhase = notesPhaseFromStore ?? (loading ? 'bootstrapping' : 'ready');
  const localDailyPhotoNoteCount = useMemo(() => countPhotoNotesCreatedToday(notes), [notes]);
  const { user, isAuthAvailable } = useAuth();
  const {
    enabled: sharedEnabled,
    loading: sharedLoading,
    ready: sharedReady,
    initialLoadComplete: sharedInitialLoadComplete = true,
    friends = [],
    friendGroups = [],
    sharedPosts = [],
    ownedSharedNoteIds: sharedOwnedNoteIds,
    activeInvite,
    refreshSharedFeed,
    createFriendInvite,
    revokeFriendInvite,
    removeFriend,
    updateFriendNickname = async () => undefined,
    createFriendGroup = async () => undefined,
    updateFriendGroup = async () => undefined,
    deleteFriendGroup = async () => undefined,
    getSharedPostThreadSummaries = async () => [],
    getSharedThreadReadStates = async () => [],
    createSharedPost,
    createSharedPostResponse,
  } = useSharedFeedStore();
  const captureAudienceFriends = useMemo(
    () => friends.filter((friend) => friend.userId !== user?.uid),
    [friends, user?.uid]
  );
  const captureAudienceGroups = useMemo(
    () => friendGroups.filter((group) => group.memberUserIds.length > 0),
    [friendGroups]
  );
  const sharedPostsWithFriendNicknames = useMemo(() => {
    const nicknameByFriendUid = new Map(
      friends
        .map((friend) => [friend.userId, friend.nickname?.trim() || null] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    );

    if (nicknameByFriendUid.size === 0) {
      return sharedPosts;
    }

    return sharedPosts.map((post) => {
      const nickname = nicknameByFriendUid.get(post.authorUid);
      return nickname
        ? {
            ...post,
            authorDisplayName: nickname,
          }
        : post;
    });
  }, [friends, sharedPosts]);
  const unreadSharedChatCount = useUnreadSharedChatCount({
    enabled: sharedEnabled,
    getSharedPostThreadSummaries,
    getSharedThreadReadStates,
    posts: sharedPosts,
    ready: sharedReady,
    userUid: user?.uid,
  });
  const {
    bootstrapState: syncBootstrapState,
    requestSync,
  } = useSyncStatus();
  const {
    tier,
    isConfigured: isPlusConfigured,
    isPurchaseAvailable,
    plusPriceLabel,
    remotePhotoNoteCount,
    isRemotePhotoNoteCountReady,
    presentPaywallIfNeeded,
    restorePurchases,
  } = useSubscription();
  const {
    location,
    remindersEnabled,
    refreshPermissions,
    requestForegroundLocation,
    requestReminderPermissions,
    openAppSettings,
  } = useGeofence();
  const { alertProps, showAlert } = useAppSheetAlert();
  const { setActiveFeedTarget, clearActiveFeedTarget } = useActiveFeedTarget();
  const { homeFeedReady, markHomeFeedReady, resetHomeFeedReady } = useHomeStartupReady();
  const {
    clearFeedFocus,
    pendingFeedFocusRequest,
    peekFeedFocus,
    requestFeedFocus,
  } = useFeedFocus();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const showLegacySearchButton = Platform.OS === 'ios' && !isIOS26OrNewer;

  const [saving, setSaving] = useState(false);
  const [saveButtonState, setSaveButtonState] = useState<SaveButtonState>('idle');
  const [suppressedHomeNoteIds, setSuppressedHomeNoteIds] = useState<string[]>([]);
  const [importingPhoto, setImportingPhoto] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isCaptureTextEntryFocused, setIsCaptureTextEntryFocused] = useState(false);
  const [isCaptureDecorateModeActive, setIsCaptureDecorateModeActive] = useState(false);
  const [isCaptureGestureActive, setIsCaptureGestureActive] = useState(false);
  const [lockedCaptureSnapHeight, setLockedCaptureSnapHeight] = useState<number | null>(null);
  const [isCaptureVisible, setIsCaptureVisible] = useState(true);
  const [isCaptureScrollSettled, setIsCaptureScrollSettled] = useState(true);
  const [settledSharedButtonMode, setSettledSharedButtonMode] = useState<'manage' | 'filter'>('manage');
  const [isFriendsFilterEnabled, setIsFriendsFilterEnabled] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<'private' | 'shared'>('private');
  const [selectedSharedAudienceUserId, setSelectedSharedAudienceUserId] = useState<string | null>(null);
  const [noteColor, setNoteColor] = useState<string | null>(null);
  const [showSharedManageSheet, setShowSharedManageSheet] = useState(false);
  const [savedNoteRevealNote, setSavedNoteRevealNote] = useState<Note | null>(null);
  const [savedNoteRevealToken, setSavedNoteRevealToken] = useState(0);
  const lockedPremiumNoteColorIds = useMemo(
    () => (tier === 'plus' ? [] : PREMIUM_NOTE_COLOR_IDS),
    [tier]
  );
  const previewOnlyNoteColorIds = useMemo(
    () => (tier === 'plus' ? [] : PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS),
    [tier]
  );
  const lockedPremiumPhotoFilterIds = useMemo(
    () => (tier === 'plus' ? [] : PREMIUM_PHOTO_FILTER_IDS),
    [tier]
  );
  const [pendingSavedNoteScrollTargetId, setPendingSavedNoteScrollTargetId] = useState<string | null>(null);
  const [pendingMapSaveCoordinate, setPendingMapSaveCoordinate] = useState<MapSaveCoordinate | null>(null);

  const searchAnim = useSharedValue(0);
  const flatListRef = useRef<any>(null);
  const captureCardRef = useRef<CaptureCardHandle | null>(null);
  const captureCardMeasureRef = useRef<ReactNativeView | null>(null);
  const modeMorphTransitionIdRef = useRef(0);
  const modeMorphSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRestoredStickerPlacementsRef = useRef<NoteStickerPlacement[] | null>(null);
  const dualCameraPreviewRef = useRef<DualCameraPreviewHandle | null>(null);
  const dualCaptureComposeResolverRef = useRef<((uri: string | null) => void) | null>(null);
  const dualCaptureComposeRequestIdRef = useRef(0);
  const lastFreeNoteColorRef = useRef<string | null>(null);
  const finalizeInlineSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetSaveStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistCaptureDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureDraftRestoreStartedRef = useRef(false);
  const captureDraftMountedRef = useRef(true);
  const saveInFlightRef = useRef(false);
  const settledArchiveItemRef = useRef<{ id: string; kind: 'note' | 'shared-post' } | null>(null);
  const previousVisibleFeedItemKeysRef = useRef<string[] | null>(null);
  const lastHandledOpenSharedManageAtRef = useRef<string | null>(null);
  const lastHandledMapSaveAtRef = useRef<string | null>(null);
  const [captureDraftReady, setCaptureDraftReady] = useState(false);
  const [dualCaptureSupported, setDualCaptureSupported] = useState(false);
  const [dualCaptureComposeRequest, setDualCaptureComposeRequest] =
    useState<DualCaptureComposeRequest | null>(null);
  const [modeMorphTransition, setModeMorphTransition] =
    useState<CaptureModeMorphTransition | null>(null);
  const [modeMorphBlackoutActive, setModeMorphBlackoutActive] = useState(false);
  useScrollToTop(flatListRef);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setDualCaptureSupported(false);
      return;
    }

    let cancelled = false;

    void getDualCameraAvailability().then((availability) => {
      if (cancelled) {
        return;
      }

      setDualCaptureSupported(Boolean(availability.supported));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      void setAndroidSoftInputMode('pan');

      return () => {
        void setAndroidSoftInputMode('resize');
      };
    }, [])
  );

  const dismissSharedManageSheet = useCallback(() => {
    setShowSharedManageSheet(false);
  }, []);

  const presentSharedManageSheet = useCallback(() => {
    setShowSharedManageSheet(true);
  }, []);

  useEffect(() => {
    if (!openSharedManageAt || openSharedManageAt === lastHandledOpenSharedManageAtRef.current) {
      return;
    }

    lastHandledOpenSharedManageAtRef.current = openSharedManageAt;
    presentSharedManageSheet();
  }, [openSharedManageAt, presentSharedManageSheet]);

  useEffect(() => {
    if (!isCaptureScrollSettled) {
      return;
    }

    setSettledSharedButtonMode(isCaptureVisible ? 'manage' : 'filter');
  }, [isCaptureScrollSettled, isCaptureVisible]);

  const openAuthForShare = useCallback(() => {
    router.push({
      pathname: '/auth',
      params: {
        intent: 'share-note',
        returnTo: `/(tabs)?openSharedManageAt=${Date.now()}`,
      },
    } as Href);
  }, [router]);
  const {
    captureMode,
    cameraSubmode,
    cameraSessionKey,
    setCaptureMode,
    setCameraSubmode,
    noteText,
    setNoteText,
    capturedPhoto,
    setCapturedPhoto,
    capturedPairedVideo,
    setCapturedPairedVideo,
    dualPrimaryPhoto,
    setDualPrimaryPhoto,
    dualSecondaryPhoto,
    setDualSecondaryPhoto,
    dualPrimaryFacing,
    setDualPrimaryFacing,
    dualSecondaryFacing,
    setDualSecondaryFacing,
    radius,
    setRadius,
    facing,
    setFacing,
    backCameraLens,
    setBackCameraLens,
    availableBackCameraLenses,
    backCameraLensZoomConfig,
    selectedPhotoFilterId,
    setSelectedPhotoFilterId,
    cameraDevice,
    backCameraDeviceId,
    frontCameraDeviceId,
    permission,
    requestPermission,
    cameraRef,
    captureScale,
    captureTranslateY,
    shutterScale,
    isModeSwitchAnimating,
    toggleCaptureMode,
    handleShutterPressIn,
    handleShutterPressOut,
    takePicture,
    capturePhotoFile,
    startLivePhotoCapture,
    isStillPhotoCaptureInProgress,
    isLivePhotoCaptureInProgress,
    isLivePhotoCaptureSettling,
    isLivePhotoSaveGuardActive,
    needsCameraPermission,
    resetCapture,
    restoreCaptureState,
    clearDualCaptureState,
  } = useCaptureFlow();

  useEffect(() => {
    if (!mapSaveAt || mapSaveAt === lastHandledMapSaveAtRef.current) {
      return;
    }

    const latitude = Number(mapSaveLat);
    const longitude = Number(mapSaveLon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    lastHandledMapSaveAtRef.current = mapSaveAt;
    setPendingMapSaveCoordinate({ latitude, longitude });
    setCaptureMode('text');
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset?.({ offset: 0, animated: !reduceMotionEnabled });
    });
  }, [mapSaveAt, mapSaveLat, mapSaveLon, reduceMotionEnabled, setCaptureMode]);

  const isCameraPreviewActive =
    captureMode === 'camera' &&
    isCaptureVisible &&
    isScreenFocused &&
    appState === 'active' &&
    Boolean(permission?.granted);
  const dualCaptureUsesSequentialCapture =
    Platform.OS === 'android' && Boolean(backCameraDeviceId && frontCameraDeviceId);
  const dualCaptureFeatureSupported = dualCaptureUsesSequentialCapture || dualCaptureSupported;
  const dualCaptureUiEnabled = dualCaptureFeatureSupported;
  const dualCaptureOperationInFlightRef = useRef(false);
  const [dualCaptureOperationInProgress, setDualCaptureOperationInProgress] = useState(false);
  const cameraCaptureInProgress = isStillPhotoCaptureInProgress || dualCaptureOperationInProgress;
  const dualCaptureAwaitingSecondShot =
    cameraSubmode === 'dual' &&
    dualCaptureUsesSequentialCapture &&
    Boolean(dualPrimaryPhoto) &&
    !dualSecondaryPhoto &&
    !capturedPhoto;

  useEffect(() => {
    if (cameraSubmode !== 'dual' || dualCaptureUiEnabled) {
      return;
    }

    setCameraSubmode('single');
  }, [cameraSubmode, dualCaptureUiEnabled, setCameraSubmode]);

  const handleToggleFacing = useCallback(() => {
    if (dualCaptureAwaitingSecondShot) {
      clearDualCaptureState();
    }

    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [clearDualCaptureState, dualCaptureAwaitingSecondShot, setFacing]);

  const handleChangeCameraSubmode = useCallback(
    (nextSubmode: 'single' | 'dual') => {
      if (nextSubmode !== 'dual' || !dualCaptureUsesSequentialCapture) {
        clearDualCaptureState();
      }

      setCameraSubmode(nextSubmode);
    },
    [clearDualCaptureState, dualCaptureUsesSequentialCapture, setCameraSubmode]
  );

  const handleChangeBackCameraLens = useCallback(
    (nextLens: 'wide' | 'ultra-wide' | 'telephoto') => {
      setBackCameraLens(nextLens);
    },
    [setBackCameraLens]
  );

  const liveSnapHeight = windowHeight;
  const shouldLockCaptureInteractions =
    isCaptureTextEntryFocused || isCaptureDecorateModeActive || isCaptureGestureActive;
  const shouldLockCapturePage = Platform.OS === 'android' && shouldLockCaptureInteractions;
  const snapHeight =
    shouldLockCapturePage && lockedCaptureSnapHeight != null ? lockedCaptureSnapHeight : liveSnapHeight;

  const photoNoteCount = useMemo(
    () => Math.max(localDailyPhotoNoteCount, remotePhotoNoteCount ?? 0),
    [localDailyPhotoNoteCount, remotePhotoNoteCount]
  );
  const isPhotoNoteQuotaReady = useMemo(
    () => tier === 'plus' || !user || !isAuthAvailable || isRemotePhotoNoteCountReady,
    [isAuthAvailable, isRemotePhotoNoteCountReady, tier, user]
  );
  const canSaveAnotherPhotoNote = useMemo(
    () => isPhotoNoteQuotaReady && canCreatePhotoNote(tier, photoNoteCount),
    [isPhotoNoteQuotaReady, photoNoteCount, tier]
  );
  const remainingPhotoSlots = useMemo(
    () => (isPhotoNoteQuotaReady ? getRemainingPhotoSlots(tier, photoNoteCount) : null),
    [isPhotoNoteQuotaReady, photoNoteCount, tier]
  );
  const showLivePhotoCameraHint = useLivePhotoCameraHint({
    capturedPhoto,
    captureMode,
    isCameraPreviewActive,
    isModeSwitchAnimating,
    isQuotaExhausted: tier !== 'plus' && remainingPhotoSlots === 0,
  });
  const cameraInstructionText = useMemo(() => {
    if (captureMode !== 'camera') {
      return null;
    }

    if (cameraSubmode === 'single' && showLivePhotoCameraHint) {
      return t('capture.livePhotoCaptureHint', 'Tap for a photo. Hold for a live photo.');
    }

    return null;
  }, [
    cameraSubmode,
    captureMode,
    showLivePhotoCameraHint,
    t,
  ]);
  const cameraPermissionRequiresSettings =
    captureMode === 'camera' &&
    permission?.granted === false &&
    permission.canAskAgain === false;
  const {
    presentedSharedPosts,
    requestPromoteSharedPosts,
  } = useStableHomeSharedFeedSnapshot({
    userUid: user?.uid,
    notesPhase,
    sharedEnabled,
    sharedPosts: sharedPostsWithFriendNicknames,
    startupInteractive: homeFeedReady,
    autoPromoteDelayMs: 1200,
    presentationScope: isFriendsFilterEnabled ? 'friends' : 'all',
  });
  const {
    feedMode,
    bootstrapState,
    visibleFeedItems,
    ownedSharedNoteIds,
    savedNoteRevealIsSharedByMe,
  } = useHomeFeedViewModel({
    userUid: user?.uid,
    notes,
    notesPhase,
    sharedEnabled,
    sharedLoading,
    sharedInitialLoadComplete,
    sharedPosts: presentedSharedPosts,
    ownedSharedNoteIds: sharedOwnedNoteIds,
    syncBootstrapState,
    isFriendsFilterEnabled,
    suppressedHomeNoteIds,
    savedNoteRevealNoteId: savedNoteRevealNote?.id ?? null,
    markHomeFeedReady,
    resetHomeFeedReady,
  });

  const handleRequestCameraPermission = useCallback(async () => {
    showAlert({
      variant: 'warning',
      title: cameraPermissionRequiresSettings
        ? t('capture.cameraPermissionBlockedTitle', 'Camera access is blocked')
        : t('capture.cameraPermissionPromptTitle', 'Allow camera access?'),
      message: cameraPermissionRequiresSettings
        ? t(
          'capture.cameraPermissionBlockedMsg',
          'Noto cannot show the camera permission sheet again right now. Open Settings to enable camera access.'
        )
        : t(
          'capture.cameraPermissionPromptMsg',
          'Noto uses your camera so you can save photo memories.'
        ),
      primaryAction: {
        label: cameraPermissionRequiresSettings
          ? t('common.openSettings', 'Open Settings')
          : t('common.continue', 'Continue'),
        onPress: async () => {
          if (cameraPermissionRequiresSettings) {
            await openAppSettings();
            return;
          }

          await requestPermission();
        },
      },
      secondaryAction: {
        label: t('common.cancel', 'Cancel'),
        variant: 'secondary',
      },
    });
  }, [cameraPermissionRequiresSettings, openAppSettings, requestPermission, showAlert, t]);

  const clearPersistedCaptureDraft = useCallback(async () => {
    if (persistCaptureDraftTimeoutRef.current) {
      clearTimeout(persistCaptureDraftTimeoutRef.current);
      persistCaptureDraftTimeoutRef.current = null;
    }

    await removePersistentItem(CAPTURE_DRAFT_STORAGE_KEY).catch(() => undefined);
  }, []);

  const applyRestoredCaptureStickers = useCallback((placements: NoteStickerPlacement[]) => {
    const captureCard = captureCardRef.current;
    if (!captureCard) {
      pendingRestoredStickerPlacementsRef.current = placements;
      return;
    }

    pendingRestoredStickerPlacementsRef.current = null;
    captureCard.resetStickers();
    captureCard.restoreStickers(placements);
  }, []);

  const handleCaptureCardRef = useCallback((handle: CaptureCardHandle | null) => {
    captureCardRef.current = handle;
    if (!handle || !pendingRestoredStickerPlacementsRef.current) {
      return;
    }

    const placements = pendingRestoredStickerPlacementsRef.current;
    pendingRestoredStickerPlacementsRef.current = null;
    handle.resetStickers();
    handle.restoreStickers(placements);
  }, []);

  const resetCaptureDraft = useCallback(() => {
    captureCardRef.current?.dismissInputs?.();
    resetCapture();
    captureCardRef.current?.resetDoodle();
    captureCardRef.current?.resetStickers();
    pendingRestoredStickerPlacementsRef.current = null;
  }, [resetCapture]);

  const finalizeSavedCapture = useCallback(() => {
    void clearPersistedCaptureDraft();
    resetCaptureDraft();
    setCaptureTarget('private');
    setSelectedSharedAudienceUserId(null);
    setNoteColor(null);
    lastFreeNoteColorRef.current = null;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [clearPersistedCaptureDraft, resetCaptureDraft]);

  const handleChangeNoteColor = useCallback((nextColor: string | null) => {
    setNoteColor(nextColor);
    if (!isPreviewablePremiumNoteColor(nextColor)) {
      lastFreeNoteColorRef.current = nextColor;
    }
  }, []);

  useEffect(() => () => {
    captureDraftMountedRef.current = false;
  }, []);

  useEffect(() => {
    if (captureDraftReady || captureDraftRestoreStartedRef.current) {
      return undefined;
    }

    captureDraftRestoreStartedRef.current = true;

    void getPersistentItem(CAPTURE_DRAFT_STORAGE_KEY).then(async (storedValue) => {
      const persistedDraft = parsePersistedCaptureDraft(storedValue);
      if (!persistedDraft) {
        if (captureDraftMountedRef.current) {
          setCaptureDraftReady(true);
        }
        return;
      }

      const requiredPhotoUris = getRequiredPersistedCaptureDraftPhotoUris(persistedDraft);
      if (requiredPhotoUris.length > 0) {
        const photoChecks = await Promise.all(
          requiredPhotoUris.map(async (uri) => FileSystem.getInfoAsync(uri).catch(() => ({ exists: false })))
        );
        const missingPhoto = photoChecks.find((info) => !info.exists);

        if (missingPhoto) {
          await clearPersistedCaptureDraft();
          if (captureDraftMountedRef.current) {
            setCaptureDraftReady(true);
          }
          return;
        }
      }

      if (persistedDraft.captureMode === 'camera' && persistedDraft.capturedPairedVideo) {
        const pairedVideoInfo = await FileSystem.getInfoAsync(persistedDraft.capturedPairedVideo).catch(() => ({
          exists: false,
        }));

        if (!pairedVideoInfo.exists) {
          persistedDraft.capturedPairedVideo = null;
        }
      }

      if (!captureDraftMountedRef.current) {
        return;
      }

      restoreCaptureState({
        captureMode: persistedDraft.captureMode,
        cameraSubmode: persistedDraft.cameraSubmode,
        noteText: persistedDraft.noteText,
        capturedPhoto: persistedDraft.capturedPhoto,
        capturedPairedVideo: persistedDraft.capturedPairedVideo,
        dualPrimaryPhoto: persistedDraft.dualPrimaryPhoto,
        dualSecondaryPhoto: persistedDraft.dualSecondaryPhoto,
        dualPrimaryFacing: persistedDraft.dualPrimaryFacing,
        dualSecondaryFacing: persistedDraft.dualSecondaryFacing,
        facing: persistedDraft.facing,
        radius: persistedDraft.radius,
        selectedPhotoFilterId: persistedDraft.selectedPhotoFilterId,
      });
      captureCardRef.current?.resetDoodle();
      applyRestoredCaptureStickers(persistedDraft.stickerPlacements);
      handleChangeNoteColor(persistedDraft.noteColor);
      setCaptureTarget(
        persistedDraft.captureTarget === 'shared' && sharedEnabled && user ? 'shared' : 'private'
      );
      setSelectedSharedAudienceUserId(
        persistedDraft.captureTarget === 'shared' ? persistedDraft.selectedSharedAudienceUserId : null
      );
      setCaptureDraftReady(true);
    }).catch(() => {
      if (captureDraftMountedRef.current) {
        setCaptureDraftReady(true);
      }
    });
  }, [
    captureDraftReady,
    applyRestoredCaptureStickers,
    clearPersistedCaptureDraft,
    handleChangeNoteColor,
    restoreCaptureState,
    sharedEnabled,
    user,
  ]);

  const buildPersistedCaptureDraft = useCallback((): PersistedCaptureDraft => ({
    version: 1,
    captureMode,
    cameraSubmode,
    noteText,
    capturedPhoto,
    capturedPairedVideo,
    dualPrimaryPhoto,
    dualSecondaryPhoto,
    dualPrimaryFacing,
    dualSecondaryFacing,
    facing,
    radius,
    selectedPhotoFilterId,
    noteColor,
    captureTarget,
    selectedSharedAudienceUserId,
    stickerPlacements: captureCardRef.current?.getStickerSnapshot().placements ?? [],
  }), [
      captureMode,
      cameraSubmode,
      noteText,
      capturedPhoto,
      capturedPairedVideo,
      dualPrimaryPhoto,
      dualSecondaryPhoto,
      dualPrimaryFacing,
      dualSecondaryFacing,
      facing,
      radius,
      selectedPhotoFilterId,
      noteColor,
      captureTarget,
      selectedSharedAudienceUserId,
    ]);

  const persistCaptureDraftNow = useCallback(async () => {
    if (!captureDraftReady) {
      return;
    }

    if (persistCaptureDraftTimeoutRef.current) {
      clearTimeout(persistCaptureDraftTimeoutRef.current);
      persistCaptureDraftTimeoutRef.current = null;
    }

    const nextDraft = buildPersistedCaptureDraft();

    if (!isPersistableCaptureDraft(nextDraft)) {
      await removePersistentItem(CAPTURE_DRAFT_STORAGE_KEY).catch(() => undefined);
      return;
    }

    await setPersistentItem(CAPTURE_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft)).catch(() => undefined);
  }, [buildPersistedCaptureDraft, captureDraftReady]);

  const schedulePersistCaptureDraft = useCallback(() => {
    if (!captureDraftReady) {
      return;
    }

    if (persistCaptureDraftTimeoutRef.current) {
      clearTimeout(persistCaptureDraftTimeoutRef.current);
    }

    persistCaptureDraftTimeoutRef.current = setTimeout(() => {
      persistCaptureDraftTimeoutRef.current = null;
      void persistCaptureDraftNow();
    }, 240);
  }, [captureDraftReady, persistCaptureDraftNow]);

  useEffect(() => {
    schedulePersistCaptureDraft();
    return () => {
      if (persistCaptureDraftTimeoutRef.current) {
        clearTimeout(persistCaptureDraftTimeoutRef.current);
        persistCaptureDraftTimeoutRef.current = null;
      }
    };
  }, [schedulePersistCaptureDraft]);

  const composeDualCapturePhoto = useCallback(
    async (capture: DualCameraStillCapture) => {
      const requestId = `dual-compose-${Date.now()}-${dualCaptureComposeRequestIdRef.current + 1}`;
      dualCaptureComposeRequestIdRef.current += 1;

      const composedUri = await new Promise<string | null>((resolve) => {
        dualCaptureComposeResolverRef.current = resolve;
        setDualCaptureComposeRequest({
          id: requestId,
          primaryUri: capture.primaryUri,
          secondaryUri: capture.secondaryUri,
          primaryFacing: capture.primaryFacing,
          secondaryFacing: capture.secondaryFacing,
        });
      });

      setDualCaptureComposeRequest(null);
      return composedUri;
    },
    []
  );

  const handleDualCaptureComposeComplete = useCallback(
    (requestId: string, result: { uri: string | null; error?: string | null }) => {
      if (dualCaptureComposeRequest?.id !== requestId) {
        return;
      }

      const resolver = dualCaptureComposeResolverRef.current;
      dualCaptureComposeResolverRef.current = null;
      setDualCaptureComposeRequest(null);

      if (result.error) {
        console.warn('[dual-capture] Failed to compose capture:', result.error);
      }

      resolver?.(result.uri);
    },
    [dualCaptureComposeRequest?.id]
  );

  const handleTakeDualPicture = useCallback(async () => {
    if (dualCaptureOperationInFlightRef.current) {
      return;
    }

    dualCaptureOperationInFlightRef.current = true;
    setDualCaptureOperationInProgress(true);

    try {
      if (dualCaptureUsesSequentialCapture) {
        const capturedUri = await capturePhotoFile();
        if (!capturedUri) {
          return;
        }

        const currentFacing = facing;
        setCapturedPairedVideo(null);

        if (!dualCaptureAwaitingSecondShot || !dualPrimaryPhoto || !dualPrimaryFacing) {
          setDualPrimaryPhoto(capturedUri);
          setDualPrimaryFacing(currentFacing);
          setDualSecondaryPhoto(null);
          setDualSecondaryFacing(null);
          setFacing(currentFacing === 'back' ? 'front' : 'back');
          return;
        }

        const result = createSequentialDualCameraStillCapture({
          firstShotUri: dualPrimaryPhoto,
          firstShotFacing: dualPrimaryFacing,
          secondShotUri: capturedUri,
          secondShotFacing: currentFacing,
        });

        const composedUri = await composeDualCapturePhoto(result);
        if (!composedUri) {
          throw new Error('Could not compose dual capture image.');
        }

        setDualSecondaryPhoto(capturedUri);
        setDualSecondaryFacing(currentFacing);
        setCapturedPhoto(composedUri);
        return;
      }

      if (!dualCameraPreviewRef.current) {
        return;
      }

      const result = await dualCameraPreviewRef.current.captureStill();
      const composedUri = await composeDualCapturePhoto(result);
      if (!composedUri) {
        throw new Error('Could not compose dual capture image.');
      }

      setCapturedPairedVideo(null);
      setDualPrimaryPhoto(result.primaryUri);
      setDualSecondaryPhoto(result.secondaryUri);
      setDualPrimaryFacing(result.primaryFacing);
      setDualSecondaryFacing(result.secondaryFacing);
      setCapturedPhoto(composedUri);
    } catch (error) {
      console.warn('[dual-capture] Capture failed:', error);
      if (dualCaptureUsesSequentialCapture) {
        clearDualCaptureState();
      }
      showAlert({
        variant: 'error',
        title: t('capture.error', 'Error'),
        message: t('capture.dualCaptureFailed', 'We could not capture both cameras right now.'),
        primaryAction: {
          label: t('common.done', 'Done'),
        },
      });
    } finally {
      dualCaptureOperationInFlightRef.current = false;
      setDualCaptureOperationInProgress(false);
    }
  }, [
    capturePhotoFile,
    clearDualCaptureState,
    composeDualCapturePhoto,
    dualCaptureAwaitingSecondShot,
    dualCaptureUsesSequentialCapture,
    dualPrimaryFacing,
    dualPrimaryPhoto,
    setCapturedPairedVideo,
    setCapturedPhoto,
    setFacing,
    setDualPrimaryFacing,
    setDualPrimaryPhoto,
    setDualSecondaryFacing,
    setDualSecondaryPhoto,
    showAlert,
    t,
    facing,
  ]);

  const handleResetDualCaptureSequence = useCallback(() => {
    const restartFacing = dualPrimaryFacing ?? facing;
    clearDualCaptureState();
    setCapturedPairedVideo(null);
    setFacing(restartFacing);
  }, [
    clearDualCaptureState,
    dualPrimaryFacing,
    facing,
    setCapturedPairedVideo,
    setFacing,
  ]);

  const clearInlineSaveTimers = useCallback(() => {
    if (finalizeInlineSaveTimeoutRef.current) {
      clearTimeout(finalizeInlineSaveTimeoutRef.current);
      finalizeInlineSaveTimeoutRef.current = null;
    }

    if (resetSaveStateTimeoutRef.current) {
      clearTimeout(resetSaveStateTimeoutRef.current);
      resetSaveStateTimeoutRef.current = null;
    }
  }, []);

  const releaseSuppressedHomeNoteId = useCallback((noteId: string) => {
    setSuppressedHomeNoteIds((current) => current.filter((id) => id !== noteId));
  }, []);

  useEffect(() => {
    return () => {
      clearInlineSaveTimers();
      if (persistCaptureDraftTimeoutRef.current) {
        clearTimeout(persistCaptureDraftTimeoutRef.current);
        persistCaptureDraftTimeoutRef.current = null;
      }
      setSavedNoteRevealActive(false);
    };
  }, [clearInlineSaveTimers, setSavedNoteRevealActive]);

  useEffect(() => {
    setSavedNoteRevealActive(Boolean(savedNoteRevealNote));
  }, [savedNoteRevealNote, setSavedNoteRevealActive]);

  const completeInlineSaveFlow = useCallback(
    (note: Note) => {
      const noteId = note.id;
      const finalizeDelay = reduceMotionEnabled ? 120 : 220;
      const resetStateDelay = reduceMotionEnabled ? 240 : 900;

      clearInlineSaveTimers();
      setSavedNoteRevealNote(note);
      setSavedNoteRevealToken((current) => current + 1);
      setSuppressedHomeNoteIds((current) => (current.includes(noteId) ? current : [...current, noteId]));
      setSaveButtonState('success');

      finalizeInlineSaveTimeoutRef.current = setTimeout(() => {
        releaseSuppressedHomeNoteId(noteId);
        finalizeSavedCapture();
        finalizeInlineSaveTimeoutRef.current = null;
      }, finalizeDelay);

      resetSaveStateTimeoutRef.current = setTimeout(() => {
        setSaveButtonState('idle');
        resetSaveStateTimeoutRef.current = null;
      }, resetStateDelay);
    },
    [clearInlineSaveTimers, finalizeSavedCapture, reduceMotionEnabled, releaseSuppressedHomeNoteId]
  );

  const queueScrollToSavedNote = useCallback((noteId?: string | null) => {
    if (!noteId) {
      return;
    }

    setPendingSavedNoteScrollTargetId(noteId);
  }, []);

  const handleSavedNoteRevealFinished = useCallback(() => {
    setSavedNoteRevealNote(null);
  }, []);

  const handleSettledArchiveItemChange = useCallback(
    (item: { id: string; kind: 'note' | 'shared-post' } | null) => {
      settledArchiveItemRef.current = item;
      if (!isScreenFocused) {
        return;
      }

      if (item) {
        setActiveFeedTarget(item);
        return;
      }

      clearActiveFeedTarget();
    },
    [clearActiveFeedTarget, isScreenFocused, setActiveFeedTarget]
  );

  useEffect(() => {
    if (!isScreenFocused) {
      clearActiveFeedTarget();
      return;
    }

    const focusTimer = setTimeout(() => {
      setActiveFeedTarget(settledArchiveItemRef.current);
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      clearActiveFeedTarget();
    };
  }, [clearActiveFeedTarget, isScreenFocused, setActiveFeedTarget]);

  useEffect(() => {
    if (!pendingSavedNoteScrollTargetId || suppressedHomeNoteIds.includes(pendingSavedNoteScrollTargetId)) {
      return;
    }
    const scheduledTargetId = pendingSavedNoteScrollTargetId;
    const targetIndex = findHomeFeedItemIndex(visibleFeedItems, {
      id: scheduledTargetId,
      kind: 'note',
    });
    if (targetIndex < 0) {
      return;
    }

    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled || pendingSavedNoteScrollTargetId !== scheduledTargetId) {
        return;
      }

      flatListRef.current?.scrollToOffset({
        offset: (targetIndex + 1) * snapHeight,
        animated: true,
      });
      setPendingSavedNoteScrollTargetId((current) => (current === scheduledTargetId ? null : current));
    });

    return () => {
      cancelled = true;
    };
  }, [pendingSavedNoteScrollTargetId, snapHeight, suppressedHomeNoteIds, visibleFeedItems]);

  useEffect(() => {
    const nextVisibleFeedItemKeys = visibleFeedItems.map(getHomeFeedItemKey);
    const previousVisibleFeedItemKeys = previousVisibleFeedItemKeysRef.current;
    previousVisibleFeedItemKeysRef.current = nextVisibleFeedItemKeys;

    if (!previousVisibleFeedItemKeys) {
      return;
    }

    const visibleFeedOrderChanged =
      previousVisibleFeedItemKeys.length !== nextVisibleFeedItemKeys.length ||
      previousVisibleFeedItemKeys.some((itemKey, index) => nextVisibleFeedItemKeys[index] !== itemKey);

    if (!visibleFeedOrderChanged) {
      return;
    }

    if (pendingSavedNoteScrollTargetId) {
      return;
    }

    const anchor = settledArchiveItemRef.current;
    if (!anchor) {
      return;
    }

    const targetIndex = findHomeFeedItemIndex(visibleFeedItems, anchor);
    if (targetIndex < 0) {
      return;
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: (targetIndex + 1) * snapHeight,
        animated: false,
      });
    });
  }, [pendingSavedNoteScrollTargetId, snapHeight, visibleFeedItems]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCaptureTarget('private');
      setSelectedSharedAudienceUserId(null);
      dismissSharedManageSheet();
    }
  }, [dismissSharedManageSheet, user]);

  useEffect(() => {
    setSuppressedHomeNoteIds([]);
    setPendingSavedNoteScrollTargetId(null);
    setSavedNoteRevealNote(null);
  }, [user?.uid]);

  useEffect(() => {
    if (!sharedEnabled || captureAudienceFriends.length === 0) {
      setCaptureTarget('private');
      setSelectedSharedAudienceUserId(null);
    }
  }, [captureAudienceFriends.length, sharedEnabled]);

  useEffect(() => {
    if (!selectedSharedAudienceUserId) {
      return;
    }

    const selectedGroupId = selectedSharedAudienceUserId.startsWith('group:')
      ? selectedSharedAudienceUserId.slice('group:'.length)
      : null;
    const selectedAudienceExists = selectedGroupId
      ? captureAudienceGroups.some((group) => group.id === selectedGroupId)
      : captureAudienceFriends.some((friend) => friend.userId === selectedSharedAudienceUserId);

    if (!selectedAudienceExists) {
      setSelectedSharedAudienceUserId(null);
    }
  }, [captureAudienceFriends, captureAudienceGroups, selectedSharedAudienceUserId]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissSharedManageSheet();
      };
    }, [dismissSharedManageSheet])
  );

  const pendingFeedFocusTarget = pendingFeedFocusRequest?.target ?? peekFeedFocus?.() ?? null;
  const pendingFeedFocusRequestId = pendingFeedFocusRequest?.requestId;

  useEffect(() => {
    if (!isScreenFocused || !pendingFeedFocusTarget) {
      return;
    }

    const target = pendingFeedFocusTarget;
    const isTargetDataReady =
      notesInitialLoadComplete &&
      (target.kind !== 'shared-post' || !sharedLoading);
    if (!isTargetDataReady) {
      return;
    }

    const settledItem = settledArchiveItemRef.current;
    if (settledItem?.kind === target.kind && settledItem.id === target.id) {
      clearFeedFocus?.(pendingFeedFocusRequestId);
      return;
    }

    const targetIndex = findHomeFeedItemIndex(visibleFeedItems, target);
    if (targetIndex < 0) {
      const targetExistsInHomeData =
        target.kind === 'note'
          ? notes.some((note) => note.id === target.id)
          : sharedPostsWithFriendNicknames.some(
              (post) =>
                post.id === target.id &&
                (!sharedEnabled || !user?.uid || post.authorUid !== user.uid)
            );

      if (target.kind === 'note' && isFriendsFilterEnabled && targetExistsInHomeData) {
        setIsFriendsFilterEnabled(false);
        return;
      }

      if (target.kind === 'shared-post' && targetExistsInHomeData) {
        requestPromoteSharedPosts();
        return;
      }

      if (targetExistsInHomeData) {
        return;
      }

      clearFeedFocus?.(pendingFeedFocusRequestId);
      return;
    }

    let cancelled = false;
    const focusTimeout = setTimeout(() => {
      if (cancelled) {
        return;
      }

      clearFeedFocus?.(pendingFeedFocusRequestId);
      flatListRef.current?.scrollToOffset({
        offset: (targetIndex + 1) * snapHeight,
        animated: true,
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(focusTimeout);
    };
  }, [
    clearFeedFocus,
    isFriendsFilterEnabled,
    isScreenFocused,
    notes,
    notesInitialLoadComplete,
    pendingFeedFocusRequestId,
    pendingFeedFocusTarget,
    requestPromoteSharedPosts,
    sharedEnabled,
    sharedLoading,
    sharedPostsWithFriendNicknames,
    snapHeight,
    user?.uid,
    visibleFeedItems,
  ]);

  const { refreshing, refreshHome } = useHomeRefresh({
    hasNetworkRefreshWork: Boolean(user && sharedEnabled),
    refreshNotes,
    refreshSharedFeed: user && sharedEnabled ? refreshSharedFeed : undefined,
    onAfterLocalRefresh: () => {
      setSuppressedHomeNoteIds([]);
    },
    onAfterNetworkRefresh: requestPromoteSharedPosts,
  });
  const handleRefreshHome = useCallback(() => {
    void refreshHome();
  }, [refreshHome]);

  const showDoneSheet = useCallback(
    (
      variant: 'error' | 'warning' | 'success',
      title: string,
      message: string,
      withSettingsAction = false
    ) => {
      showAlert({
        variant,
        title,
        message,
        primaryAction: withSettingsAction
          ? {
              label: t('common.openSettings', 'Open Settings'),
              onPress: async () => {
                await openAppSettings();
              },
            }
          : {
              label: t('common.done', 'Done'),
            },
        secondaryAction: withSettingsAction
          ? {
              label: t('common.done', 'Done'),
              variant: 'secondary',
            }
          : undefined,
      });
    },
    [openAppSettings, showAlert, t]
  );

  const getReminderPermissionUnavailableMessage = useCallback(
    (result: ReminderPermissionRequestResult) => {
      if (result.reason === 'foreground_denied') {
        return result.requiresSettings
          ? t(
              'capture.remindersForegroundSettingsMsg',
              'Location access is blocked for Noto. Open Settings to turn location back on, then enable reminders.'
            )
          : t(
              'capture.remindersForegroundMsg',
              'Noto needs location access before it can set up place reminders.'
            );
      }

      if (result.reason === 'background_denied') {
        return result.requiresSettings
          ? t(
              'capture.remindersBackgroundSettingsMsg',
              'Background location is still off for Noto. Open Settings and choose Always Allow to enable reminders.'
            )
          : t(
              'capture.remindersBackgroundMsg',
              'Background location is still off. Noto needs it to remind you after you leave the app.'
            );
      }

      if (result.reason === 'notifications_denied') {
        return result.requiresSettings
          ? t(
              'capture.remindersNotificationSettingsMsg',
              'Notifications are blocked for Noto. Open Settings to turn them back on, then enable reminders.'
            )
          : t(
              'capture.remindersNotificationMsg',
              'Notifications are still off. Noto needs them to deliver nearby reminders.'
            );
      }

      if (result.reason === 'feature_disabled') {
        return t(
          'capture.remindersFeatureDisabledMsg',
          'Background reminders are not available in this build.'
        );
      }

      return t(
        'capture.remindersSetupFailedMsg',
        'Noto could not finish setting up nearby reminders. Please try again in a moment.'
      );
    },
    [t]
  );

  const promptReminderPermissionsFromDisclosure = useCallback(() => {
    showAlert({
      variant: 'info',
      title: t('capture.reminderDisclosureTitle', 'Enable background reminders'),
      message: t(
        'capture.reminderDisclosureMsg',
        'This app collects location data to remind you when you return to a saved place, even when the app is closed or not in use. Noto only uses this data for nearby note reminders.'
      ),
      primaryAction: {
        label: t('common.continue', 'Continue'),
        closeOnPress: false,
        onPress: async () => {
          const result = await requestReminderPermissions();
          if (result.enabled) {
            showAlert({
              variant: 'success',
              title: t('capture.remindersEnabledTitle', 'Reminders enabled'),
              message: t(
                'capture.remindersEnabledMsg',
                'Noto will remind you when you return to saved places.'
              ),
              primaryAction: {
                label: t('common.done', 'Done'),
              },
            });
            return;
          }

          if (result.requiresSettings) {
            showDoneSheet(
              'warning',
              t('capture.remindersUnavailableTitle', 'Reminders still off'),
              getReminderPermissionUnavailableMessage(result),
              true
            );
            return;
          }

          showDoneSheet(
            'warning',
            t('capture.remindersUnavailableTitle', 'Reminders still off'),
            getReminderPermissionUnavailableMessage(result)
          );
        },
      },
      secondaryAction: {
        label: t('common.cancel', 'Cancel'),
        variant: 'secondary',
      },
    });
  }, [getReminderPermissionUnavailableMessage, requestReminderPermissions, showAlert, showDoneSheet, t]);

  useEffect(() => {
    if (remindersEnabled || notes.length === 0 || syncBootstrapState !== 'complete') {
      return;
    }

    const reminderGroups = getReminderPlaceGroups(notes);
    if (reminderGroups.length === 0) {
      return;
    }

    const promptScope = user?.uid?.trim() || 'local';
    const promptKey = `${REMINDER_RECOVERY_PROMPT_KEY_PREFIX}${promptScope}`;
    let cancelled = false;

    void getPersistentItem(promptKey)
      .then((storedValue) => {
        if (cancelled || storedValue === '1') {
          return;
        }

        return refreshPermissions()
          .then((permissionState) => {
            if (cancelled || permissionState.remindersEnabled) {
              return false;
            }

            return setPersistentItem(promptKey, '1').then(() => true);
          })
          .then((shouldShowPrompt) => {
            if (cancelled || !shouldShowPrompt) {
              return;
            }

            showAlert({
              variant: 'info',
              title: t('capture.reminderRecoveryTitle', 'Enable reminders for your saved places'),
              message: t(
                'capture.reminderRecoveryMsg',
                'Noto found saved places in your journal. Turn on background location and notifications if you want a reminder when you return.'
              ),
              primaryAction: {
                label: t('capture.enableReminders', 'Enable reminders'),
                closeOnPress: false,
                onPress: promptReminderPermissionsFromDisclosure,
              },
              secondaryAction: {
                label: t('common.notNow', 'Not now'),
                variant: 'secondary',
              },
            });
          });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    notes,
    promptReminderPermissionsFromDisclosure,
    refreshPermissions,
    remindersEnabled,
    showAlert,
    syncBootstrapState,
    t,
    user?.uid,
  ]);

  const showSharedUnavailableSheet = useCallback(() => {
    showAlert({
      variant: 'info',
      title: t('shared.unavailableTitle', 'Shared moments unavailable'),
      message: t(
        'shared.unavailableBody',
        'This build does not have shared social enabled right now.'
      ),
      primaryAction: {
        label: t('common.done', 'Done'),
      },
    });
  }, [showAlert, t]);

  const { placePulseSummary, sharedPlacePulseSummary } = useHomePlacePulse({
    captureTarget,
    location,
    notes,
    sharedEnabled,
    sharedPosts: sharedPostsWithFriendNicknames,
    sharedReady,
    userUid: user?.uid,
  });
  const memoryPromptSuggestion = useMemo(
    () => buildMemoryPromptSuggestion({
      captureMode,
      location,
      notes,
    }),
    [captureMode, location, notes]
  );
  const memoryPromptText = useMemo(
    () => t(`memoryPrompts.${memoryPromptSuggestion.id}`, memoryPromptSuggestion.text),
    [memoryPromptSuggestion.id, memoryPromptSuggestion.text, t]
  );

  const handlePlacePulsePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    if (placePulseSummary.targetNoteId) {
      if (isFriendsFilterEnabled) {
        setIsFriendsFilterEnabled(false);
      }

      setPendingSavedNoteScrollTargetId(placePulseSummary.targetNoteId);
      return;
    }

    flatListRef.current?.scrollToOffset({ offset: snapHeight, animated: true });
  }, [isFriendsFilterEnabled, placePulseSummary.targetNoteId, snapHeight]);

  const handleSharedPlacePulsePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    if (!sharedPlacePulseSummary.targetPostId) {
      return;
    }

    requestFeedFocus({
      kind: 'shared-post',
      id: sharedPlacePulseSummary.targetPostId,
    });
  }, [requestFeedFocus, sharedPlacePulseSummary.targetPostId]);

  const {
    handleCaptureTargetChange,
    handleCreateInvite,
    handleOpenSharedManage,
    handleRemoveFriend,
    handleRevokeInvite,
    handleShareInvite,
    inviteActionInFlight,
  } = useHomeSharedActions({
    user,
    sharedEnabled,
    isAuthAvailable,
    friendsCount: friends.length,
    activeInvite,
    createFriendInvite,
    revokeFriendInvite,
    removeFriend,
    dismissSharedManageSheet,
    presentSharedManageSheet,
    openAuthForShare,
    showSharedUnavailableSheet,
    setCaptureTarget,
    onAfterSharedFeedMutation: requestPromoteSharedPosts,
  });

  const handleShareTargetChange = useCallback(
    (nextTarget: 'private' | 'shared') => {
      if (nextTarget === captureTarget) {
        return;
      }

      handleCaptureTargetChange(nextTarget);
    },
    [captureTarget, handleCaptureTargetChange]
  );

  const shouldShowMemoryPrompt =
    !(captureTarget === 'shared' && captureAudienceFriends.length > 0) &&
    sharedPlacePulseSummary.nearbySharedPostCount <= 0 &&
    (!location || placePulseSummary.nearbyNoteCount <= 0);

  const captureFooterContent = useMemo(() => {
    if (captureTarget === 'shared' && captureAudienceFriends.length > 0) {
      return (
        <CaptureAudienceStrip
          friends={captureAudienceFriends}
          friendGroups={captureAudienceGroups}
          selectedFriendUid={selectedSharedAudienceUserId}
          onSelectFriendUid={setSelectedSharedAudienceUserId}
          t={t}
        />
      );
    }

    if (sharedPlacePulseSummary.nearbySharedPostCount > 0) {
      return (
        <SharedPlacePulseStrip
          avatars={sharedPlacePulseSummary.avatars}
          overflowCount={sharedPlacePulseSummary.overflowCount}
          accessibilityLabel={
            sharedPlacePulseSummary.nearbySharedPostCount === 1
              ? t(
                  'home.sharedPlacePulseA11ySingle',
                  'Open 1 nearby shared post from a friend'
                )
              : t(
                  'home.sharedPlacePulseA11yPlural',
                  'Open {{count}} nearby shared posts from friends',
                  {
                    count: sharedPlacePulseSummary.nearbySharedPostCount,
                  }
                )
          }
          onPress={handleSharedPlacePulsePress}
        />
      );
    }

    if (shouldShowMemoryPrompt) {
      return (
        <PlacePulseStrip
          iconName="create-outline"
          label={memoryPromptText}
          accessibilityLabel={t('capture.memoryPromptA11y', 'Suggested memory prompt: {{prompt}}', {
            prompt: memoryPromptText,
          })}
        />
      );
    }

    if (!location) {
      return null;
    }

    if (placePulseSummary.nearbyNoteCount <= 0) {
      return null;
    }

    return (
      <PlacePulseStrip
        label={
          placePulseSummary.nearbyNoteCount === 1
            ? t('home.placePulseNearbySingle', '1 nearby memory')
            : t('home.placePulseNearbyPlural', '{{count}} nearby memories', {
                count: placePulseSummary.nearbyNoteCount,
              })
        }
        onPress={handlePlacePulsePress}
      />
    );
  }, [
    captureTarget,
    captureAudienceFriends,
    captureAudienceGroups,
    handlePlacePulsePress,
    handleSharedPlacePulsePress,
    location,
    memoryPromptText,
    placePulseSummary.nearbyNoteCount,
    selectedSharedAudienceUserId,
    shouldShowMemoryPrompt,
    sharedPlacePulseSummary.avatars,
    sharedPlacePulseSummary.nearbySharedPostCount,
    sharedPlacePulseSummary.overflowCount,
    t,
  ]);

  const showSavedSheet = useCallback((noteId?: string | null) => {
    const releaseSavedNote = () => {
      if (noteId) {
        releaseSuppressedHomeNoteId(noteId);
      }
    };

    if (remindersEnabled) {
      showAlert({
        variant: 'success',
        title: t('capture.saved', 'Saved!'),
        message: t('capture.savedMsg', "We'll remind you next time you're here!"),
        primaryAction: {
          label: t('common.done', 'Done'),
        },
      });
      return;
    }

    showAlert({
      variant: 'success',
      title: t('capture.savedLocalTitle', 'Saved locally'),
      message: t(
        'capture.savedLocalMsg',
        'Your note is saved on this device. Enable reminders to get notified when you revisit this place.'
      ),
      onClose: releaseSavedNote,
      primaryAction: {
        label: t('capture.enableReminders', 'Enable reminders'),
        closeOnPress: false,
        onPress: promptReminderPermissionsFromDisclosure,
      },
      secondaryAction: {
        label: t('common.done', 'Done'),
        variant: 'secondary',
        onPress: () => {
          queueScrollToSavedNote(noteId);
        },
      },
    });
  }, [promptReminderPermissionsFromDisclosure, queueScrollToSavedNote, releaseSuppressedHomeNoteId, remindersEnabled, showAlert, t]);

  const showSharedSaveSheet = useCallback(
    (status: 'shared' | 'no-friends' | 'share-failed', failureMessage?: string | null, noteId?: string | null) => {
      const releaseSavedNote = () => {
        if (noteId) {
          releaseSuppressedHomeNoteId(noteId);
        }
      };

      if (status === 'shared') {
        showAlert({
          variant: 'success',
          title: t('shared.savedSharedTitle', 'Saved and shared'),
          message: t(
            'shared.savedSharedBody',
            'This note is in your journal and has been published to your shared Home feed.'
          ),
          primaryAction: {
            label: t('common.done', 'Done'),
          },
        });
        return;
      }

      if (status === 'no-friends') {
        showAlert({
          variant: 'warning',
          title: t('shared.savedLocalOnlyTitle', 'Saved for now'),
          message: t(
            'shared.savedLocalOnlyBody',
            'Your note is saved locally. Invite a friend to start sharing moments from Home.'
          ),
          onClose: releaseSavedNote,
          primaryAction: {
            label: t('shared.inviteFriendButton', 'Invite friend'),
            onPress: () => {
              presentSharedManageSheet();
            },
          },
          secondaryAction: {
            label: t('common.done', 'Done'),
            variant: 'secondary',
            onPress: () => {
              queueScrollToSavedNote(noteId);
            },
          },
        });
        return;
      }

      showAlert({
        variant: 'warning',
        title: t('shared.sharePublishFailedTitle', 'Saved, but not shared'),
        message: [
          t(
            'shared.sharePublishFailedBody',
            'Your note is safe in your journal, but we could not publish it to the shared feed right now.'
          ),
          failureMessage?.trim() || null,
        ]
          .filter(Boolean)
          .join('\n\n'),
        onClose: releaseSavedNote,
        primaryAction: {
          label: t('common.done', 'Done'),
          onPress: () => {
            queueScrollToSavedNote(noteId);
          },
        },
      });
    },
    [presentSharedManageSheet, queueScrollToSavedNote, releaseSuppressedHomeNoteId, showAlert, t]
  );

  const showPlusSheet = useCallback(
    (reason: 'limit' | 'filter' | 'color') => {
      const title =
        reason === 'filter'
          ? t('plus.filterTitle', 'Premium photo filters')
          : reason === 'color'
            ? t('plus.colorTitle', 'Premium card finishes')
            : t('plus.limitTitle', 'Photo limit reached');
      const message =
        reason === 'filter'
          ? t(
              'plus.filterMessage',
              'Warm, cool, mono, vivid, and vintage filters are part of Noto Plus.'
            )
          : reason === 'color'
            ? t(
                'plus.colorMessage',
                'Holographic, RGB, and foil-inspired card finishes are part of Noto Plus.'
              )
            : t(
              'plus.limitMessage',
              'Free plan includes 5 photo memories per day. Upgrade to Noto Plus for unlimited photo saves, premium filters, and premium finishes.'
            );

      showAlert({
        variant: 'info',
        title,
        message,
        primaryAction: isPurchaseAvailable
          ? {
              label: plusPriceLabel
                ? t('plus.upgradeCtaWithPrice', 'Upgrade to Plus · {{price}}', {
                    price: plusPriceLabel,
                  })
                : t('plus.upgradeCta', 'Upgrade to Plus'),
              onPress: async () => {
                const result = await presentPaywallIfNeeded();
                if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
                  showAlert({
                    variant: 'success',
                    title: t('plus.upgradeSuccessTitle', 'Noto Plus is ready'),
                    message: t(
                      'plus.upgradeSuccessMessage',
                      'You can now use premium photo filters, save unlimited photo notes, and keep the premium card finishes too.'
                    ),
                    primaryAction: {
                      label: t('common.done', 'Done'),
                    },
                  });
                  return;
                }

                if (result === PAYWALL_RESULT.CANCELLED || result === PAYWALL_RESULT.NOT_PRESENTED) {
                  return;
                }

                showAlert({
                  variant: 'warning',
                  title: t('plus.upgradeUnavailableTitle', 'Noto Plus unavailable'),
                  message: t(
                    'plus.upgradeUnavailableMessage',
                    'We could not complete the purchase right now. Please try again in a moment.'
                  ),
                  primaryAction: {
                    label: t('common.done', 'Done'),
                  },
                });
              },
            }
          : {
              label: t('common.done', 'Done'),
            },
        secondaryAction: isPlusConfigured
          ? {
              label: t('plus.restorePurchases', 'Restore purchases'),
              variant: 'secondary',
              onPress: async () => {
                const result = await restorePurchases();
                if (result.status === 'success') {
                  showAlert({
                    variant: 'success',
                    title: t('plus.restoreSuccessTitle', 'Purchases restored'),
                    message: t(
                      'plus.restoreSuccessMessage',
                      'Your Noto Plus access has been refreshed for this device.'
                    ),
                    primaryAction: {
                      label: t('common.done', 'Done'),
                    },
                  });
                  return;
                }

                showAlert({
                  variant: 'warning',
                  title: t('plus.restoreFailedTitle', 'Could not restore purchases'),
                  message:
                    result.message ??
                    t(
                      'plus.restoreFailedMessage',
                      'We could not refresh your purchases right now. Please try again later.'
                    ),
                  primaryAction: {
                    label: t('common.done', 'Done'),
                  },
                });
              },
            }
          : undefined,
      });
    },
    [
      isPlusConfigured,
      isPurchaseAvailable,
      plusPriceLabel,
      presentPaywallIfNeeded,
      restorePurchases,
      showAlert,
      t,
    ]
  );

  const promptHologramSaveChoice = useCallback(() => {
    return new Promise<'upgrade-success' | 'switch' | 'cancel'>((resolve) => {
      let settled = false;
      const settle = (value: 'upgrade-success' | 'switch' | 'cancel') => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(value);
      };

      showAppAlert(
        t('plus.hologramSaveTitle', 'Save this hologram card with Plus'),
        t(
          'plus.hologramSaveMessage',
          'The hologram finish is ready to preview. Upgrade to Plus to save it, or switch back to a standard finish.'
        ),
        [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
            onPress: () => settle('cancel'),
          },
          {
            text: t('plus.useStandardFinish', 'Use standard finish'),
            onPress: () => settle('switch'),
          },
          {
            text: plusPriceLabel
              ? t('plus.upgradeCtaWithPrice', 'Upgrade to Plus · {{price}}', {
                  price: plusPriceLabel,
                })
              : t('plus.upgradeCta', 'Upgrade to Plus'),
            onPress: () => {
              void (async () => {
                if (!isPurchaseAvailable) {
                  showAppAlert(
                    t('plus.upgradeUnavailableTitle', 'Plus unavailable'),
                    t(
                      'plus.upgradeUnavailableMessage',
                      'We could not complete the purchase right now. Please try again in a moment.'
                    )
                  );
                  settle('cancel');
                  return;
                }

                const result = await presentPaywallIfNeeded();
                if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
                  settle('upgrade-success');
                  return;
                }

                if (result === PAYWALL_RESULT.CANCELLED || result === PAYWALL_RESULT.NOT_PRESENTED) {
                  settle('cancel');
                  return;
                }

                showAppAlert(
                  t('plus.upgradeUnavailableTitle', 'Plus unavailable'),
                  t(
                    'plus.upgradeUnavailableMessage',
                    'We could not complete the purchase right now. Please try again in a moment.'
                  )
                );
                settle('cancel');
              })();
            },
          },
        ]
      );
    });
  }, [isPurchaseAvailable, plusPriceLabel, presentPaywallIfNeeded, t]);

  useEffect(() => {
    if (lockedPremiumPhotoFilterIds.includes(selectedPhotoFilterId)) {
      setSelectedPhotoFilterId('original');
    }
  }, [lockedPremiumPhotoFilterIds, selectedPhotoFilterId, setSelectedPhotoFilterId]);

  const handleChangePhotoFilter = useCallback(
    (filterId: PhotoFilterId) => {
      if (lockedPremiumPhotoFilterIds.includes(filterId)) {
        showPlusSheet('filter');
        return;
      }

      setSelectedPhotoFilterId(filterId);
    },
    [lockedPremiumPhotoFilterIds, setSelectedPhotoFilterId, showPlusSheet]
  );

  const getLocationUnavailableMessage = useCallback(
    (locationResult: Pick<ForegroundLocationRequestResult, 'reason' | 'requiresSettings'>) => {
      if (locationResult.reason === 'services_disabled') {
        return t(
          'capture.noLocationServices',
          'Turn on Location Services/GPS, then try saving your memory again.'
        );
      }

      if (locationResult.requiresSettings) {
        return t(
          'capture.noLocationSettings',
          'Noto needs location access to save a memory here. Open Settings to turn location access back on.'
        );
      }

      if (locationResult.reason === 'permission_denied') {
        return t(
          'capture.noLocationPermission',
          'Noto needs your location to save a memory here. Allow location access and try again.'
        );
      }

      if (locationResult.reason === 'timeout') {
        return t(
          'capture.noLocationTimeout',
          'Noto is still waiting for a GPS fix. Move to a clearer spot and try again in a moment.'
        );
      }

      return t(
        'capture.noLocation',
        'Noto could not get your current location yet. Please try again in a moment.'
      );
    },
    [t]
  );

  const scrollCaptureToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleEmptyStateTakePhoto = useCallback(() => {
    scrollCaptureToTop();
    if (captureMode !== 'camera') {
      setCaptureMode('camera');
    }
  }, [captureMode, scrollCaptureToTop, setCaptureMode]);

  const handleEmptyStateWriteOneSentence = useCallback(() => {
    scrollCaptureToTop();
    if (captureMode !== 'text') {
      setCaptureMode('text');
    }
  }, [captureMode, scrollCaptureToTop, setCaptureMode]);

  const homeFeedEmptyState = useMemo(() => {
    if (feedMode === 'content') {
      return null;
    }

    return (
      <HomeFeedEmptyState
        mode={feedMode}
        bootstrapState={bootstrapState}
        colors={colors}
        t={t}
        onDisableFriendsFilter={() => {
          setIsFriendsFilterEnabled(false);
        }}
        onOpenFriends={presentSharedManageSheet}
        onRetryBootstrap={requestSync}
        onTakePhotoHere={handleEmptyStateTakePhoto}
        onWriteOneSentence={handleEmptyStateWriteOneSentence}
      />
    );
  }, [
    bootstrapState,
    colors,
    feedMode,
    handleEmptyStateTakePhoto,
    handleEmptyStateWriteOneSentence,
    presentSharedManageSheet,
    requestSync,
    t,
  ]);
  const feedRefreshing = refreshing;

  const saveNote = useCallback(async () => {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    let saveOutcome = 'unknown';
    const saveSpan = startAppSpan('capture', 'capture.save-note', {
      cameraSubmode,
      captureMode,
      captureTarget,
      hasCapturedPhoto: Boolean(capturedPhoto),
      hasLivePhotoVideo: Boolean(capturedPairedVideo),
      photoFilter: selectedPhotoFilterId,
      signedIn: Boolean(user),
    });

    try {
      const doodleSnapshot = captureCardRef.current?.getDoodleSnapshot() ?? {
        enabled: false,
        strokes: [],
      };
      const stickerSnapshot = captureCardRef.current?.getStickerSnapshot() ?? {
        enabled: false,
        placements: [],
      };

      if (
        captureMode === 'text' &&
        !noteText.trim() &&
        doodleSnapshot.strokes.length === 0 &&
        stickerSnapshot.placements.length === 0
      ) {
        saveOutcome = 'validation_empty_text';
        showDoneSheet(
          'warning',
          t('capture.error', 'Error'),
          t('capture.noText', 'Please write a note or add a doodle')
        );
        return;
      }

      if (captureMode === 'camera' && !capturedPhoto) {
        saveOutcome = 'validation_missing_photo';
        showDoneSheet(
          'warning',
          t('capture.error', 'Error'),
          t('capture.noPhoto', 'Please take a photo first')
        );
        return;
      }

      if (captureMode === 'camera' && !isPhotoNoteQuotaReady) {
        saveOutcome = 'quota_not_ready';
        showDoneSheet(
          'warning',
          t('capture.photoLimitCheckingTitle', 'Checking today\'s photo limit'),
          t(
            'capture.photoLimitCheckingMessage',
            'We are still loading your photo usage for today. Try again in a moment.'
          )
        );
        return;
      }

      if (captureMode === 'camera' && !canSaveAnotherPhotoNote) {
        saveOutcome = 'quota_limit';
        showPlusSheet('limit');
        return;
      }

      if (captureMode === 'text') {
        const saveDecision = getPremiumNoteSaveDecision({
          tier,
          selectedNoteColor: noteColor,
        });

        if (saveDecision === 'upsell_required') {
          const choice = await promptHologramSaveChoice();
          if (choice === 'switch') {
            setNoteColor(getFallbackFreeNoteColor(lastFreeNoteColorRef.current, noteColor));
          }
          if (choice !== 'upgrade-success') {
            saveOutcome = `premium_${choice}`;
            return;
          }
        }
      }

      clearInlineSaveTimers();
      setSaveButtonState('saving');
      setSaving(true);

      const mapSaveCoordinate = pendingMapSaveCoordinate;
      let currentLocation = location;
      let locationResult: ForegroundLocationRequestResult = {
        location: currentLocation,
        requiresSettings: false,
        reason: null,
      };
      let saveCoordinate: MapSaveCoordinate | null = mapSaveCoordinate;

      if (!saveCoordinate && !currentLocation) {
        try {
          locationResult = await requestForegroundLocation();
        } catch (error) {
          console.warn('Location request failed while saving note:', error);
          locationResult = {
            location: null,
            requiresSettings: false,
            reason: 'unavailable',
          };
        }
        currentLocation = locationResult.location;
      }

      if (!saveCoordinate && currentLocation) {
        saveCoordinate = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
      }

      if (!saveCoordinate) {
        saveOutcome = 'location_unavailable';
        setSaveButtonState('idle');
        showDoneSheet(
          'error',
          t('capture.locationUnavailableTitle', 'Location unavailable'),
          getLocationUnavailableMessage(locationResult),
          locationResult.requiresSettings
        );
        return;
      }

      let destinationPath: string | null = null;
      let pairedVideoDestinationPath: string | null = null;
      let dualPrimaryDestinationPath: string | null = null;
      let dualSecondaryDestinationPath: string | null = null;
      const pendingNoteId = generateNoteId();
      setSuppressedHomeNoteIds((current) =>
        current.includes(pendingNoteId) ? current : [...current, pendingNoteId]
      );

      try {
        const doodleStrokesJson =
          doodleSnapshot.strokes.length > 0
            ? JSON.stringify(doodleSnapshot.strokes)
            : null;
        const stickerPlacementsJson =
          stickerSnapshot.placements.length > 0
            ? JSON.stringify(stickerSnapshot.placements)
            : null;
        const lat = saveCoordinate.latitude;
        const lon = saveCoordinate.longitude;
        const geocodedName = await resolveLocationNameFromCoordinates(lat, lon);
        const locationName = geocodedName ?? t('capture.unknownPlace', 'Unknown Place');

        let content = noteText.trim();

        if (captureMode === 'camera' && capturedPhoto) {
          const directory = `${FileSystem.documentDirectory}photos/`;
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
          const filename =
            cameraSubmode === 'dual' ? `note-${Date.now()}.png` : `note-${Date.now()}.jpg`;
          destinationPath = `${directory}${filename}`;
          if (cameraSubmode === 'dual') {
            await FileSystem.copyAsync({ from: capturedPhoto, to: destinationPath });
          } else if (selectedPhotoFilterId === 'original') {
            await FileSystem.copyAsync({ from: capturedPhoto, to: destinationPath });
          } else {
            await renderFilteredPhotoToFile(capturedPhoto, destinationPath, selectedPhotoFilterId);
          }
          content = destinationPath;
        }
        if (captureMode === 'camera' && cameraSubmode === 'dual') {
          const directory = `${FileSystem.documentDirectory}photos/`;
          if (dualPrimaryPhoto) {
            dualPrimaryDestinationPath = `${directory}${pendingNoteId}-dual-primary.jpg`;
            await FileSystem.copyAsync({ from: dualPrimaryPhoto, to: dualPrimaryDestinationPath });
          }
          if (dualSecondaryPhoto) {
            dualSecondaryDestinationPath = `${directory}${pendingNoteId}-dual-secondary.jpg`;
            await FileSystem.copyAsync({ from: dualSecondaryPhoto, to: dualSecondaryDestinationPath });
          }
        }
        if (captureMode === 'camera' && capturedPairedVideo) {
          pairedVideoDestinationPath = await persistLivePhotoVideo(
            capturedPairedVideo,
            `${pendingNoteId}-motion`,
            tier
          );
        }

        const autoEmoji = resolveAutoNoteEmoji({
          type: captureMode === 'camera' ? 'photo' : 'text',
          content: captureMode === 'camera' ? locationName : content,
          locationName,
        });
        const persistedTextNoteColor =
          captureMode === 'text'
            ? resolveSavedTextNoteColor(noteColor, {
                appTheme,
                colorScheme: isDark ? 'dark' : 'light',
              })
            : null;

        const promptAnswer = noteText.trim();
        const shouldSavePrompt =
          shouldShowMemoryPrompt &&
          promptAnswer.length > 0 &&
          memoryPromptText.trim().length > 0;
        const createdNote = await createNote({
          id: pendingNoteId,
          type: captureMode === 'camera' ? 'photo' : 'text',
          content,
          caption: captureMode === 'camera' ? noteText.trim() || null : null,
          photoLocalUri: captureMode === 'camera' ? content : null,
          isLivePhoto: captureMode === 'camera' && Boolean(pairedVideoDestinationPath),
          pairedVideoLocalUri:
            captureMode === 'camera' ? pairedVideoDestinationPath : null,
          locationName,
          promptId: shouldSavePrompt ? memoryPromptSuggestion.id : null,
          promptTextSnapshot: shouldSavePrompt ? memoryPromptText : null,
          promptAnswer: shouldSavePrompt ? promptAnswer : null,
          moodEmoji: autoEmoji,
          noteColor: persistedTextNoteColor,
          captureVariant: captureMode === 'camera' ? (cameraSubmode === 'dual' ? 'dual' : 'single') : null,
          dualPrimaryPhotoLocalUri:
            captureMode === 'camera' && cameraSubmode === 'dual'
              ? dualPrimaryDestinationPath
              : null,
          dualSecondaryPhotoLocalUri:
            captureMode === 'camera' && cameraSubmode === 'dual'
              ? dualSecondaryDestinationPath
              : null,
          dualPrimaryFacing:
            captureMode === 'camera' && cameraSubmode === 'dual'
              ? dualPrimaryFacing
              : null,
          dualSecondaryFacing:
            captureMode === 'camera' && cameraSubmode === 'dual'
              ? dualSecondaryFacing
              : null,
          dualLayoutPreset:
            captureMode === 'camera' && cameraSubmode === 'dual'
              ? 'top-left'
              : null,
          dualComposedPhotoLocalUri:
            captureMode === 'camera' && cameraSubmode === 'dual'
              ? destinationPath
              : null,
          latitude: lat,
          longitude: lon,
          radius,
          hasDoodle: Boolean(doodleStrokesJson),
          doodleStrokesJson,
          hasStickers: Boolean(stickerPlacementsJson),
          stickerPlacementsJson,
        });

        if (doodleStrokesJson) {
          await saveNoteDoodle(createdNote.id, doodleStrokesJson);
        }
        if (stickerSnapshot.placements.length > 0) {
          await saveNoteStickerPlacementsWithAssets(createdNote.id, stickerSnapshot.placements);
        }

        let shareOutcome: 'default' | 'shared' | 'no-friends' | 'share-failed' = 'default';
        let shareFailureMessage: string | null = null;

        if (captureTarget === 'shared' && sharedEnabled && user) {
          if (captureAudienceFriends.length === 0) {
            shareOutcome = 'no-friends';
          } else {
            try {
              const selectedGroupId = selectedSharedAudienceUserId?.startsWith('group:')
                ? selectedSharedAudienceUserId.slice('group:'.length)
                : null;
              const selectedGroup = selectedGroupId
                ? captureAudienceGroups.find((group) => group.id === selectedGroupId)
                : null;
              const selectedAudienceUserIds = selectedGroup
                ? selectedGroup.memberUserIds
                : selectedSharedAudienceUserId
                  ? [selectedSharedAudienceUserId]
                  : undefined;

              await createSharedPost(
                createdNote,
                selectedAudienceUserIds
              );
              shareOutcome = 'shared';
            } catch (shareError) {
              shareFailureMessage = getSharedFeedErrorMessage(shareError);
              console.warn('Shared publish failed:', shareFailureMessage);
              shareOutcome = 'share-failed';
            }
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (mapSaveCoordinate) {
          setPendingMapSaveCoordinate(null);
        }

        if (shareOutcome === 'default' && remindersEnabled) {
          saveOutcome = 'saved_inline_reminder';
          completeInlineSaveFlow(createdNote);
        } else if (shareOutcome === 'shared') {
          saveOutcome = 'saved_shared';
          completeInlineSaveFlow(createdNote);
        } else if (shareOutcome === 'default') {
          saveOutcome = 'saved_private';
          setSaveButtonState('idle');
          finalizeSavedCapture();
          showSavedSheet(createdNote.id);
        } else {
          saveOutcome = shareOutcome;
          setSaveButtonState('idle');
          finalizeSavedCapture();
          showSharedSaveSheet(shareOutcome, shareFailureMessage, createdNote.id);
        }
      } catch (error) {
        saveOutcome = 'failed';
        console.error('Save failed:', error);
        setSaveButtonState('idle');
        setSuppressedHomeNoteIds((current) => current.filter((id) => id !== pendingNoteId));
        if (destinationPath) {
          try {
            await FileSystem.deleteAsync(destinationPath, { idempotent: true });
          } catch (cleanupError) {
            console.warn('Failed to clean up orphaned photo file:', cleanupError);
          }
        }
        if (pairedVideoDestinationPath) {
          try {
            await FileSystem.deleteAsync(pairedVideoDestinationPath, { idempotent: true });
          } catch (cleanupError) {
            console.warn('Failed to clean up orphaned live photo motion clip:', cleanupError);
          }
        }
        for (const dualPath of [dualPrimaryDestinationPath, dualSecondaryDestinationPath].filter(
          (value): value is string => Boolean(value)
        )) {
          try {
            await FileSystem.deleteAsync(dualPath, { idempotent: true });
          } catch (cleanupError) {
            console.warn('Failed to clean up orphaned dual capture photo file:', cleanupError);
          }
        }
        showDoneSheet(
          'error',
          t('capture.error', 'Error'),
          t('capture.saveFailed', 'Something went wrong')
        );
      }
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;
      saveSpan.finish({ outcome: saveOutcome });
    }
  }, [
    location,
    pendingMapSaveCoordinate,
    requestForegroundLocation,
    clearInlineSaveTimers,
    completeInlineSaveFlow,
    appTheme,
    getLocationUnavailableMessage,
    isDark,
    showDoneSheet,
    t,
    captureMode,
    cameraSubmode,
    noteText,
    noteColor,
    memoryPromptSuggestion.id,
    memoryPromptText,
    shouldShowMemoryPrompt,
    capturedPhoto,
    capturedPairedVideo,
    dualPrimaryPhoto,
    dualPrimaryFacing,
    dualSecondaryPhoto,
    dualSecondaryFacing,
    selectedPhotoFilterId,
    createNote,
    radius,
    finalizeSavedCapture,
    showSavedSheet,
    canSaveAnotherPhotoNote,
    isPhotoNoteQuotaReady,
    promptHologramSaveChoice,
    captureTarget,
    createSharedPost,
    captureAudienceGroups,
    captureAudienceFriends.length,
    selectedSharedAudienceUserId,
    tier,
    remindersEnabled,
    sharedEnabled,
    showPlusSheet,
    showSharedSaveSheet,
    user,
  ]);

  const handleImportPhoto = useCallback(async (
    intent: PhotoLibraryImportIntent = 'editable-photo'
  ) => {
    let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted' && mediaPermission.canAskAgain !== false) {
      mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (mediaPermission.status !== 'granted') {
      showDoneSheet(
        'warning',
        t('capture.photoLibraryPermissionTitle', 'Photo access needed'),
        mediaPermission.canAskAgain === false
          ? t(
              'capture.photoLibraryPermissionSettingsMsg',
              'Photo library access is blocked for Noto. Open Settings to import from your library.'
            )
          : t(
              'capture.photoLibraryPermissionMsg',
              'Allow photo library access so you can import an image into this note.'
            ),
        mediaPermission.canAskAgain === false
      );
      return;
    }

    setImportingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync(
        getPhotoLibraryImportPickerOptions(intent, Platform.OS)
      );

      const selectedAsset = result.assets?.[0];
      if (!result.canceled && selectedAsset?.uri) {
        setCameraSubmode('single');
        clearDualCaptureState();
        setCapturedPhoto(selectedAsset.uri);
        setCapturedPairedVideo(
          selectedAsset.type === 'livePhoto' ? selectedAsset.pairedVideoAsset?.uri ?? null : null
        );
        if (selectedAsset.type === 'livePhoto') {
          setSelectedPhotoFilterId('original');
        }
      }
    } catch (error) {
      console.warn('Photo import failed:', error);
      showDoneSheet(
        'error',
        t('capture.error', 'Error'),
        t('capture.photoImportFailed', 'We could not import that photo right now.')
      );
    } finally {
      setImportingPhoto(false);
    }
  }, [
    clearDualCaptureState,
    setCameraSubmode,
    setCapturedPairedVideo,
    setCapturedPhoto,
    setSelectedPhotoFilterId,
    showDoneSheet,
    t,
  ]);

  const handleOpenPhotoLibrary = useCallback(() => {
    if (Platform.OS !== 'ios') {
      void handleImportPhoto('editable-photo');
      return;
    }

    showAppAlert(
      t('capture.photoImportOptionsTitle', 'Import photo'),
      t(
        'capture.photoImportOptionsMessage',
        'Crop and frame a still photo before importing, or keep a Live Photo with its motion.'
      ),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('capture.importLivePhotoOption', 'Import Live Photo'),
          onPress: () => {
            void handleImportPhoto('live-photo');
          },
        },
        {
          text: t('capture.editPhotoOption', 'Edit Photo'),
          onPress: () => {
            void handleImportPhoto('editable-photo');
          },
        },
      ]
    );
  }, [handleImportPhoto, t]);

  const handleImportMotionClip = useCallback(async () => {
    let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted' && mediaPermission.canAskAgain !== false) {
      mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (mediaPermission.status !== 'granted') {
      showDoneSheet(
        'warning',
        t('capture.photoLibraryPermissionTitle', 'Photo access needed'),
        mediaPermission.canAskAgain === false
          ? t(
              'capture.photoLibraryPermissionSettingsMsg',
              'Photo library access is blocked for Noto. Open Settings to import from your library.'
            )
          : t(
              'capture.photoLibraryPermissionMsg',
              'Allow photo library access so you can import an image into this note.'
            ),
        mediaPermission.canAskAgain === false
      );
      return;
    }

    setImportingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        selectionLimit: 1,
        videoMaxDuration: LIVE_PHOTO_MAX_DURATION_SECONDS,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCapturedPairedVideo(result.assets[0].uri);
        setSelectedPhotoFilterId('original');
      }
    } catch (error) {
      console.warn('Live photo motion clip import failed:', error);
      showDoneSheet(
        'error',
        t('capture.error', 'Error'),
        t('capture.livePhotoImportFailed', 'We could not import that motion clip right now.')
      );
    } finally {
      setImportingPhoto(false);
    }
  }, [setCapturedPairedVideo, setSelectedPhotoFilterId, showDoneSheet, t]);

  const measureViewInWindow = useCallback(
    (viewRef: RefObject<ReactNativeView | null>) =>
      new Promise<CaptureModeMorphRect | null>((resolve) => {
        const view = viewRef.current;
        if (!view?.measureInWindow) {
          resolve(null);
          return;
        }

        view.measureInWindow((x, y, width, height) => {
          if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 2 ||
            height <= 2
          ) {
            resolve(null);
            return;
          }

          resolve({ x, y, width, height });
        });
      }),
    []
  );

  const fallbackCaptureCardRect = useMemo<CaptureModeMorphRect>(
    () => ({
      x: Math.max(16, (windowWidth - CARD_SIZE) / 2),
      y: getCaptureCardTopPadding(insets.top),
      width: CARD_SIZE,
      height: CARD_SIZE,
    }),
    [insets.top, windowWidth]
  );

  const topCenterIslandRect = useMemo<CaptureModeMorphRect>(
    () => {
      const width = 34;
      const height = 34;
      const cameraHoleTop = Platform.OS === 'ios'
        ? Math.max(7, Math.round(insets.top * 0.22))
        : Math.max(6, Math.round(insets.top * 0.32));

      return {
        x: (windowWidth - width) / 2,
        y: cameraHoleTop,
        width,
        height,
      };
    },
    [insets.top, windowWidth]
  );

  const normalizeCaptureCardMorphRect = useCallback(
    (rect: CaptureModeMorphRect | null) => {
      if (!rect) {
        return fallbackCaptureCardRect;
      }

      return {
        x: rect.x + Math.max(0, (rect.width - CARD_SIZE) / 2),
        y: rect.y,
        width: CARD_SIZE,
        height: CARD_SIZE,
      };
    },
    [fallbackCaptureCardRect]
  );

  const startCaptureModeMorph = useCallback(async () => {
    if (modeMorphSwitchTimeoutRef.current) {
      clearTimeout(modeMorphSwitchTimeoutRef.current);
      modeMorphSwitchTimeoutRef.current = null;
    }

    const measuredCardRect = await measureViewInWindow(captureCardMeasureRef);
    const cardRect = normalizeCaptureCardMorphRect(measuredCardRect);
    const direction = captureMode === 'text' ? 'open' : 'close';
    const nextId = modeMorphTransitionIdRef.current + 1;
    modeMorphTransitionIdRef.current = nextId;

    setModeMorphTransition({
      id: nextId,
      direction,
      from: direction === 'open' ? topCenterIslandRect : cardRect,
      to: direction === 'open' ? cardRect : topCenterIslandRect,
    });

    const switchDelay =
      direction === 'open'
        ? CAPTURE_MODE_MORPH_OPEN_SWITCH_DELAY_MS
        : CAPTURE_MODE_MORPH_CLOSE_SWITCH_DELAY_MS;
    modeMorphSwitchTimeoutRef.current = setTimeout(() => {
      modeMorphSwitchTimeoutRef.current = null;
      toggleCaptureMode({ animated: false, haptic: false });
    }, reduceMotionEnabled ? 0 : switchDelay);
  }, [
    captureMode,
    measureViewInWindow,
    normalizeCaptureCardMorphRect,
    reduceMotionEnabled,
    topCenterIslandRect,
    toggleCaptureMode,
  ]);

  const handleModeMorphFinished = useCallback((id: number) => {
    setModeMorphTransition((current) => (current?.id === id ? null : current));
    setModeMorphBlackoutActive(false);
  }, []);

  const handleToggleCaptureMode = useCallback(() => {
    if (modeMorphTransition) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    captureCardRef.current?.closeDecorateControls();
    setModeMorphBlackoutActive(true);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    requestAnimationFrame(() => {
      void startCaptureModeMorph();
    });
  }, [modeMorphTransition, startCaptureModeMorph]);

  useEffect(
    () => () => {
      if (modeMorphSwitchTimeoutRef.current) {
        clearTimeout(modeMorphSwitchTimeoutRef.current);
      }
    },
    []
  );

  const handleOpenNotes = useCallback((origin?: NotesRouteTransitionRect) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    if (origin) {
      setPendingNotesRouteTransition(origin);
    }
    router.push('/notes');
  }, [router]);

  const openNote = useCallback(
    (noteId: string) => {
      if (Platform.OS === 'ios') {
        openNoteDetail(noteId);
        return;
      }
      router.push(`/note/${noteId}` as any);
    },
    [openNoteDetail, router]
  );

  const openSharedPost = useCallback(
    (postId: string) => {
      router.push(`/shared/${postId}` as any);
    },
    [router]
  );

  const openSharedPostChat = useCallback(
    (postId: string) => {
      router.push(`/shared/chat/${postId}` as any);
    },
    [router]
  );

  const handleCaptureTextEntryFocusChange = useCallback((focused: boolean) => {
    setIsCaptureTextEntryFocused(focused);

    if (Platform.OS !== 'android') {
      return;
    }

    if (focused) {
      setLockedCaptureSnapHeight((current) => current ?? liveSnapHeight);
    } else {
      setLockedCaptureSnapHeight(null);
    }

    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [liveSnapHeight]);

  const handleCaptureDecorateModeChange = useCallback((active: boolean) => {
    setIsCaptureDecorateModeActive(active);

    if (!active) {
      return;
    }

    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleCaptureGestureActiveChange = useCallback((active: boolean) => {
    setIsCaptureGestureActive(active);

    if (!active) {
      return;
    }

    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const captureHeader = useMemo(
    () => (
      <View style={styles.captureItemWrapper}>
        <CaptureCard
          ref={handleCaptureCardRef}
          snapHeight={snapHeight}
          topInset={insets.top}
          isSearching={false}
          captureMode={captureMode}
          cameraSubmode={cameraSubmode}
          dualCaptureSupported={dualCaptureUiEnabled}
          dualCaptureUsesSequentialCapture={dualCaptureUsesSequentialCapture}
          cameraSessionKey={cameraSessionKey}
          captureScale={captureScale}
          captureTranslateY={captureTranslateY}
          captureCardMeasureRef={captureCardMeasureRef}
          isModeMorphing={modeMorphBlackoutActive || Boolean(modeMorphTransition)}
          isModeSwitchAnimating={isModeSwitchAnimating}
          colors={colors}
          t={t}
          noteText={noteText}
          onChangeNoteText={setNoteText}
          noteColor={noteColor}
          onChangeNoteColor={handleChangeNoteColor}
          lockedNoteColorIds={lockedPremiumNoteColorIds}
          previewOnlyNoteColorIds={previewOnlyNoteColorIds}
          onPressLockedNoteColor={() => showPlusSheet('color')}
          capturedPhoto={capturedPhoto}
          capturedPairedVideo={capturedPairedVideo}
          onRetakePhoto={() => {
            setCapturedPhoto(null);
            setCapturedPairedVideo(null);
            clearDualCaptureState();
          }}
          onImportMotionClip={() => {
            void handleImportMotionClip();
          }}
          onRemoveMotionClip={() => setCapturedPairedVideo(null)}
          needsCameraPermission={needsCameraPermission}
          cameraPermissionRequiresSettings={cameraPermissionRequiresSettings}
          onRequestCameraPermission={() => {
            void handleRequestCameraPermission();
          }}
          backCameraLens={backCameraLens}
          availableBackCameraLenses={availableBackCameraLenses}
          backCameraLensZoomConfig={backCameraLensZoomConfig}
          onChangeBackCameraLens={handleChangeBackCameraLens}
          facing={facing}
          onToggleFacing={handleToggleFacing}
          onChangeCameraSubmode={handleChangeCameraSubmode}
          onOpenPhotoLibrary={() => {
            handleOpenPhotoLibrary();
          }}
          selectedPhotoFilterId={selectedPhotoFilterId}
          onChangePhotoFilter={handleChangePhotoFilter}
          lockedPhotoFilterIds={lockedPremiumPhotoFilterIds}
          onPressLockedPhotoFilter={handleChangePhotoFilter}
          cameraRef={cameraRef}
          cameraDevice={cameraDevice}
          isCameraPreviewActive={isCameraPreviewActive}
          isCameraRevealAllowed={isCaptureScrollSettled}
          permissionGranted={Boolean(permission?.granted)}
          onShutterPressIn={handleShutterPressIn}
          onShutterPressOut={handleShutterPressOut}
          onTakePicture={() => {
            if (cameraSubmode === 'dual') {
              void handleTakeDualPicture();
              return;
            }

            void takePicture();
          }}
          onStartLivePhotoCapture={() => {
            void startLivePhotoCapture();
          }}
          onSaveNote={() => {
            void saveNote();
          }}
          saving={saving}
          saveState={saveButtonState}
          shutterScale={shutterScale}
          isStillPhotoCaptureInProgress={cameraCaptureInProgress}
          isLivePhotoCaptureInProgress={isLivePhotoCaptureInProgress}
          isLivePhotoCaptureSettling={isLivePhotoCaptureSettling}
          isLivePhotoSaveGuardActive={isLivePhotoSaveGuardActive}
          cameraInstructionText={cameraInstructionText}
          remainingPhotoSlots={captureMode === 'camera' ? remainingPhotoSlots : null}
          libraryImportLocked={cameraSubmode === 'dual'}
          importingPhoto={importingPhoto}
          dualCameraPreviewRef={dualCameraPreviewRef}
          dualCaptureAwaitingSecondShot={dualCaptureAwaitingSecondShot}
          dualCaptureFirstShotUri={dualPrimaryPhoto}
          radius={radius}
          onChangeRadius={setRadius}
          shareTarget={captureTarget}
          onChangeShareTarget={handleShareTargetChange}
          onResetDualCaptureSequence={handleResetDualCaptureSequence}
          onDoodleModeChange={handleCaptureDecorateModeChange}
          onGestureActiveChange={handleCaptureGestureActiveChange}
          onDraftChange={schedulePersistCaptureDraft}
          onBeforeNativeStickerPicker={persistCaptureDraftNow}
          onTextEntryFocusChange={handleCaptureTextEntryFocusChange}
          stickerLibraryNotes={notes}
          footerContent={captureFooterContent}
        />
      </View>
    ),
    [
      cameraDevice,
      cameraPermissionRequiresSettings,
      cameraSubmode,
      cameraInstructionText,
      captureFooterContent,
      cameraRef,
      cameraSessionKey,
      captureMode,
      captureScale,
      captureTarget,
      captureTranslateY,
      capturedPairedVideo,
      capturedPhoto,
      colors,
      clearDualCaptureState,
      dualCaptureUiEnabled,
      dualCaptureUsesSequentialCapture,
      dualCaptureAwaitingSecondShot,
      dualPrimaryPhoto,
      facing,
      availableBackCameraLenses,
      backCameraLens,
      backCameraLensZoomConfig,
      handleShareTargetChange,
      handleCaptureCardRef,
      handleChangeBackCameraLens,
      handleChangeNoteColor,
      handleChangeCameraSubmode,
      handleChangePhotoFilter,
      handleResetDualCaptureSequence,
      handleCaptureDecorateModeChange,
      handleCaptureGestureActiveChange,
      handleTakeDualPicture,
      handleCaptureTextEntryFocusChange,
      handleImportMotionClip,
      handleOpenPhotoLibrary,
      handleRequestCameraPermission,
      handleShutterPressIn,
      handleShutterPressOut,
      handleToggleFacing,
      importingPhoto,
      insets.top,
      isCameraPreviewActive,
      isCaptureScrollSettled,
      cameraCaptureInProgress,
      isLivePhotoCaptureInProgress,
      isLivePhotoCaptureSettling,
      isLivePhotoSaveGuardActive,
      isModeSwitchAnimating,
      lockedPremiumNoteColorIds,
      lockedPremiumPhotoFilterIds,
      modeMorphBlackoutActive,
      modeMorphTransition,
      needsCameraPermission,
      notes,
      noteColor,
      noteText,
      permission?.granted,
      previewOnlyNoteColorIds,
      radius,
      remainingPhotoSlots,
      schedulePersistCaptureDraft,
      saveButtonState,
      saving,
      selectedPhotoFilterId,
      persistCaptureDraftNow,
      setCapturedPairedVideo,
      setCapturedPhoto,
      setNoteText,
      setRadius,
      saveNote,
      shutterScale,
      showPlusSheet,
      snapHeight,
      startLivePhotoCapture,
      t,
      takePicture,
    ]
  );
  const notesFeedProps = useMemo<ComponentProps<typeof NotesFeed>>(
    () => ({
      flatListRef,
      captureHeader,
      emptyState: homeFeedEmptyState,
      captureMode,
      screenActive: isScreenFocused,
      items: visibleFeedItems,
      ownedSharedNoteIds,
      refreshing: feedRefreshing,
      onRefresh: handleRefreshHome,
      topInset: insets.top,
      snapHeight,
      onOpenNote: openNote,
      onOpenSharedPost: openSharedPost,
      onOpenSharedPostChat: openSharedPostChat,
      onSendSharedPostResponse: createSharedPostResponse,
      colors,
      t,
      onSettledArchiveItemChange: handleSettledArchiveItemChange,
      onCaptureVisibilityChange: setIsCaptureVisible,
      onCaptureScrollSettledChange: setIsCaptureScrollSettled,
      onInitialContentDraw: markHomeFeedReady,
      scrollEnabled:
        !shouldLockCaptureInteractions &&
        !isLivePhotoCaptureInProgress,
      capturePageLocked: shouldLockCapturePage,
    }),
    [
      captureHeader,
      captureMode,
      colors,
      feedRefreshing,
      handleRefreshHome,
      handleSettledArchiveItemChange,
      homeFeedEmptyState,
      insets.top,
      isLivePhotoCaptureInProgress,
      isScreenFocused,
      markHomeFeedReady,
      createSharedPostResponse,
      openNote,
      openSharedPost,
      openSharedPostChat,
      ownedSharedNoteIds,
      shouldLockCaptureInteractions,
      shouldLockCapturePage,
      snapHeight,
      t,
      visibleFeedItems,
    ]
  );
  const savedRevealProps = useMemo<ComponentProps<typeof SavedNotePolaroidReveal>>(
    () => ({
      note: savedNoteRevealNote,
      isSharedByMe: savedNoteRevealIsSharedByMe,
      revealToken: savedNoteRevealToken,
      bottomTabInset: bottomTabVisualInset,
      colors,
      t,
      onFinished: handleSavedNoteRevealFinished,
    }),
    [
      bottomTabVisualInset,
      colors,
      handleSavedNoteRevealFinished,
      savedNoteRevealIsSharedByMe,
      savedNoteRevealNote,
      savedNoteRevealToken,
      t,
    ]
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <HomeFeedSurface
        blurBackgroundColor={colors.background}
        notesFeedProps={notesFeedProps}
        savedRevealProps={savedRevealProps}
      />
      <HomeScreenChrome
        dualCaptureComposerProps={{
          request: dualCaptureComposeRequest,
          onComplete: handleDualCaptureComposeComplete,
        }}
        headerSearchProps={{
          topInset: insets.top,
          isSearching: false,
          searchAnim,
          searchQuery: '',
          onSearchChange: () => {},
          onOpenSearch: () => {
            router.push('/search' as Href);
          },
          onCloseSearch: () => {},
          showSearchButton: showLegacySearchButton,
          showMessagesButton: false,
          showSharedButton: true,
          showNotesButton: true,
          onOpenShared: handleOpenSharedManage,
          onOpenNotes: handleOpenNotes,
          sharedButtonMode: settledSharedButtonMode,
          sharedButtonActive: settledSharedButtonMode === 'filter' && isFriendsFilterEnabled,
          sharedFilterValue: isFriendsFilterEnabled ? 'friends' : 'all',
          onChangeSharedFilter: (nextFilter) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsFriendsFilterEnabled(nextFilter === 'friends');
          },
          hasFriendsForFilter: friends.length > 0,
          onToggleCaptureMode: handleToggleCaptureMode,
          captureMode,
          colors,
          isDark,
          t,
          showDockedBlur: true,
        }}
        sharedManageSheetProps={
          showSharedManageSheet
            ? {
                visible: showSharedManageSheet,
                friends,
                friendGroups,
                activeInvite,
                creatingInvite: inviteActionInFlight === 'create',
                loading: sharedLoading,
                onClose: dismissSharedManageSheet,
                onCreateInvite: () => {
                  void handleCreateInvite();
                },
                onShareInvite: () => {
                  void handleShareInvite();
                },
                onRevokeInvite: () => {
                  void handleRevokeInvite();
                },
                onOpenFriendSearch: () => {
                  dismissSharedManageSheet();
                  router.push('/friends/join' as Href);
                },
                onOpenChats: sharedEnabled && user
                  ? () => {
                      dismissSharedManageSheet();
                      router.push('/shared/chats' as Href);
                    }
                  : undefined,
                unreadChatsCount: unreadSharedChatCount,
                onRemoveFriend: handleRemoveFriend,
                onUpdateFriendNickname: updateFriendNickname,
                onCreateFriendGroup: createFriendGroup,
                onUpdateFriendGroup: updateFriendGroup,
                onDeleteFriendGroup: deleteFriendGroup,
              }
            : null
        }
        alertProps={alertProps}
      />
      <CaptureModeMorphOverlay
        transition={modeMorphTransition}
        reduceMotionEnabled={reduceMotionEnabled}
        colors={{
          background: CaptureChrome.cameraMorphBackground,
          border: colors.captureCameraOverlayBorder ?? colors.border,
        }}
        onFinished={handleModeMorphFinished}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  captureItemWrapper: {
    width: '100%',
  },
});
