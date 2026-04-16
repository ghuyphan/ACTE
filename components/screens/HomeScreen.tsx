import { useFocusEffect, useIsFocused, useScrollToTop } from '@react-navigation/native';
import * as FileSystem from '../../utils/fileSystem';
import * as Haptics from '../../hooks/useHaptics';
import * as ImagePicker from 'expo-image-picker';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppSheetAlert from '../sheets/AppSheetAlert';
import CaptureAudienceStrip from '../home/CaptureAudienceStrip';
import CaptureCard, { type CaptureCardHandle } from '../home/CaptureCard';
import {
  findHomeFeedItemIndex,
  getHomeFeedItemKey,
} from '../home/feedItems';
import HomeFeedEmptyState from '../home/HomeFeedEmptyState';
import HomeHeaderSearch from '../home/HomeHeaderSearch';
import NotesFeed from '../home/NotesFeed';
import PlacePulseStrip from '../home/PlacePulseStrip';
import SavedNotePolaroidReveal from '../home/SavedNotePolaroidReveal';
import SharedPlacePulseStrip, {
  type SharedPlacePulseAvatar,
} from '../home/SharedPlacePulseStrip';
import SharedManageSheet from '../home/SharedManageSheet';
import { useHomeFeedViewModel } from '../../hooks/app/useHomeFeedViewModel';
import { useHomeRefresh } from '../../hooks/app/useHomeRefresh';
import { useHomeSharedActions } from '../../hooks/app/useHomeSharedActions';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useActiveFeedTarget } from '../../hooks/useActiveFeedTarget';
import { useAuth } from '../../hooks/useAuth';
import { useCaptureFlow, type CaptureDraftState } from '../../hooks/useCaptureFlow';
import { useFeedFocus } from '../../hooks/useFeedFocus';
import { useHomeStartupReady } from '../../hooks/app/useHomeStartupReady';
import {
  useGeofence,
  type ForegroundLocationRequestResult,
} from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
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
import { DEFAULT_NOTE_RADIUS } from '../../constants/noteRadius';
import { DEFAULT_NOTE_COLOR_ID, PREMIUM_NOTE_COLOR_IDS } from '../../services/noteAppearance';
import { resolveAutoNoteEmoji } from '../../services/noteDecorations';
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
import { saveNoteStickerPlacementsWithAssets } from '../../services/noteStickers';
import {
  getFallbackFreeNoteColor,
  getPremiumNoteSaveDecision,
  isPreviewablePremiumNoteColor,
  PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS,
} from '../../services/premiumNoteFinish';
import { generateNoteId, type Note } from '../../services/database';
import { getDistanceMeters, getReminderPlaceGroups } from '../../services/reminderSelection';
import { getSharedFeedErrorMessage, type SharedPost } from '../../services/sharedFeedService';
import type { NotesRouteTransitionRect } from '../../utils/notesRouteTransition';
import { setPendingNotesRouteTransition } from '../../utils/notesRouteTransition';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../../utils/appStorage';
import { setAndroidSoftInputMode } from '../../utils/androidSoftInputMode';
import { isIOS26OrNewer } from '../../utils/platform';

const LIVE_PHOTO_CAMERA_HINT_SEEN_KEY = 'noto.capture.live-photo-hint-seen.v1';
const CAPTURE_DRAFT_STORAGE_KEY = 'noto.capture.home-draft.v1';
const PLACE_PULSE_RADIUS_METERS = 500;
const SHARED_PLACE_PULSE_MAX_AVATARS = 3;
const SHARED_PLACE_PULSE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type SaveButtonState = 'idle' | 'saving' | 'success';

type PersistedCaptureDraft = CaptureDraftState & {
  version: 1;
  noteColor: string | null;
  captureTarget: 'private' | 'shared';
  selectedSharedAudienceUserId: string | null;
};

function isPersistableCaptureDraft(draft: CaptureDraftState) {
  if (draft.captureMode === 'camera') {
    return Boolean(draft.capturedPhoto);
  }

  return draft.noteText.trim().length > 0;
}

function hasFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getSharedPlacePulseFallbackLabel(post: SharedPost) {
  const trimmedName = post.authorDisplayName?.trim();
  if (trimmedName) {
    return (trimmedName[0] ?? '?').toUpperCase();
  }

  return '?';
}

