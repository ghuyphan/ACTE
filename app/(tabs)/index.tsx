import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppSheetAlert from '../../components/AppSheetAlert';
import CaptureCard from '../../components/home/CaptureCard';
import HomeHeaderSearch from '../../components/home/HomeHeaderSearch';
import NotesFeed from '../../components/home/NotesFeed';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useCaptureFlow } from '../../hooks/useCaptureFlow';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';
import { isIOS26OrNewer } from '../../utils/platform';

const { height } = Dimensions.get('window');

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, loading, refreshNotes, createNote } = useNotesStore();
  const {
    location,
    remindersEnabled,
    requestForegroundLocation,
    requestReminderPermissions,
    openAppSettings,
  } = useGeofence();
  const { alertProps, showAlert } = useAppSheetAlert();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const isFocused = useIsFocused();
  const useNativeTabSearch = isIOS26OrNewer;
  const useInlineHeaderSearch = !useNativeTabSearch;

  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCaptureVisible, setIsCaptureVisible] = useState(true);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  useScrollToTop(flatListRef);

  const {
    captureMode,
    restaurantName,
    setRestaurantName,
    noteText,
    setNoteText,
    capturedPhoto,
    setCapturedPhoto,
    facing,
    setFacing,
    permission,
    requestPermission,
    cameraRef,
    captureOpacity,
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
    if (!searchQuery.trim()) {
      return notes;
    }
    const query = searchQuery.toLowerCase();
    return notes.filter(
      (note) =>
        note.content.toLowerCase().includes(query) ||
        note.locationName?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const displayedNotes = useInlineHeaderSearch && isSearching ? filteredNotes : notes;
  const shouldShowNotesHint = displayedNotes.length > 0 && isCaptureVisible;

  useEffect(() => {
    Animated.timing(hintAnim, {
      toValue: shouldShowNotesHint ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hintAnim, shouldShowNotesHint]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotes(false);
    setRefreshing(false);
  }, [refreshNotes]);

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

  const showSavedSheet = useCallback(() => {
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
                'ACTE will remind you when you return to saved places.'
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
                'Background location or notifications are blocked for ACTE. Open Settings to enable reminders.'
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
              'Your note is still saved locally. ACTE needs background location and notifications to send reminders.'
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

    if (captureMode === 'text' && !noteText.trim()) {
      showDoneSheet(
        'warning',
        t('capture.error', 'Error'),
        t('capture.noText', 'Please write a note')
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

    setSaving(true);
    let destinationPath: string | null = null;

    try {
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

      await createNote({
        type: captureMode === 'camera' ? 'photo' : 'text',
        content,
        locationName,
        latitude: lat,
        longitude: lon,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetCapture();
      showSavedSheet();
    } catch (error) {
      console.error('Save failed:', error);
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
    showDoneSheet,
    t,
    captureMode,
    noteText,
    capturedPhoto,
    reverseGeocode,
    restaurantName,
    createNote,
    resetCapture,
    showSavedSheet,
  ]);

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
    flatListRef.current?.scrollToOffset({ offset: snapHeight, animated: true });
  }, [snapHeight]);

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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <HomeHeaderSearch
        topInset={insets.top}
        isSearching={isSearching}
        searchAnim={searchAnim}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSearch={handleOpenSearch}
        onCloseSearch={handleCloseSearch}
        showSearchButton={useInlineHeaderSearch}
        onToggleCaptureMode={handleToggleCaptureMode}
        captureMode={captureMode}
        colors={colors}
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
        captureItem={
          <View style={styles.captureItemWrapper}>
            <CaptureCard
              snapHeight={snapHeight}
              topInset={insets.top}
              isSearching={isSearching}
              captureMode={captureMode}
              captureOpacity={captureOpacity}
              captureScale={captureScale}
              captureTranslateY={captureTranslateY}
              colors={colors}
              isDark={isDark}
              t={t}
              noteText={noteText}
              onChangeNoteText={setNoteText}
              restaurantName={restaurantName}
              onChangeRestaurantName={setRestaurantName}
              capturedPhoto={capturedPhoto}
              onRetakePhoto={() => setCapturedPhoto(null)}
              needsCameraPermission={needsCameraPermission}
              onRequestCameraPermission={requestPermission}
              isFocused={isFocused}
              facing={facing}
              onToggleFacing={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
              cameraRef={cameraRef}
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
              shutterScale={shutterScale}
            />
            {displayedNotes.length > 0 ? (
              <Animated.View
                pointerEvents={shouldShowNotesHint ? 'auto' : 'none'}
                style={[
                  styles.homeNotesHintWrap,
                  {
                    opacity: hintAnim,
                    transform: [
                      {
                        translateY: hintAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  style={styles.homeNotesHintButton}
                  onPress={handleOpenNotes}
                  hitSlop={20}
                >
                  <Ionicons name="chevron-down" size={22} color={colors.text} />
                </Pressable>
              </Animated.View>
            ) : null}
          </View>
        }
        notes={displayedNotes}
        refreshing={refreshing}
        onRefresh={() => {
          void onRefresh();
        }}
        topInset={insets.top}
        snapHeight={snapHeight}
        onOpenNote={openNote}
        colors={colors}
        t={t}
        onCaptureVisibilityChange={setIsCaptureVisible}
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
  homeNotesHintWrap: {
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
  },
  homeNotesHintButton: {
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
});
