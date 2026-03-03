import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageMemoryCard from '../../components/ImageMemoryCard';
import TextMemoryCard from '../../components/TextMemoryCard';
import { useGeofence } from '../../hooks/useGeofence';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';

const { width, height } = Dimensions.get('window');
const HORIZONTAL_PADDING = 12;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;

type CaptureMode = 'text' | 'camera';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, loading, refreshNotes, createNote } = useNotes();
  const { location, hasPermissions, registerGeofence } = useGeofence();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Capture state
  const [restaurantName, setRestaurantName] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text');
  const [noteText, setNoteText] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();

  const SNAP_HEIGHT = height - insets.top - 90; // NativeTabs handles bottom, only deduct top + tab bar
  const flatListRef = useRef<FlatList>(null);

  // Custom hook from React Navigation to allow tab bar tap to scroll back to top of this index tab
  useScrollToTop(flatListRef);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotes();
    setRefreshing(false);
  }, [refreshNotes]);

  // ─── Capture Logic ────────────────────────────────────────
  const toggleCaptureMode = () => {
    // Scroll flatlist to top so the capture target is active when the user swaps mode
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setCaptureMode((m) => (m === 'text' ? 'camera' : 'text'));
    setCapturedPhoto(null);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync();
    if (photo?.uri) setCapturedPhoto(photo.uri);
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.city].filter(Boolean);
        return parts.join(', ') || t('capture.unknownPlace', 'Unknown Place');
      }
    } catch (e) {
      console.warn('Reverse geocode failed:', e);
    }
    return t('capture.unknownPlace', 'Unknown Place');
  };

  const saveNote = async () => {
    let currentLocation = location;

    if (!currentLocation) {
      // Proactively try to request permission and get location if it's missing
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        currentLocation = await Location.getCurrentPositionAsync({});
      }

      if (!currentLocation) {
        Alert.alert(t('capture.error'), t('capture.noLocation'));
        return;
      }
    }
    if (captureMode === 'text' && !noteText.trim()) {
      Alert.alert(t('capture.error'), t('capture.noText'));
      return;
    }
    if (captureMode === 'camera' && !capturedPhoto) {
      Alert.alert(t('capture.error'), t('capture.noPhoto'));
      return;
    }

    setSaving(true);
    try {
      const lat = currentLocation.coords.latitude;
      const lon = currentLocation.coords.longitude;
      const geoName = await reverseGeocode(lat, lon);
      const locationName = restaurantName.trim() || geoName;

      let content = noteText.trim();
      if (captureMode === 'camera' && capturedPhoto) {
        const dir = `${FileSystem.documentDirectory}photos/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const filename = `note-${Date.now()}.jpg`;
        const dest = `${dir}${filename}`;
        await FileSystem.copyAsync({ from: capturedPhoto, to: dest });
        content = dest;
      }

      const note = await createNote({
        type: captureMode === 'camera' ? 'photo' : 'text',
        content,
        locationName,
        latitude: lat,
        longitude: lon,
      });

      if (hasPermissions) {
        await registerGeofence(note.id, lat, lon);
      }

      setNoteText('');
      setRestaurantName('');
      setCapturedPhoto(null);
      Alert.alert(t('capture.saved', '✓ Saved!'), t('capture.savedMsg'));
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Render Snap Items ────────────────────────────────────
  const needsCameraPermission = captureMode === 'camera' && (!permission || !permission.granted);

  const renderCaptureCard = () => (
    <View style={[styles.snapItem, { height: SNAP_HEIGHT, paddingTop: insets.top + 60 }]}>

      {/* Capture Area */}
      <View style={styles.captureArea}>
        {captureMode === 'text' ? (
          <View
            style={[styles.textCard, { backgroundColor: colors.primary }]}
          >
            <TextInput
              style={[styles.textInput, { color: isDark ? '#000' : '#1C1C1E' }]}
              placeholder={t('capture.textPlaceholder', 'What does she like/dislike here?')}
              placeholderTextColor="rgba(0,0,0,0.5)"
              multiline
              value={noteText}
              onChangeText={setNoteText}
              maxLength={300}
            />

            {/* Floating Restaurant Name Input inside Text Card */}
            <GlassView
              style={[styles.floatingRestaurantInput, { top: 24, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.45)' }]}
              glassEffectStyle="regular"
              colorScheme={isDark ? "dark" : "light"}
            >
              <Ionicons name="restaurant-outline" size={16} color={isDark ? '#FFF' : '#000'} />
              <TextInput
                style={[styles.floatingInput, { color: isDark ? '#FFF' : '#000' }]}
                placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}
                value={restaurantName}
                onChangeText={setRestaurantName}
                maxLength={100}
              />
            </GlassView>

            {location && (
              <View style={[styles.floatingLocationBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}>
                <Ionicons name="location" size={14} color={isDark ? '#FFF' : '#000'} />
                <Text style={[styles.floatingLocationText, { color: isDark ? '#FFF' : '#000' }]}>
                  {t('capture.currentLocation', 'Using current location')}
                </Text>
              </View>
            )}

            {/* Floating Save Button inside Text Card */}
            <Pressable
              style={[
                styles.floatingSaveButton,
                { backgroundColor: isDark ? '#fff' : '#1C1C1E' },
                saving && { opacity: 0.6 }
              ]}
              onPress={saveNote}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={isDark ? '#000' : '#fff'} />
              ) : (
                <Text style={[styles.saveButtonText, { color: isDark ? '#000' : '#fff' }]}>
                  {t('capture.save', 'Save Note 💛')}
                </Text>
              )}
            </Pressable>
          </View>
        ) : capturedPhoto ? (
          <View style={styles.cameraContainer}>
            <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />
            <Pressable style={styles.retakeBtn} onPress={() => setCapturedPhoto(null)}>
              <Ionicons name="refresh" size={18} color="white" />
              <Text style={styles.retakeBtnText}>{t('capture.retake', 'Retake')}</Text>
            </Pressable>

            {/* Floating Save Button inside Camera Preview */}
            <Pressable
              style={[styles.floatingSaveButton, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
              onPress={saveNote}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={isDark ? '#000' : '#fff'} />
              ) : (
                <Text style={[styles.saveButtonText, { color: isDark ? '#000' : '#fff' }]}>
                  {t('capture.save', 'Save Note 💛')}
                </Text>
              )}
            </Pressable>
          </View>
        ) : needsCameraPermission ? (
          <View style={[styles.textCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="camera" size={48} color={colors.secondaryText} />
            <Text style={[styles.permissionText, { color: colors.text }]}>
              {t('capture.cameraPermission', 'Camera access needed')}
            </Text>
            <Pressable
              style={[styles.permissionBtn, { backgroundColor: colors.primary }]}
              onPress={requestPermission}
            >
              <Text style={{ color: isDark ? '#000' : '#fff', fontWeight: '700', fontSize: 15 }}>
                {t('capture.grantAccess', 'Grant Access')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            {isFocused && captureMode === 'camera' && (
              <CameraView style={styles.cameraPreview} facing={facing} ref={cameraRef} />
            )}
            <Pressable
              style={styles.flipBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Ionicons name="camera-reverse" size={22} color="white" />
            </Pressable>

            {/* Floating Restaurant Name Input inside Camera */}
            <GlassView
              style={[styles.floatingRestaurantInput, { top: 24, backgroundColor: 'rgba(0,0,0,0.35)' }]}
              glassEffectStyle="regular"
              colorScheme="dark"
            >
              <Ionicons name="restaurant-outline" size={16} color="#FFF" />
              <TextInput
                style={[styles.floatingInput, { color: '#FFF' }]}
                placeholder={t('capture.restaurantPlaceholder', 'Restaurant name')}
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={restaurantName}
                onChangeText={setRestaurantName}
                maxLength={100}
              />
            </GlassView>

            {/* Floating Shutter/Save Button */}
            <View style={styles.cameraBottomAction}>
              {captureMode === 'camera' && !capturedPhoto && permission?.granted ? (
                <Pressable style={styles.shutterOuter} onPress={takePicture}>
                  <View style={[styles.shutterInner, { backgroundColor: colors.captureButtonBg }]} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderNoteCard = ({ item }: { item: Note }) => {
    const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return (
      <View style={[styles.snapItem, { height: SNAP_HEIGHT, paddingTop: insets.top + 60 }]}>
        <Pressable
          style={styles.noteCardWrapper}
          onPress={() => router.push(`/note/${item.id}` as any)}
        >
          {item.type === 'photo' ? (
            <ImageMemoryCard
              imageUrl={item.content}
              locationName={item.locationName ?? t('home.unknownLocation', 'Unknown location')}
              date={dateStr}
            />
          ) : (
            <TextMemoryCard
              text={item.content}
              locationName={item.locationName ?? t('home.unknownLocation', 'Unknown location')}
              date={dateStr}
              noteId={item.id}
            />
          )}
        </Pressable>
      </View>
    );
  };

  // Build data: capture card as first item, then notes
  const listData = [{ id: '__capture__', type: 'capture' as const }, ...notes.map(n => ({ ...n, type: n.type as string }))];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Absolute Positioned Header across the application */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
        <GlassView
          style={styles.floatingHeaderGlassContainer}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
        >
          <Text style={[styles.logoText, { color: colors.text }]}>ACTE 💛</Text>
          <Pressable onPress={toggleCaptureMode}>
            <View style={styles.modeToggle}>
              <Ionicons
                name={captureMode === 'text' ? 'camera' : 'text'}
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.modeToggleText, { color: colors.primary }]}>
                {captureMode === 'text'
                  ? t('capture.switchCamera', 'Camera')
                  : t('capture.switchText', 'Text')}
              </Text>
            </View>
          </Pressable>
        </GlassView>
      </View>

      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          if (index === 0) return renderCaptureCard();
          return renderNoteCard({ item: item as Note });
        }}
        snapToInterval={SNAP_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: height - SNAP_HEIGHT }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapItem: {
    width,
    justifyContent: 'center',
  },

  // ─── Header ─────────────────────────────
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  floatingHeaderGlassContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30, // fully rounded stadium borders
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12, // Visual separation from logo
  },
  modeToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Capture Area ───────────────────────
  captureArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  textCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 40,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  textInput: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
    width: '100%',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  floatingRestaurantInput: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    width: '85%',
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  floatingLocationBadge: {
    position: 'absolute',
    bottom: 100, // Above the save button
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  floatingLocationText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  floatingSaveButton: {
    position: 'absolute',
    bottom: 24,
    width: '85%',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  cameraContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 40,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: '#000',
  },
  cameraPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  flipBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 5,
  },
  retakeBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },

  cameraBottomAction: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  saveButtonText: {
    fontSize: 19,
    fontWeight: '800',
  },

  // ─── Note Cards ─────────────────────────
  noteCardWrapper: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
  },
});
