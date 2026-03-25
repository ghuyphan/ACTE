import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useScrollToTop } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Href, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppSheetAlert from '../../components/AppSheetAlert';
import CaptureCard, { type CaptureCardHandle } from '../../components/home/CaptureCard';
import HomeHeaderSearch from '../../components/home/HomeHeaderSearch';
import NotesFeed from '../../components/home/NotesFeed';
import SharedManageSheet from '../../components/home/SharedManageSheet';
import InfoPill from '../../components/ui/InfoPill';
import TransientStatusChip from '../../components/ui/TransientStatusChip';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useAuth } from '../../hooks/useAuth';
import { useCaptureFlow } from '../../hooks/useCaptureFlow';
import { useFeedFocus } from '../../hooks/useFeedFocus';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useSubscription } from '../../hooks/useSubscription';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/theme';
import {
  canCreatePhotoNote,
  countPhotoNotes,
  getRemainingPhotoSlots,
} from '../../constants/subscription';
import { resolveAutoNoteEmoji } from '../../services/noteDecorations';
import { saveNoteDoodle } from '../../services/noteDoodles';
import { filterNotesByQuery } from '../../services/noteSearch';
import { Note } from '../../services/database';
import { getSharedFeedErrorMessage, SharedPost } from '../../services/sharedFeedService';
import { isIOS26OrNewer } from '../../utils/platform';

const { height } = Dimensions.get('window');

type FeedFocusItem =
  | { id: string; kind: 'note'; createdAt: string; note: Note }
  | { id: string; kind: 'shared-post'; createdAt: string; post: SharedPost };