function parsePersistedCaptureDraft(rawValue: string | null): PersistedCaptureDraft | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedCaptureDraft> | null;
    if (!parsed || parsed.version !== 1) {
      return null;
    }

    const captureMode = parsed.captureMode === 'camera' ? 'camera' : 'text';
    const noteText = typeof parsed.noteText === 'string' ? parsed.noteText : '';
    const capturedPhoto =
      typeof parsed.capturedPhoto === 'string' && parsed.capturedPhoto.trim().length > 0
        ? parsed.capturedPhoto
        : null;
    const capturedPairedVideo =
      typeof parsed.capturedPairedVideo === 'string' && parsed.capturedPairedVideo.trim().length > 0
        ? parsed.capturedPairedVideo
        : null;
    const radius = typeof parsed.radius === 'number' && Number.isFinite(parsed.radius)
      ? parsed.radius
      : DEFAULT_NOTE_RADIUS;
    const selectedPhotoFilterId =
      typeof parsed.selectedPhotoFilterId === 'string'
        ? parsed.selectedPhotoFilterId as PhotoFilterId
        : 'original';
    const noteColor = typeof parsed.noteColor === 'string' ? parsed.noteColor : DEFAULT_NOTE_COLOR_ID;
    const captureTarget = parsed.captureTarget === 'shared' ? 'shared' : 'private';
    const selectedSharedAudienceUserId =
      typeof parsed.selectedSharedAudienceUserId === 'string' &&
      parsed.selectedSharedAudienceUserId.trim().length > 0
        ? parsed.selectedSharedAudienceUserId
        : null;

    const normalizedDraft: PersistedCaptureDraft = {
      version: 1,
      captureMode,
      noteText,
      capturedPhoto,
      capturedPairedVideo,
      radius,
      selectedPhotoFilterId,
      noteColor,
      captureTarget,
      selectedSharedAudienceUserId,
    };

    return isPersistableCaptureDraft(normalizedDraft) ? normalizedDraft : null;
  } catch {
    return null;
  }
}

