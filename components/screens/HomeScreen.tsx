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
import CaptureCard, { type CaptureCardHandle } from '../home/CaptureCard';
import {
  buildHomeFeedItems,
  findHomeFeedItemIndex,
  getHomeFeedItemKey,
} from '../home/feedItems';
import HomeHeaderSearch from '../home/HomeHeaderSearch';
import NotesFeed from '../home/NotesFeed';
import SavedNotePolaroidReveal from '../home/SavedNotePolaroidReveal';
import SharedManageSheet from '../home/SharedManageSheet';
import { useHomeSharedActions } from '../../hooks/app/useHomeSharedActions';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useActiveFeedTarget } from '../../hooks/useActiveFeedTarget';
import { useAuth } from '../../hooks/useAuth';
import { useCaptureFlow } from '../../hooks/useCaptureFlow';
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
import { useSubscription } from '../../hooks/useSubscription';
import { useTheme } from '../../hooks/useTheme';
import { useAndroidBottomTabOverlayInset } from '../../hooks/useAndroidBottomTabOverlayInset';
import { useBottomTabVisualInset } from '../../hooks/useBottomTabVisualInset';
import { useSavedNoteRevealUi } from '../../hooks/ui/useSavedNoteRevealUi';
import {
  canCreatePhotoNote,
  countPhotoNotes,
  getRemainingPhotoSlots,
} from '../../constants/subscription';
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
import { getSharedFeedErrorMessage } from '../../services/sharedFeedService';
import type { NotesRouteTransitionRect } from '../../utils/notesRouteTransition';
import { setPendingNotesRouteTransition } from '../../utils/notesRouteTransition';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';
import { getPersistentItem, setPersistentItem } from '../../utils/appStorage';
import { setAndroidSoftInputMode } from '../../utils/androidSoftInputMode';
import { isIOS26OrNewer } from '../../utils/platform';

const LIVE_PHOTO_CAMERA_HINT_SEEN_KEY = 'noto.capture.live-photo-hint-seen.v1';
type SaveButtonState = 'idle' | 'saving' | 'success';

function logHomeFeedDebug(event: string, payload: Record<string, unknown>) {
  if (!__DEV__) {
    return;
  }

  console.log(`[home-feed] ${event}`, payload);
}