type SaveButtonState = 'idle' | 'saving' | 'success';
type InlineSaveFeedbackVariant = 'saved' | 'shared';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { notes, loading, refreshNotes, createNote } = useNotesStore();
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
    isPurchaseInFlight,
    plusPriceLabel,
    canImportFromLibrary,
    remotePhotoNoteCount,
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
  const { consumeFeedFocus } = useFeedFocus();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const useNativeTabSearch = isIOS26OrNewer;
  const useInlineHeaderSearch = !useNativeTabSearch;

  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveButtonState, setSaveButtonState] = useState<SaveButtonState>('idle');
  const [inlineSaveFeedback, setInlineSaveFeedback] = useState<{
    token: number;
    variant: InlineSaveFeedbackVariant;
  } | null>(null);
  const [importingPhoto, setImportingPhoto] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(Platform.OS !== 'android');
  const [captureScrollLocked, setCaptureScrollLocked] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<'private' | 'shared'>('private');
  const [showSharedManageSheet, setShowSharedManageSheet] = useState(false);
  const [sharedManageSheetVersion, setSharedManageSheetVersion] = useState(0);
  const [revealedNoteId, setRevealedNoteId] = useState<string | null>(null);
  const [revealToken, setRevealToken] = useState(0);
  const [, startSearchTransition] = useTransition();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);
  const captureCardRef = useRef<CaptureCardHandle | null>(null);
  const finalizeInlineSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetSaveStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearInlineFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusSavedNoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useScrollToTop(flatListRef);

  const dismissSharedManageSheet = useCallback(() => {
    setShowSharedManageSheet(false);
  }, []);

  const presentSharedManageSheet = useCallback(() => {
    setSharedManageSheetVersion((current) => current + 1);
    setShowSharedManageSheet(true);
  }, []);

  const openAuthForShare = useCallback(() => {
    router.push({
      pathname: '/auth',
      params: { intent: 'share-note' },
    } as Href);
  }, [router]);

  const {
    captureMode,
    cameraSessionKey,
    restaurantName,
    setRestaurantName,
    noteText,
    setNoteText,
    capturedPhoto,
    setCapturedPhoto,
    radius,
    setRadius,
    facing,
    setFacing,
    permission,
    requestPermission,
    cameraRef,
    captureScale,
    captureTranslateY,
    flashAnim,
    shutterScale,
    toggleCaptureMode,
    handleShutterPressIn,
    handleShutterPressOut,
    takePicture,
    needsCameraPermission,
    resetCapture,
  } = useCaptureFlow();

  const snapHeight = height - insets.top - 90;

  const filteredNotes = useMemo(() => {
    return filterNotesByQuery(notes, deferredSearchQuery);
  }, [deferredSearchQuery, notes]);
  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== user?.uid),
    [sharedPosts, user?.uid]
  );
  const archiveFeedItems = useMemo<FeedFocusItem[]>(
    () =>
      [
        ...notes.map((note) => ({
          id: note.id,
          kind: 'note' as const,
          createdAt: note.createdAt,
          note,
        })),
        ...friendPosts.map((post) => ({
          id: post.id,
          kind: 'shared-post' as const,
          createdAt: post.createdAt,
          post,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [friendPosts, notes]
  );
  const localPhotoNoteCount = useMemo(() => countPhotoNotes(notes), [notes]);
  const photoNoteCount = useMemo(
    () => Math.max(localPhotoNoteCount, remotePhotoNoteCount ?? 0),
    [localPhotoNoteCount, remotePhotoNoteCount]
  );
  const canSaveAnotherPhotoNote = useMemo(
    () => canCreatePhotoNote(tier, photoNoteCount),
    [photoNoteCount, tier]
  );
  const remainingPhotoSlots = useMemo(
    () => getRemainingPhotoSlots(tier, photoNoteCount),
    [photoNoteCount, tier]
  );
  const cameraStatusText = useMemo(() => {
    if (tier === 'plus') {
      return null;
    }

    if (remainingPhotoSlots === null) {
      return null;
    }

    if (remainingPhotoSlots === 0) {
      return t(
        'capture.photoLimitReachedHint',
        'Free plan photo limit reached. Upgrade to Noto Plus to add more photo notes and import from your library.'
      );
    }

    return null;
  }, [remainingPhotoSlots, t, tier]);

  const displayedNotes = useInlineHeaderSearch && isSearching ? filteredNotes : notes;
  const shouldRenderCameraPreview =
    captureMode === 'camera' &&
    isScreenFocused &&
    appState === 'active' &&
    cameraPreviewReady;
  const visibleSharedPosts = useMemo(
    () =>
      useInlineHeaderSearch && isSearching ? [] : friendPosts,
    [friendPosts, isSearching, useInlineHeaderSearch]
  );

  const resetCaptureDraft = useCallback(() => {
    resetCapture();
    captureCardRef.current?.resetDoodle();
  }, [resetCapture]);

  const finalizeSavedCapture = useCallback(() => {
    resetCaptureDraft();
    setCaptureTarget('private');
  }, [resetCaptureDraft]);

  const clearInlineSaveTimers = useCallback(() => {
    if (finalizeInlineSaveTimeoutRef.current) {
      clearTimeout(finalizeInlineSaveTimeoutRef.current);
      finalizeInlineSaveTimeoutRef.current = null;
    }

    if (resetSaveStateTimeoutRef.current) {
      clearTimeout(resetSaveStateTimeoutRef.current);
      resetSaveStateTimeoutRef.current = null;
    }

    if (clearInlineFeedbackTimeoutRef.current) {
      clearTimeout(clearInlineFeedbackTimeoutRef.current);
      clearInlineFeedbackTimeoutRef.current = null;
    }

    if (focusSavedNoteTimeoutRef.current) {
      clearTimeout(focusSavedNoteTimeoutRef.current);
      focusSavedNoteTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearInlineSaveTimers();
    };
  }, [clearInlineSaveTimers]);

  const completeInlineSaveFlow = useCallback(
    (noteId: string, variant: InlineSaveFeedbackVariant) => {
      const token = Date.now();
      const finalizeDelay = reduceMotionEnabled ? 120 : 520;
      const focusNoteDelay = reduceMotionEnabled ? 140 : 380;
      const resetStateDelay = reduceMotionEnabled ? 240 : 1080;
      const clearFeedbackDelay = reduceMotionEnabled ? 1200 : 2200;

      clearInlineSaveTimers();
      setSaveButtonState('success');
      setInlineSaveFeedback({ token, variant });
      setRevealedNoteId(noteId);
      setRevealToken((current) => current + 1);

      finalizeInlineSaveTimeoutRef.current = setTimeout(() => {
        finalizeSavedCapture();
        finalizeInlineSaveTimeoutRef.current = null;
      }, finalizeDelay);

      focusSavedNoteTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: snapHeight,
          animated: !reduceMotionEnabled,
        });
        focusSavedNoteTimeoutRef.current = null;
      }, focusNoteDelay);

      resetSaveStateTimeoutRef.current = setTimeout(() => {
        setSaveButtonState('idle');
        resetSaveStateTimeoutRef.current = null;
      }, resetStateDelay);

      clearInlineFeedbackTimeoutRef.current = setTimeout(() => {
        setInlineSaveFeedback((current) => (current?.token === token ? null : current));
        clearInlineFeedbackTimeoutRef.current = null;
      }, clearFeedbackDelay);
    },
    [clearInlineSaveTimers, finalizeSavedCapture, reduceMotionEnabled, snapHeight]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setCameraPreviewReady(true);
      return;
    }

    if (captureMode !== 'camera' || !isScreenFocused || appState !== 'active') {
      setCameraPreviewReady(false);
      return;
    }

    let cancelled = false;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      const timeout = setTimeout(() => {
        if (!cancelled) {
          setCameraPreviewReady(true);
        }
      }, 180);

      return () => {
        clearTimeout(timeout);
      };
    });

    return () => {
      cancelled = true;
      setCameraPreviewReady(false);
      interactionHandle.cancel();
    };
  }, [appState, captureMode, isScreenFocused]);

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
      if (loading || (sharedLoading && archiveFeedItems.length === 0)) {
        return undefined;
      }

      const target = consumeFeedFocus();
      if (!target) {
        return undefined;
      }

      if (useInlineHeaderSearch) {
        Keyboard.dismiss();
        searchAnim.stopAnimation();
        searchAnim.setValue(0);
        if (isSearching || searchQuery.length > 0) {
          setIsSearching(false);
          setSearchQuery('');
        }
      }

      const targetIndex = archiveFeedItems.findIndex(
        (item) => item.kind === target.kind && item.id === target.id
      );
      if (targetIndex < 0) {
        return undefined;
      }

      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        const timeout = setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: (targetIndex + 1) * snapHeight,
            animated: true,
          });
        }, 0);

        return () => {
          clearTimeout(timeout);
        };
      });

      return () => {
        interactionHandle.cancel();
      };
    }, [
      archiveFeedItems,
      consumeFeedFocus,
      isSearching,
      loading,
      searchAnim,
      searchQuery.length,
      sharedLoading,
      snapHeight,
      useInlineHeaderSearch,
    ])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshNotes(false);

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

  const showSavedSheet = useCallback((onClose?: () => void) => {
    if (remindersEnabled) {
      showAlert({
        variant: 'success',
        title: t('capture.saved', 'Saved!'),
        message: t('capture.savedMsg', "We'll remind you next time you're here!"),
        onClose,
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
      onClose,
      primaryAction: {
        label: t('capture.enableReminders', 'Enable reminders'),
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
        label: t('common.done', 'Done'),
        variant: 'secondary',
      },
    });
  }, [remindersEnabled, requestReminderPermissions, showAlert, showDoneSheet, t]);

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

  const showSharedSaveSheet = useCallback(
    (
      status: 'shared' | 'no-friends' | 'share-failed',
      onClose?: () => void,
      failureMessage?: string | null
    ) => {
      if (status === 'shared') {
        showAlert({
          variant: 'success',
          title: t('shared.savedSharedTitle', 'Saved and shared'),
          message: t(
            'shared.savedSharedBody',
            'This note is in your journal and has been published to your shared Home feed.'
          ),
          onClose,
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
          onClose,
          primaryAction: {
            label: t('shared.inviteFriendButton', 'Invite friend'),
            onPress: () => {
              presentSharedManageSheet();
            },
          },
          secondaryAction: {
            label: t('common.done', 'Done'),
            variant: 'secondary',
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
        onClose,
        primaryAction: {
          label: t('common.done', 'Done'),
        },
      });
    },
    [presentSharedManageSheet, showAlert, t]
  );

  const showPlusSheet = useCallback(
    (reason: 'limit' | 'library') => {
      const title =
        reason === 'library'
          ? t('plus.libraryTitle', 'Noto Plus unlock')
          : t('plus.limitTitle', 'Photo limit reached');
      const message =
        reason === 'library'
          ? t(
              'plus.libraryMessage',
              'Upgrade to Noto Plus to create notes from photos already in your library.'
            )
          : t(
              'plus.limitMessage',
              'Free plan includes up to 10 photo notes. Upgrade to Noto Plus to save more image notes and import from your library.'
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
                      'You can now save more photo notes and import images from your library.'
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
                  message: t(
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

  const reverseGeocode = useCallback(
    async (lat: number, lon: number): Promise<string> => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (results.length > 0) {
          const result = results[0];
          const parts = [result.name, result.street, result.city].filter(Boolean);
          return parts.join(', ') || t('capture.unknownPlace', 'Unknown Place');
        }
      } catch {
        return t('capture.unknownPlace', 'Unknown Place');
      }
      return t('capture.unknownPlace', 'Unknown Place');
    },
    [t]
  );

  const saveNote = useCallback(async () => {
    let currentLocation = location;
    let requiresSettings = false;

    if (!currentLocation) {
      const locationResult = await requestForegroundLocation();
      currentLocation = locationResult.location;
      requiresSettings = locationResult.requiresSettings;
    }

    if (!currentLocation) {
      showDoneSheet(
        'error',
        t('capture.error', 'Error'),
        t('capture.noLocation', 'Could not get your location'),
        requiresSettings
      );
      return;
    }

    const doodleSnapshot = captureCardRef.current?.getDoodleSnapshot() ?? {
      enabled: false,
      strokes: [],
    };

    if (captureMode === 'text' && !noteText.trim() && doodleSnapshot.strokes.length === 0) {
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

    if (captureMode === 'camera' && !canSaveAnotherPhotoNote) {
      showPlusSheet('limit');
      return;
    }

    clearInlineSaveTimers();
    setInlineSaveFeedback(null);
    setSaveButtonState('saving');
    setSaving(true);
    let destinationPath: string | null = null;

    try {
      const doodleStrokesJson =
        doodleSnapshot.strokes.length > 0
          ? JSON.stringify(doodleSnapshot.strokes)
          : null;
      const lat = currentLocation.coords.latitude;
      const lon = currentLocation.coords.longitude;
      const geocodedName = await reverseGeocode(lat, lon);
      const locationName = restaurantName.trim() || geocodedName;

      let content = noteText.trim();

      if (captureMode === 'camera' && capturedPhoto) {
        const directory = `${FileSystem.documentDirectory}photos/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const filename = `note-${Date.now()}.jpg`;
        destinationPath = `${directory}${filename}`;
        await FileSystem.copyAsync({ from: capturedPhoto, to: destinationPath });
        content = destinationPath;
      }

      const autoEmoji = resolveAutoNoteEmoji({
        type: captureMode === 'camera' ? 'photo' : 'text',
        content: captureMode === 'camera' ? locationName : content,
        locationName,
      });

      const createdNote = await createNote({
        type: captureMode === 'camera' ? 'photo' : 'text',
        content,
        photoLocalUri: captureMode === 'camera' ? content : null,
        locationName,
        promptId: null,
        promptTextSnapshot: null,
        promptAnswer: null,
        moodEmoji: autoEmoji,
        latitude: lat,
        longitude: lon,
        radius,
        hasDoodle: Boolean(doodleStrokesJson),
        doodleStrokesJson,
      });

      if (doodleStrokesJson) {
        await saveNoteDoodle(createdNote.id, doodleStrokesJson);
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
        completeInlineSaveFlow(createdNote.id, 'saved');
      } else if (shareOutcome === 'shared') {
        completeInlineSaveFlow(createdNote.id, 'shared');
      } else if (shareOutcome === 'default') {
        setSaveButtonState('idle');
        showSavedSheet(finalizeSavedCapture);
      } else {
        setSaveButtonState('idle');
        showSharedSaveSheet(shareOutcome, finalizeSavedCapture, shareFailureMessage);
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaveButtonState('idle');
      if (destinationPath) {
        try {
          await FileSystem.deleteAsync(destinationPath, { idempotent: true });
        } catch (cleanupError) {
          console.warn('Failed to clean up orphaned photo file:', cleanupError);
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
  }, [
    location,
    requestForegroundLocation,
    clearInlineSaveTimers,
    completeInlineSaveFlow,
    showDoneSheet,
    t,
    captureMode,
    noteText,
    capturedPhoto,
    reverseGeocode,
    restaurantName,
    createNote,
    radius,
    finalizeSavedCapture,
    showSavedSheet,
    canSaveAnotherPhotoNote,
    captureTarget,
    createSharedPost,
    friends.length,
    remindersEnabled,
    sharedEnabled,
    showPlusSheet,
    showSharedSaveSheet,
    user,
  ]);

  const handleImportPhoto = useCallback(async () => {
    if (!canImportFromLibrary) {
      showPlusSheet('library');
      return;
    }

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
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.35,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCapturedPhoto(result.assets[0].uri);
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
  }, [canImportFromLibrary, setCapturedPhoto, showDoneSheet, showPlusSheet, t]);

  const handleOpenSearch = useCallback(() => {
    if (!useInlineHeaderSearch) {
      return;
    }
    setIsSearching(true);
    Animated.timing(searchAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    flatListRef.current?.scrollToOffset({ offset: snapHeight, animated: true });
  }, [searchAnim, snapHeight, useInlineHeaderSearch]);

  const handleCloseSearch = useCallback(() => {
    if (!useInlineHeaderSearch) {
      return;
    }
    Keyboard.dismiss();
    Animated.timing(searchAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setIsSearching(false);
      setSearchQuery('');
    });
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [searchAnim, useInlineHeaderSearch]);

  const handleToggleCaptureMode = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    toggleCaptureMode();
  }, [toggleCaptureMode]);

  const handleOpenNotes = useCallback(() => {
    Keyboard.dismiss();
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

  const handleCaptureTargetChange = useCallback(
    (nextTarget: 'private' | 'shared') => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (nextTarget === 'shared') {
        if (!sharedEnabled || !isAuthAvailable) {
          showSharedUnavailableSheet();
          return;
        }

        if (!user) {
          openAuthForShare();
          return;
        }

        if (friends.length === 0) {
          presentSharedManageSheet();
          return;
        }
      }

      setCaptureTarget(nextTarget);
    },
    [
      friends.length,
      isAuthAvailable,
      openAuthForShare,
      presentSharedManageSheet,
      sharedEnabled,
      showSharedUnavailableSheet,
      user,
    ]
  );

  const handleOpenSharedManage = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!sharedEnabled || !isAuthAvailable) {
      showSharedUnavailableSheet();
      return;
    }

    if (!user) {
      openAuthForShare();
      return;
    }

    presentSharedManageSheet();
  }, [isAuthAvailable, openAuthForShare, presentSharedManageSheet, sharedEnabled, showSharedUnavailableSheet, user]);

  const handleOpenSharedAuth = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!isAuthAvailable) {
      showSharedUnavailableSheet();
      return;
    }

    openAuthForShare();
  }, [isAuthAvailable, openAuthForShare, showSharedUnavailableSheet]);

  const handleShareInvite = useCallback(async () => {
    if (!user) {
      handleOpenSharedAuth();
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      dismissSharedManageSheet();
      const invite = activeInvite ?? (await createFriendInvite());
      await Share.share({
        message: t('shared.inviteShareMessage', 'Join my Noto shared feed: {{url}}', {
          url: invite.url,
        }),
        url: invite.url,
      });
    } catch (error) {
      Alert.alert(
        t('shared.inviteFailedTitle', 'Could not prepare invite'),
        getSharedFeedErrorMessage(error)
      );
    }
  }, [activeInvite, createFriendInvite, dismissSharedManageSheet, handleOpenSharedAuth, t, user]);

  const handleRevokeInvite = useCallback(async () => {
    if (!activeInvite) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await revokeFriendInvite(activeInvite.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(
        t('shared.inviteFailedTitle', 'Could not prepare invite'),
        getSharedFeedErrorMessage(error)
      );
    }
  }, [activeInvite, revokeFriendInvite, t]);

  const handleRemoveFriend = useCallback(
    (friendUid: string) => {
      Alert.alert(
        t('shared.removeFriendTitle', 'Remove friend'),
        t(
          'shared.removeFriendBody',
          'This friend will stop seeing the moments you share from Home.'
        ),
        [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
          },
          {
            text: t('shared.removeFriendConfirm', 'Remove'),
            style: 'destructive',
            onPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void removeFriend(friendUid)
                .then(() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                })
                .catch((error) => {
                  Alert.alert(
                    t('shared.removeFriendTitle', 'Remove friend'),
                    getSharedFeedErrorMessage(error)
                  );
                });
            },
          },
        ]
      );
    },
    [removeFriend, t]
  );

  const handleSearchChange = useCallback((nextQuery: string) => {
    startSearchTransition(() => {
      setSearchQuery(nextQuery);
    });
  }, [startSearchTransition]);

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const captureHeader = (
    <View style={styles.captureItemWrapper}>
      <CaptureCard
        ref={captureCardRef}
        snapHeight={snapHeight}
        topInset={insets.top}
        isSearching={isSearching}
        captureMode={captureMode}
        cameraSessionKey={cameraSessionKey}
        captureScale={captureScale}
        captureTranslateY={captureTranslateY}
        colors={colors}
        t={t}
        noteText={noteText}
        onChangeNoteText={setNoteText}
        restaurantName={restaurantName}
        onChangeRestaurantName={setRestaurantName}
        capturedPhoto={capturedPhoto}
        onRetakePhoto={() => setCapturedPhoto(null)}
        needsCameraPermission={needsCameraPermission}
        onRequestCameraPermission={requestPermission}
        facing={facing}
        onToggleFacing={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
        onOpenPhotoLibrary={() => {
          void handleImportPhoto();
        }}
        cameraRef={cameraRef}
        shouldRenderCameraPreview={shouldRenderCameraPreview}
        flashAnim={flashAnim}
        permissionGranted={Boolean(permission?.granted)}
        onShutterPressIn={handleShutterPressIn}
        onShutterPressOut={handleShutterPressOut}
        onTakePicture={() => {
          void takePicture();
        }}
        onSaveNote={() => {
          void saveNote();
        }}
        saving={saving}
        saveState={saveButtonState}
        shutterScale={shutterScale}
        cameraStatusText={captureMode === 'camera' ? cameraStatusText : null}
        remainingPhotoSlots={captureMode === 'camera' ? remainingPhotoSlots : null}
        libraryImportLocked={!canImportFromLibrary}
        importingPhoto={importingPhoto || isPurchaseInFlight}
        shareTarget={captureTarget}
        onChangeShareTarget={handleCaptureTargetChange}
        onDoodleModeChange={setCaptureScrollLocked}
        footerContent={
          <View style={styles.captureFooterRow}>
            {inlineSaveFeedback ? (
              <TransientStatusChip
                key={inlineSaveFeedback.token}
                icon={inlineSaveFeedback.variant === 'shared' ? 'people' : 'checkmark-circle'}
                label={
                  inlineSaveFeedback.variant === 'shared'
                    ? t('shared.savedSharedQuick', 'Saved and shared')
                    : t('capture.savedQuick', 'Saved to your journal')
                }
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('notes.viewAllButton', 'View all notes')}
              onPress={handleOpenNotes}
              style={({ pressed }) => [styles.captureFooterButtonPressable, pressed ? styles.captureFooterPressed : null]}
            >
              <InfoPill icon="grid-outline" iconColor={colors.primary} style={styles.captureFooterButton}>
                <Text style={[styles.captureFooterLabel, { color: colors.text }]}>
                  {t('notes.viewAllButton', 'View all notes')}
                </Text>
              </InfoPill>
            </Pressable>
          </View>
        }
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <HomeHeaderSearch
        topInset={insets.top}
        isSearching={isSearching}
        searchAnim={searchAnim}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onOpenSearch={handleOpenSearch}
        onCloseSearch={handleCloseSearch}
        showSearchButton={useInlineHeaderSearch}
        showSharedButton
        onOpenShared={handleOpenSharedManage}
        onToggleCaptureMode={handleToggleCaptureMode}
        captureMode={captureMode}
        radius={radius}
        onChangeRadius={setRadius}
        colors={colors}
        isDark={isDark}
        t={t}
      />

      {useInlineHeaderSearch && isSearching && filteredNotes.length === 0 && searchQuery.trim() ? (
        <View
          style={[
            styles.center,
            {
              backgroundColor: colors.background,
              position: 'absolute',
              top: snapHeight,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="search-outline" size={48} color={colors.secondaryText} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('home.noResults', 'No notes found')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
            {t('home.noResultsMsg', 'Try a different keyword')}
          </Text>
        </View>
      ) : null}
      <NotesFeed
        flatListRef={flatListRef}
        captureHeader={captureHeader}
        captureMode={captureMode}
        notes={displayedNotes}
        sharedPosts={visibleSharedPosts}
        refreshing={refreshing}
        onRefresh={() => {
          void onRefresh();
        }}
        topInset={insets.top}
        snapHeight={snapHeight}
        onOpenNote={openNote}
        onOpenSharedPost={openSharedPost}
        colors={colors}
        t={t}
        revealedNoteId={revealedNoteId}
        revealToken={revealToken}
        scrollEnabled={!captureScrollLocked}
      />

      <SharedManageSheet
        key={`shared-manage-${sharedManageSheetVersion}`}
        visible={showSharedManageSheet}
        friends={friends}
        activeInvite={activeInvite}
        loading={sharedLoading}
        onClose={dismissSharedManageSheet}
        onShareInvite={() => {
          void handleShareInvite();
        }}
        onRevokeInvite={() => {
          void handleRevokeInvite();
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
  captureItemWrapper: {
    width: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    fontFamily: 'System',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'System',
  },
  captureFooterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 2,
  },
  captureFooterButtonPressable: {
    borderRadius: Layout.pillRadius,
  },
  captureFooterButton: {
    minHeight: 40,
    paddingHorizontal: 18,
  },
  captureFooterLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
  captureFooterPressed: {
    opacity: 0.84,
  },
});