export default function HomeScreen() {
  const { openSharedManageAt } = useLocalSearchParams<{ openSharedManageAt?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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
    phase: sharedPhaseFromStore,
    loading: sharedLoading,
    ready: sharedReady,
    initialLoadComplete: sharedInitialLoadComplete = true,
    friends,
    sharedPosts,
    activeInvite,
    refreshSharedFeed,
    createFriendInvite,
    revokeFriendInvite,
    removeFriend,
    createSharedPost,
  } = useSharedFeedStore();
  const sharedPhase =
    sharedPhaseFromStore ??
    (sharedLoading
      ? 'refreshing'
      : sharedInitialLoadComplete
        ? 'ready'
        : sharedReady
          ? 'cache-ready'
          : 'bootstrapping');
  const {
    bootstrapState: syncBootstrapState,
    isInitialSyncPending,
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
    requestForegroundLocation,
    requestReminderPermissions,
    openAppSettings,
  } = useGeofence();
  const { alertProps, showAlert } = useAppSheetAlert();
  const { setActiveFeedTarget, clearActiveFeedTarget } = useActiveFeedTarget();
  const { markHomeFeedReady, resetHomeFeedReady } = useHomeStartupReady();
  const {
    clearFeedFocus,
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
  const [lockedCaptureSnapHeight, setLockedCaptureSnapHeight] = useState<number | null>(null);
  const [isCaptureVisible, setIsCaptureVisible] = useState(true);
  const [isCaptureScrollSettled, setIsCaptureScrollSettled] = useState(true);
  const [settledSharedButtonMode, setSettledSharedButtonMode] = useState<'manage' | 'filter'>('manage');
  const [isFriendsFilterEnabled, setIsFriendsFilterEnabled] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<'private' | 'shared'>('private');
  const [selectedSharedAudienceUserId, setSelectedSharedAudienceUserId] = useState<string | null>(null);
  const [noteColor, setNoteColor] = useState<string | null>(DEFAULT_NOTE_COLOR_ID);
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
  const [hasSeenLivePhotoCameraHint, setHasSeenLivePhotoCameraHint] = useState<boolean | null>(null);
  const [showLivePhotoCameraHint, setShowLivePhotoCameraHint] = useState(false);

  const searchAnim = useSharedValue(0);
  const flatListRef = useRef<any>(null);
  const captureCardRef = useRef<CaptureCardHandle | null>(null);
  const lastFreeNoteColorRef = useRef<string>(DEFAULT_NOTE_COLOR_ID);
  const finalizeInlineSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetSaveStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistCaptureDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const settledArchiveItemRef = useRef<{ id: string; kind: 'note' | 'shared-post' } | null>(null);
  const previousVisibleFeedItemKeysRef = useRef<string[] | null>(null);
  const lastHandledOpenSharedManageAtRef = useRef<string | null>(null);
  const [captureDraftReady, setCaptureDraftReady] = useState(false);
  useScrollToTop(flatListRef);

  useEffect(() => {
    let cancelled = false;

    void getPersistentItem(LIVE_PHOTO_CAMERA_HINT_SEEN_KEY).then((value) => {
      if (cancelled) {
        return;
      }

      setHasSeenLivePhotoCameraHint(Boolean(value));
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
    cameraSessionKey,
    setCaptureMode,
    noteText,
    setNoteText,
    capturedPhoto,
    setCapturedPhoto,
    capturedPairedVideo,
    setCapturedPairedVideo,
    radius,
    setRadius,
    facing,
    setFacing,
    selectedPhotoFilterId,
    setSelectedPhotoFilterId,
    cameraDevice,
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
    startLivePhotoCapture,
    isStillPhotoCaptureInProgress,
    isLivePhotoCaptureInProgress,
    isLivePhotoCaptureSettling,
    isLivePhotoSaveGuardActive,
    needsCameraPermission,
    resetCapture,
    restoreCaptureState,
  } = useCaptureFlow();
  const isCameraPreviewActive =
    captureMode === 'camera' &&
    isCaptureVisible &&
    isScreenFocused &&
    appState === 'active' &&
    Boolean(permission?.granted);

  const liveSnapHeight = windowHeight;
  const shouldLockCapturePage = Platform.OS === 'android' && isCaptureTextEntryFocused;
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
  useEffect(() => {
    const isCameraHintEligible =
      captureMode === 'camera' &&
      isCameraPreviewActive &&
      !isModeSwitchAnimating &&
      !capturedPhoto &&
      !(tier !== 'plus' && remainingPhotoSlots === 0);

    if (hasSeenLivePhotoCameraHint !== false || !isCameraHintEligible) {
      setShowLivePhotoCameraHint((current) => (current ? false : current));
      return;
    }

    let cancelled = false;
    let revealTimeout: ReturnType<typeof setTimeout> | null = null;
    const idleHandle = scheduleOnIdle(() => {
      revealTimeout = setTimeout(() => {
        if (!cancelled) {
          setShowLivePhotoCameraHint(true);
        }
      }, 140);
    });

    return () => {
      cancelled = true;
      idleHandle.cancel();
      if (revealTimeout) {
        clearTimeout(revealTimeout);
      }
    };
  }, [
    captureMode,
    capturedPhoto,
    hasSeenLivePhotoCameraHint,
    isCameraPreviewActive,
    isModeSwitchAnimating,
    remainingPhotoSlots,
    tier,
  ]);

  useEffect(() => {
    if (hasSeenLivePhotoCameraHint !== false || !capturedPhoto) {
      return;
    }

    setHasSeenLivePhotoCameraHint(true);
    void setPersistentItem(LIVE_PHOTO_CAMERA_HINT_SEEN_KEY, '1');
  }, [
    capturedPhoto,
    hasSeenLivePhotoCameraHint,
  ]);
  const cameraPermissionRequiresSettings =
    captureMode === 'camera' &&
    permission?.granted === false &&
    permission.canAskAgain === false;
  const {
    feedMode,
    bootstrapState,
    isFeedBootstrapPending,
    homeFeedItemsCount,
    visibleFeedItems,
    ownedSharedNoteIds,
    savedNoteRevealIsSharedByMe,
  } = useHomeFeedViewModel({
    userUid: user?.uid,
    notes,
    notesPhase,
    sharedEnabled,
    sharedPhase,
    sharedPosts,
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

  const resetCaptureDraft = useCallback(() => {
    captureCardRef.current?.dismissInputs?.();
    resetCapture();
    captureCardRef.current?.resetDoodle();
    captureCardRef.current?.resetStickers();
  }, [resetCapture]);

  const finalizeSavedCapture = useCallback(() => {
    void clearPersistedCaptureDraft();
    resetCaptureDraft();
    setCaptureTarget('private');
    setSelectedSharedAudienceUserId(null);
    setNoteColor(DEFAULT_NOTE_COLOR_ID);
    lastFreeNoteColorRef.current = DEFAULT_NOTE_COLOR_ID;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [clearPersistedCaptureDraft, resetCaptureDraft]);

  const handleChangeNoteColor = useCallback((nextColor: string | null) => {
    const resolvedColor = nextColor ?? DEFAULT_NOTE_COLOR_ID;
    setNoteColor(resolvedColor);
    if (!isPreviewablePremiumNoteColor(resolvedColor)) {
      lastFreeNoteColorRef.current = resolvedColor;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getPersistentItem(CAPTURE_DRAFT_STORAGE_KEY).then(async (storedValue) => {
      const persistedDraft = parsePersistedCaptureDraft(storedValue);
      if (!persistedDraft) {
        if (!cancelled) {
          setCaptureDraftReady(true);
        }
        return;
      }

      if (persistedDraft.captureMode === 'camera' && persistedDraft.capturedPhoto) {
        const photoInfo = await FileSystem.getInfoAsync(persistedDraft.capturedPhoto).catch(() => ({
          exists: false,
        }));

        if (!photoInfo.exists) {
          await clearPersistedCaptureDraft();
          if (!cancelled) {
            setCaptureDraftReady(true);
          }
          return;
        }

        if (persistedDraft.capturedPairedVideo) {
          const pairedVideoInfo = await FileSystem.getInfoAsync(persistedDraft.capturedPairedVideo).catch(() => ({
            exists: false,
          }));
          if (!pairedVideoInfo.exists) {
            persistedDraft.capturedPairedVideo = null;
          }
        }
      }

      if (cancelled) {
        return;
      }

      restoreCaptureState({
        captureMode: persistedDraft.captureMode,
        noteText: persistedDraft.noteText,
        capturedPhoto: persistedDraft.capturedPhoto,
        capturedPairedVideo: persistedDraft.capturedPairedVideo,
        radius: persistedDraft.radius,
        selectedPhotoFilterId: persistedDraft.selectedPhotoFilterId,
      });
      captureCardRef.current?.resetDoodle();
      captureCardRef.current?.resetStickers();
      handleChangeNoteColor(persistedDraft.noteColor);
      setCaptureTarget(
        persistedDraft.captureTarget === 'shared' && sharedEnabled && user ? 'shared' : 'private'
      );
      setSelectedSharedAudienceUserId(
        persistedDraft.captureTarget === 'shared' ? persistedDraft.selectedSharedAudienceUserId : null
      );
      setCaptureDraftReady(true);
    }).catch(() => {
      if (!cancelled) {
        setCaptureDraftReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    captureDraftReady,
    clearPersistedCaptureDraft,
    handleChangeNoteColor,
    restoreCaptureState,
    sharedEnabled,
    user,
  ]);

  useEffect(() => {
    if (!captureDraftReady) {
      return;
    }

    if (persistCaptureDraftTimeoutRef.current) {
      clearTimeout(persistCaptureDraftTimeoutRef.current);
    }

    const nextDraft: PersistedCaptureDraft = {
      version: 1,
      captureMode,
      noteText,
      capturedPhoto,
      capturedPairedVideo,
      radius,
      selectedPhotoFilterId,
      noteColor,
      captureTarget,
      selectedSharedAudienceUserId,
    };

    persistCaptureDraftTimeoutRef.current = setTimeout(() => {
      persistCaptureDraftTimeoutRef.current = null;

      if (!isPersistableCaptureDraft(nextDraft)) {
        void clearPersistedCaptureDraft();
        return;
      }

      void setPersistentItem(CAPTURE_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft)).catch(() => undefined);
    }, 240);

    return () => {
      if (persistCaptureDraftTimeoutRef.current) {
        clearTimeout(persistCaptureDraftTimeoutRef.current);
        persistCaptureDraftTimeoutRef.current = null;
      }
    };
  }, [
    captureDraftReady,
    captureMode,
    noteText,
    capturedPhoto,
    capturedPairedVideo,
    radius,
    selectedPhotoFilterId,
    noteColor,
    captureTarget,
    selectedSharedAudienceUserId,
    clearPersistedCaptureDraft,
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
    if (!sharedEnabled || friends.length === 0) {
      setCaptureTarget('private');
      setSelectedSharedAudienceUserId(null);
    }
  }, [friends.length, sharedEnabled]);

  useEffect(() => {
    if (!selectedSharedAudienceUserId) {
      return;
    }

    if (!friends.some((friend) => friend.userId === selectedSharedAudienceUserId)) {
      setSelectedSharedAudienceUserId(null);
    }
  }, [friends, selectedSharedAudienceUserId]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissSharedManageSheet();
      };
    }, [dismissSharedManageSheet])
  );

  useFocusEffect(
    useCallback(() => {
      const target = peekFeedFocus?.() ?? null;
      if (!target) {
        return undefined;
      }

      const isTargetDataReady =
        notesInitialLoadComplete &&
        (target.kind !== 'shared-post' || !sharedLoading);
      if (!isTargetDataReady) {
        return undefined;
      }

      const settledItem = settledArchiveItemRef.current;
      if (settledItem?.kind === target.kind && settledItem.id === target.id) {
        clearFeedFocus?.();
        return undefined;
      }

      const targetIndex = findHomeFeedItemIndex(visibleFeedItems, target);
      if (targetIndex < 0) {
        clearFeedFocus?.();
        return undefined;
      }

      let focusTimeout: ReturnType<typeof setTimeout> | null = null;
      let idleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
      let cancelled = false;
      idleHandle = scheduleOnIdle(() => {
        focusTimeout = setTimeout(() => {
          if (cancelled) {
            return;
          }

          clearFeedFocus?.();
          flatListRef.current?.scrollToOffset({
            offset: (targetIndex + 1) * snapHeight,
            animated: true,
          });
        }, 0);
      });

      return () => {
        cancelled = true;
        idleHandle?.cancel();
        if (focusTimeout) {
          clearTimeout(focusTimeout);
        }
      };
    }, [
      clearFeedFocus,
      notesInitialLoadComplete,
      peekFeedFocus,
      sharedLoading,
      snapHeight,
      visibleFeedItems,
    ])
  );

  const { refreshing, refreshHome } = useHomeRefresh({
    hasNetworkRefreshWork: Boolean(user && sharedEnabled),
    refreshNotes,
    refreshSharedFeed: user && sharedEnabled ? refreshSharedFeed : undefined,
    onAfterLocalRefresh: () => {
      setSuppressedHomeNoteIds([]);
    },
  });

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
              t(
                'capture.remindersUnavailableSettingsMsg',
                'Background location or notifications are blocked for Noto. Open Settings to enable reminders.'
              ),
              true
            );
            return;
          }

          showDoneSheet(
            'warning',
            t('capture.remindersUnavailableTitle', 'Reminders still off'),
            t(
              'capture.remindersUnavailableMsg',
              'Your note is still saved locally. Noto needs background location and notifications to send reminders.'
            )
          );
        },
      },
      secondaryAction: {
        label: t('common.cancel', 'Cancel'),
        variant: 'secondary',
      },
    });
  }, [requestReminderPermissions, showAlert, showDoneSheet, t]);

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

  const placePulseSummary = useMemo(() => {
    if (!location) {
      return {
        nearbyNoteCount: 0,
        targetNoteId: null as string | null,
      };
    }

    const nearbyGroups = getReminderPlaceGroups(notes)
      .map((group) => ({
        group,
        distanceMeters: getDistanceMeters(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: group.latitude,
            longitude: group.longitude,
          }
        ),
      }))
      .filter((entry) => entry.distanceMeters <= PLACE_PULSE_RADIUS_METERS)
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    const highlightedPlace = nearbyGroups[0]?.group ?? null;
    const latestNearbyNote = highlightedPlace
      ? [...highlightedPlace.notes].sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        )[0] ?? null
      : null;

    return {
      nearbyNoteCount: nearbyGroups.reduce(
        (sum, entry) => sum + entry.group.notes.length,
        0
      ),
      targetNoteId: latestNearbyNote?.id ?? null,
    };
  }, [location, notes]);
  const sharedPlacePulseSummary = useMemo(() => {
    if (
      captureTarget !== 'private' ||
      !location ||
      !sharedEnabled ||
      !sharedReady
    ) {
      return {
        nearbySharedPostCount: 0,
        targetPostId: null as string | null,
        avatars: [] as SharedPlacePulseAvatar[],
        overflowCount: 0,
      };
    }

    const currentCoordinates = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    const minimumCreatedAt = Date.now() - SHARED_PLACE_PULSE_MAX_AGE_MS;

    const nearbySharedPosts = sharedPosts
      .filter((post) => {
        if (!hasFiniteCoordinate(post.latitude) || !hasFiniteCoordinate(post.longitude)) {
          return false;
        }

        const createdAtMs = new Date(post.createdAt).getTime();
        if (!Number.isFinite(createdAtMs) || createdAtMs < minimumCreatedAt) {
          return false;
        }

        return (
          getDistanceMeters(currentCoordinates, {
            latitude: post.latitude,
            longitude: post.longitude,
          }) <= PLACE_PULSE_RADIUS_METERS
        );
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );

    const uniqueNearbyAuthorIds = new Set<string>();
    for (const post of nearbySharedPosts) {
      uniqueNearbyAuthorIds.add(post.authorUid.trim() || post.id);
    }

    const avatars: SharedPlacePulseAvatar[] = [];
    const renderedAuthorIds = new Set<string>();

    for (const post of nearbySharedPosts) {
      const authorKey = post.authorUid.trim() || post.id;
      if (renderedAuthorIds.has(authorKey)) {
        continue;
      }

      renderedAuthorIds.add(authorKey);
      avatars.push({
        id: authorKey,
        photoUrl: post.authorPhotoURLSnapshot,
        fallbackLabel: getSharedPlacePulseFallbackLabel(post),
      });

      if (avatars.length >= SHARED_PLACE_PULSE_MAX_AVATARS) {
        break;
      }
    }

    return {
      nearbySharedPostCount: nearbySharedPosts.length,
      targetPostId: nearbySharedPosts[0]?.id ?? null,
      avatars,
      overflowCount: Math.max(uniqueNearbyAuthorIds.size - avatars.length, 0),
    };
  }, [captureTarget, location, sharedEnabled, sharedPosts, sharedReady]);

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
  });

  const captureFooterContent = useMemo(() => {
    if (captureTarget === 'shared' && friends.length > 0) {
      return (
        <CaptureAudienceStrip
          friends={friends}
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
    friends,
    handlePlacePulsePress,
    handleSharedPlacePulsePress,
    location,
    placePulseSummary.nearbyNoteCount,
    selectedSharedAudienceUserId,
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
        showDoneSheet(
          'warning',
          t('capture.error', 'Error'),
          t('capture.noText', 'Please write a note or add a doodle')
        );
        return;
      }

      if (captureMode === 'camera' && !capturedPhoto) {
        showDoneSheet(
          'warning',
          t('capture.error', 'Error'),
          t('capture.noPhoto', 'Please take a photo first')
        );
        return;
      }

      if (captureMode === 'camera' && !isPhotoNoteQuotaReady) {
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
            return;
          }
        }
      }

      clearInlineSaveTimers();
      setSaveButtonState('saving');
      setSaving(true);

      let currentLocation = location;
      let locationResult: ForegroundLocationRequestResult = {
        location: currentLocation,
        requiresSettings: false,
        reason: null,
      };

      if (!currentLocation) {
        locationResult = await requestForegroundLocation();
        currentLocation = locationResult.location;
      }

      if (!currentLocation) {
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
        const lat = currentLocation.coords.latitude;
        const lon = currentLocation.coords.longitude;
        const geocodedName = await resolveLocationNameFromCoordinates(lat, lon);
        const locationName = geocodedName ?? t('capture.unknownPlace', 'Unknown Place');

        let content = noteText.trim();

        if (captureMode === 'camera' && capturedPhoto) {
          const directory = `${FileSystem.documentDirectory}photos/`;
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
          const filename = `note-${Date.now()}.jpg`;
          destinationPath = `${directory}${filename}`;
          if (selectedPhotoFilterId === 'original') {
            await FileSystem.copyAsync({ from: capturedPhoto, to: destinationPath });
          } else {
            await renderFilteredPhotoToFile(capturedPhoto, destinationPath, selectedPhotoFilterId);
          }
          content = destinationPath;
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
          promptId: null,
          promptTextSnapshot: null,
          promptAnswer: null,
          moodEmoji: autoEmoji,
          noteColor: captureMode === 'text' ? noteColor : null,
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
          if (friends.length === 0) {
            shareOutcome = 'no-friends';
          } else {
            try {
              await createSharedPost(
                createdNote,
                selectedSharedAudienceUserId ? [selectedSharedAudienceUserId] : undefined
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

        if (shareOutcome === 'default' && remindersEnabled) {
          completeInlineSaveFlow(createdNote);
        } else if (shareOutcome === 'shared') {
          completeInlineSaveFlow(createdNote);
        } else if (shareOutcome === 'default') {
          setSaveButtonState('idle');
          finalizeSavedCapture();
          showSavedSheet(createdNote.id);
        } else {
          setSaveButtonState('idle');
          finalizeSavedCapture();
          showSharedSaveSheet(shareOutcome, shareFailureMessage, createdNote.id);
        }
      } catch (error) {
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
        showDoneSheet(
          'error',
          t('capture.error', 'Error'),
          t('capture.saveFailed', 'Something went wrong')
        );
      } finally {
        setSaving(false);
      }
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    location,
    requestForegroundLocation,
    clearInlineSaveTimers,
    completeInlineSaveFlow,
    getLocationUnavailableMessage,
    showDoneSheet,
    t,
    captureMode,
    noteText,
    noteColor,
    capturedPhoto,
    capturedPairedVideo,
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
    friends.length,
    selectedSharedAudienceUserId,
    tier,
    remindersEnabled,
    sharedEnabled,
    showPlusSheet,
    showSharedSaveSheet,
    user,
  ]);

  const handleImportPhoto = useCallback(async () => {
    let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted') {
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
        mediaTypes: Platform.OS === 'ios' ? ['images', 'livePhotos'] : ['images'],
        allowsEditing: false,
        quality: 0.35,
        selectionLimit: 1,
      });

      const selectedAsset = result.assets?.[0];
      if (!result.canceled && selectedAsset?.uri) {
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
    setCapturedPairedVideo,
    setCapturedPhoto,
    setSelectedPhotoFilterId,
    showDoneSheet,
    t,
  ]);

  const handleImportMotionClip = useCallback(async () => {
    let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted') {
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

  const handleToggleCaptureMode = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    captureCardRef.current?.closeDecorateControls();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    toggleCaptureMode();
  }, [toggleCaptureMode]);

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

  const captureHeader = useMemo(
    () => (
      <View style={styles.captureItemWrapper}>
        <CaptureCard
          ref={captureCardRef}
          snapHeight={snapHeight}
          topInset={insets.top}
          isSearching={false}
          captureMode={captureMode}
          cameraSessionKey={cameraSessionKey}
          captureScale={captureScale}
          captureTranslateY={captureTranslateY}
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
          facing={facing}
          onToggleFacing={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
          onOpenPhotoLibrary={() => {
            void handleImportPhoto();
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
          isStillPhotoCaptureInProgress={isStillPhotoCaptureInProgress}
          isLivePhotoCaptureInProgress={isLivePhotoCaptureInProgress}
          isLivePhotoCaptureSettling={isLivePhotoCaptureSettling}
          isLivePhotoSaveGuardActive={isLivePhotoSaveGuardActive}
          cameraInstructionText={
            captureMode === 'camera' && showLivePhotoCameraHint
              ? t('capture.livePhotoCaptureHint', 'Tap for a photo. Hold for a live photo.')
              : null
          }
          remainingPhotoSlots={captureMode === 'camera' ? remainingPhotoSlots : null}
          libraryImportLocked={false}
          importingPhoto={importingPhoto}
          radius={radius}
          onChangeRadius={setRadius}
          shareTarget={captureTarget}
          onChangeShareTarget={handleCaptureTargetChange}
          onTextEntryFocusChange={handleCaptureTextEntryFocusChange}
          footerContent={captureFooterContent}
        />
      </View>
    ),
    [
      cameraDevice,
      cameraPermissionRequiresSettings,
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
      facing,
      handleCaptureTargetChange,
      handleChangeNoteColor,
      handleChangePhotoFilter,
      handleCaptureTextEntryFocusChange,
      handleImportMotionClip,
      handleImportPhoto,
      handleRequestCameraPermission,
      handleShutterPressIn,
      handleShutterPressOut,
      importingPhoto,
      insets.top,
      isCameraPreviewActive,
      isCaptureScrollSettled,
      isStillPhotoCaptureInProgress,
      isLivePhotoCaptureInProgress,
      isLivePhotoCaptureSettling,
      isLivePhotoSaveGuardActive,
      isModeSwitchAnimating,
      lockedPremiumNoteColorIds,
      lockedPremiumPhotoFilterIds,
      needsCameraPermission,
      noteColor,
      noteText,
      permission?.granted,
      previewOnlyNoteColorIds,
      radius,
      remainingPhotoSlots,
      saveButtonState,
      saving,
      selectedPhotoFilterId,
      setCapturedPairedVideo,
      setCapturedPhoto,
      setFacing,
      setNoteText,
      setRadius,
      saveNote,
      shutterScale,
      showLivePhotoCameraHint,
      showPlusSheet,
      snapHeight,
      startLivePhotoCapture,
      t,
      takePicture,
    ]
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.blurTarget}>
        <NotesFeed
          flatListRef={flatListRef}
          captureHeader={captureHeader}
          emptyState={homeFeedEmptyState}
          captureMode={captureMode}
          screenActive={isScreenFocused}
          items={visibleFeedItems}
          ownedSharedNoteIds={ownedSharedNoteIds}
          refreshing={feedRefreshing}
          onRefresh={() => {
            void refreshHome();
          }}
          topInset={insets.top}
          snapHeight={snapHeight}
          onOpenNote={openNote}
          onOpenSharedPost={openSharedPost}
          colors={colors}
          t={t}
          onSettledArchiveItemChange={handleSettledArchiveItemChange}
          onCaptureVisibilityChange={setIsCaptureVisible}
          onCaptureScrollSettledChange={setIsCaptureScrollSettled}
          onInitialContentDraw={markHomeFeedReady}
          scrollEnabled={
            !isCaptureTextEntryFocused &&
            !isLivePhotoCaptureInProgress
          }
          capturePageLocked={shouldLockCapturePage}
        />
      </View>

      <SavedNotePolaroidReveal
        note={savedNoteRevealNote}
        isSharedByMe={savedNoteRevealIsSharedByMe}
        revealToken={savedNoteRevealToken}
        bottomTabInset={bottomTabVisualInset}
        colors={colors}
        t={t}
        onFinished={handleSavedNoteRevealFinished}
      />

      <HomeHeaderSearch
        topInset={insets.top}
        isSearching={false}
        searchAnim={searchAnim}
        searchQuery=""
        onSearchChange={() => {}}
        onOpenSearch={() => {
          router.push('/search' as Href);
        }}
        onCloseSearch={() => {}}
        showSearchButton={showLegacySearchButton}
        showSharedButton
        showNotesButton
        onOpenShared={handleOpenSharedManage}
        onOpenNotes={handleOpenNotes}
        sharedButtonMode={settledSharedButtonMode}
        sharedButtonActive={settledSharedButtonMode === 'filter' && isFriendsFilterEnabled}
        sharedFilterValue={isFriendsFilterEnabled ? 'friends' : 'all'}
        onChangeSharedFilter={(nextFilter) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsFriendsFilterEnabled(nextFilter === 'friends');
        }}
        hasFriendsForFilter={friends.length > 0}
        onToggleCaptureMode={handleToggleCaptureMode}
        captureMode={captureMode}
        colors={colors}
        isDark={isDark}
        t={t}
        showDockedBlur
      />

      {showSharedManageSheet ? (
        <SharedManageSheet
          visible={showSharedManageSheet}
          friends={friends}
          activeInvite={activeInvite}
          creatingInvite={inviteActionInFlight === 'create'}
          loading={sharedLoading}
          onClose={dismissSharedManageSheet}
          onCreateInvite={() => {
            void handleCreateInvite();
          }}
          onShareInvite={() => {
            void handleShareInvite();
          }}
          onRevokeInvite={() => {
            void handleRevokeInvite();
          }}
          onOpenFriendSearch={() => {
            dismissSharedManageSheet();
            router.push('/friends/join' as Href);
          }}
          onRemoveFriend={handleRemoveFriend}
        />
      ) : null}

      {alertProps.visible ? <AppSheetAlert {...alertProps} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurTarget: {
    flex: 1,
  },
  captureItemWrapper: {
    width: '100%',
  },
});