export default function HomeScreen() {
  const { openSharedManageAt } = useLocalSearchParams<{ openSharedManageAt?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const bottomTabOverlayInset = useAndroidBottomTabOverlayInset();
  const bottomTabVisualInset = useBottomTabVisualInset();
  const { setSavedNoteRevealActive } = useSavedNoteRevealUi();
  const notesStore = useNotesStore();
  const { notes, loading, loadNextNotesPage, refreshNotes, createNote } = notesStore;
  const notesInitialLoadComplete = notesStore.initialLoadComplete ?? !loading;
  const noteCount = notesStore.noteCount ?? notes.length;
  const localPhotoNoteCount = notesStore.photoNoteCount ?? countPhotoNotes(notes);
  const { user, isAuthAvailable } = useAuth();
  const {
    enabled: sharedEnabled,
    loading: sharedLoading,
    friends,
    sharedPosts,
    activeInvite,
    refreshSharedFeed,
    createFriendInvite,
    revokeFriendInvite,
    removeFriend,
    createSharedPost,
  } = useSharedFeedStore();
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
    consumeFeedFocus,
  } = useFeedFocus();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const showLegacySearchButton = Platform.OS === 'ios' && !isIOS26OrNewer;

  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveButtonState, setSaveButtonState] = useState<SaveButtonState>('idle');
  const [suppressedHomeNoteIds, setSuppressedHomeNoteIds] = useState<string[]>([]);
  const [importingPhoto, setImportingPhoto] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isCaptureTextEntryFocused, setIsCaptureTextEntryFocused] = useState(false);
  const [lockedCaptureSnapHeight, setLockedCaptureSnapHeight] = useState<number | null>(null);
  const [captureInteractionScrollLocked, setCaptureInteractionScrollLocked] = useState(false);
  const [isCaptureVisible, setIsCaptureVisible] = useState(true);
  const [isCaptureScrollSettled, setIsCaptureScrollSettled] = useState(true);
  const [settledSharedButtonMode, setSettledSharedButtonMode] = useState<'manage' | 'filter'>('manage');
  const [isFriendsFilterEnabled, setIsFriendsFilterEnabled] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<'private' | 'shared'>('private');
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
  const saveInFlightRef = useRef(false);
  const settledArchiveItemRef = useRef<{ id: string; kind: 'note' | 'shared-post' } | null>(null);
  const previousVisibleFeedItemKeysRef = useRef<string[] | null>(null);
  const lastHandledOpenSharedManageAtRef = useRef<string | null>(null);
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
      params: { intent: 'share-note' },
    } as Href);
  }, [router]);
  const {
    captureMode,
    cameraSessionKey,
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
  } = useCaptureFlow();
  const isCameraPreviewActive =
    captureMode === 'camera' &&
    isCaptureVisible &&
    isScreenFocused &&
    appState === 'active' &&
    Boolean(permission?.granted);

  const liveSnapHeight = windowHeight - insets.top - 90;
  const shouldLockCapturePage = Platform.OS === 'android' && isCaptureTextEntryFocused;
  const snapHeight =
    shouldLockCapturePage && lockedCaptureSnapHeight != null ? lockedCaptureSnapHeight : liveSnapHeight;

  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== user?.uid),
    [sharedPosts, user?.uid]
  );
  const homeFeedItems = useMemo(
    () => buildHomeFeedItems(notes, friendPosts),
    [friendPosts, notes]
  );
  const homeFeedHasMore = noteCount > notes.length;
  const ensureTargetLoaded = useCallback(async (
    target: { id: string; kind: 'note' | 'shared-post' }
  ) => {
    let currentNotes = notes;
    let currentItems = buildHomeFeedItems(currentNotes, friendPosts);
    let targetIndex = findHomeFeedItemIndex(currentItems, target);
    if (targetIndex >= 0) {
      return targetIndex;
    }

    if (target.kind !== 'note') {
      return -1;
    }

    while (currentNotes.length < noteCount) {
      const previousCount = currentNotes.length;
      const nextNotes = await loadNextNotesPage();
      if (nextNotes.length <= previousCount) {
        break;
      }

      currentNotes = nextNotes;
      currentItems = buildHomeFeedItems(currentNotes, friendPosts);
      targetIndex = findHomeFeedItemIndex(currentItems, target);
      if (targetIndex >= 0) {
        return targetIndex;
      }
    }

    return -1;
  }, [friendPosts, loadNextNotesPage, noteCount, notes]);
  const photoNoteCount = useMemo(
    () => Math.max(localPhotoNoteCount, remotePhotoNoteCount ?? 0),
    [localPhotoNoteCount, remotePhotoNoteCount]
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
  const suppressedHomeNoteIdSet = useMemo(
    () => new Set(suppressedHomeNoteIds),
    [suppressedHomeNoteIds]
  );
  const isFriendsFilterActive = useMemo(
    () => isFriendsFilterEnabled,
    [isFriendsFilterEnabled]
  );

  const cameraPermissionRequiresSettings =
    captureMode === 'camera' &&
    permission?.granted === false &&
    permission.canAskAgain === false;
  const ownedSharedNoteIds = useMemo(
    () => (
      user
        ? Array.from(
            new Set(
              sharedPosts
                .filter((post) => post.authorUid === user.uid && typeof post.sourceNoteId === 'string' && post.sourceNoteId.trim().length > 0)
                .map((post) => post.sourceNoteId as string)
            )
          )
        : []
    ),
    [sharedPosts, user]
  );
  const savedNoteRevealIsSharedByMe = useMemo(
    () => Boolean(savedNoteRevealNote && ownedSharedNoteIds.includes(savedNoteRevealNote.id)),
    [ownedSharedNoteIds, savedNoteRevealNote]
  );
  const visibleFeedItems = useMemo(
    () => {
      if (isFriendsFilterActive) {
        return homeFeedItems.filter((item) => item.kind === 'shared-post');
      }

      return homeFeedItems.filter((item) => {
        if (item.kind === 'note') {
          return !suppressedHomeNoteIdSet.has(item.id);
        }

        return true;
      });
    },
    [homeFeedItems, isFriendsFilterActive, suppressedHomeNoteIdSet]
  );
  useEffect(() => {
    if (!notesInitialLoadComplete) {
      resetHomeFeedReady();
      return;
    }

    if (visibleFeedItems.length === 0) {
      markHomeFeedReady();
    }
  }, [
    markHomeFeedReady,
    notesInitialLoadComplete,
    resetHomeFeedReady,
    visibleFeedItems.length,
  ]);

  useEffect(() => {
    logHomeFeedDebug('state', {
      userUid: user?.uid ?? null,
      noteCount,
      loadedNotesCount: notes.length,
      loading,
      sharedLoading,
      homeFeedHasMore,
      homeFeedItemsCount: homeFeedItems.length,
      visibleFeedItemsCount: visibleFeedItems.length,
    });
  }, [
    homeFeedHasMore,
    homeFeedItems.length,
    loading,
    noteCount,
    notes.length,
    sharedLoading,
    user?.uid,
    visibleFeedItems.length,
  ]);
  useEffect(() => {
    if (friendPosts.length === 0 && isFriendsFilterEnabled) {
      setIsFriendsFilterEnabled(false);
    }
  }, [friendPosts.length, isFriendsFilterEnabled]);

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

  const resetCaptureDraft = useCallback(() => {
    captureCardRef.current?.dismissInputs?.();
    resetCapture();
    captureCardRef.current?.resetDoodle();
    captureCardRef.current?.resetStickers();
  }, [resetCapture]);

  const finalizeSavedCapture = useCallback(() => {
    resetCaptureDraft();
    setCaptureTarget('private');
    setNoteColor(DEFAULT_NOTE_COLOR_ID);
    lastFreeNoteColorRef.current = DEFAULT_NOTE_COLOR_ID;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [resetCaptureDraft]);

  const handleChangeNoteColor = useCallback((nextColor: string | null) => {
    const resolvedColor = nextColor ?? DEFAULT_NOTE_COLOR_ID;
    setNoteColor(resolvedColor);
    if (!isPreviewablePremiumNoteColor(resolvedColor)) {
      lastFreeNoteColorRef.current = resolvedColor;
    }
  }, []);

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

    let cancelled = false;
    const scheduledTargetId = pendingSavedNoteScrollTargetId;

    void (async () => {
      const targetIndex = await ensureTargetLoaded({
        id: scheduledTargetId,
        kind: 'note',
      });
      if (cancelled || targetIndex < 0) {
        return;
      }

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
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureTargetLoaded, pendingSavedNoteScrollTargetId, snapHeight, suppressedHomeNoteIds]);

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
      dismissSharedManageSheet();
    }
  }, [dismissSharedManageSheet, user]);

  useEffect(() => {
    if (!sharedEnabled || friends.length === 0) {
      setCaptureTarget('private');
    }
  }, [friends.length, sharedEnabled]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissSharedManageSheet();
      };
    }, [dismissSharedManageSheet])
  );

  useFocusEffect(
    useCallback(() => {
      const target = consumeFeedFocus?.() ?? peekFeedFocus?.() ?? null;
      if (!target) {
        return undefined;
      }

      const settledItem = settledArchiveItemRef.current;
      if (settledItem?.kind === target.kind && settledItem.id === target.id) {
        clearFeedFocus?.();
        return undefined;
      }

      let focusTimeout: ReturnType<typeof setTimeout> | null = null;
      let idleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
      let cancelled = false;

      void (async () => {
        const targetIndex = await ensureTargetLoaded(target);
        if (cancelled) {
          return;
        }

        if (targetIndex < 0) {
          clearFeedFocus?.();
          return;
        }

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
      })();

      return () => {
        cancelled = true;
        idleHandle?.cancel();
        if (focusTimeout) {
          clearTimeout(focusTimeout);
        }
      };
    }, [
      clearFeedFocus,
      consumeFeedFocus,
      ensureTargetLoaded,
      homeFeedItems.length,
      loading,
      peekFeedFocus,
      sharedLoading,
      snapHeight,
    ])
  );

  const onRefresh = useCallback(async () => {
    const hasNetworkRefreshWork = Boolean(user && sharedEnabled);

    if (!hasNetworkRefreshWork) {
      await refreshNotes(false);
      setSuppressedHomeNoteIds([]);
      return;
    }

    setRefreshing(true);
    try {
      await refreshNotes(false);
      setSuppressedHomeNoteIds([]);

      if (user && sharedEnabled) {
        try {
          await refreshSharedFeed();
        } catch (error) {
          console.warn('Shared feed refresh failed:', error);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotes, refreshSharedFeed, sharedEnabled, user]);

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

    const promptReminderPermissionsFromDisclosure = () => {
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
    };

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
  }, [queueScrollToSavedNote, releaseSuppressedHomeNoteId, remindersEnabled, requestReminderPermissions, showAlert, showDoneSheet, t]);

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
              'Free plan includes up to 10 photo notes. Upgrade to Noto Plus for unlimited photo notes, premium filters, and premium finishes.'
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
          t('capture.photoLimitCheckingTitle', 'Checking photo limit'),
          t(
            'capture.photoLimitCheckingMessage',
            'We are still loading your account photo usage. Try again in a moment.'
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
              await createSharedPost(createdNote);
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
    setCaptureInteractionScrollLocked(false);
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
          onInteractionLockChange={setCaptureInteractionScrollLocked}
          onTextEntryFocusChange={handleCaptureTextEntryFocusChange}
        />
      </View>
    ),
    [
      cameraDevice,
      cameraPermissionRequiresSettings,
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
          captureMode={captureMode}
          screenActive={isScreenFocused}
          items={visibleFeedItems}
          ownedSharedNoteIds={ownedSharedNoteIds}
          refreshing={refreshing}
          onRefresh={() => {
            void onRefresh();
          }}
          onEndReached={
            homeFeedHasMore
              ? () => {
                  logHomeFeedDebug('onEndReached', {
                    userUid: user?.uid ?? null,
                    noteCount,
                    loadedNotesCount: notes.length,
                    loading,
                    sharedLoading,
                    homeFeedHasMore,
                    visibleFeedItemsCount: visibleFeedItems.length,
                  });
                  void loadNextNotesPage();
                }
              : undefined
          }
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
            !captureInteractionScrollLocked &&
            !isCaptureTextEntryFocused
          }
          capturePageLocked={shouldLockCapturePage}
          bottomOverlayInset={bottomTabOverlayInset}
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

      <AppSheetAlert {...alertProps} />
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
