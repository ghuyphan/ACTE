import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
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
import { formatDate } from '../../utils/dateUtils';

// ─── Animated Note Card ──────────────────────────
function AnimatedNoteCard({ item, index, onPress, colors, isDark, t }: {
  item: Note; index: number; onPress: () => void;
  colors: any; isDark: boolean; t: any;
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 10, delay: index * 50, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity, index]);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.98, tension: 300, friction: 15, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }).start();
  };

  const dateStr = formatDate(item.createdAt, 'short');

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[styles.noteCardWrapper, { opacity, transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}
      >
        {item.type === 'photo' ? (
          <ImageMemoryCard imageUrl={item.content} />
        ) : (
          <TextMemoryCard text={item.content} noteId={item.id} />
        )}

        {/* Favorite badge */}
        {item.isFavorite && (
          <View style={styles.favBadge}>
            <Ionicons name="heart" size={16} color="#FF3B30" />
          </View>
        )}
      </Animated.View>

      {/* Below-card metadata */}
      <Animated.View style={[styles.belowCardMetaContainer, { opacity }]}>
        <View style={[styles.metadataPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
          <Ionicons name="location" size={14} color={colors.secondaryText} />
          <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
            {item.locationName ?? t('home.unknownLocation', 'Unknown location')}
          </Text>
          <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
          <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>
            {dateStr}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const { width, height } = Dimensions.get('window');
const HORIZONTAL_PADDING = 12;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;

type CaptureMode = 'text' | 'camera';

// Animated mode switch opacity
const useCaptureAnimation = () => {
  const captureOpacity = useRef(new Animated.Value(1)).current;

  const animateModeSwitch = (callback: () => void) => {
    Animated.timing(captureOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      callback();
      Animated.spring(captureOpacity, { toValue: 1, tension: 200, friction: 15, useNativeDriver: true }).start();
    });
  };

  return { captureOpacity, animateModeSwitch };
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, loading, refreshNotes, createNote } = useNotes();
  const { location, hasPermissions, registerGeofence } = useGeofence();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { captureOpacity, animateModeSwitch } = useCaptureAnimation();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;

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
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;

  const SNAP_HEIGHT = height - insets.top - 90; // NativeTabs handles bottom, only deduct top + tab bar
  const flatListRef = useRef<FlatList>(null);

  // Custom hook from React Navigation to allow tab bar tap to scroll back to top of this index tab
  useScrollToTop(flatListRef);

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.content.toLowerCase().includes(q) ||
        (n.locationName && n.locationName.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotes();
    setRefreshing(false);
  }, [refreshNotes]);

  // ─── Capture Logic ────────────────────────────────────────
  const toggleCaptureMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    animateModeSwitch(() => {
      setCaptureMode((m) => (m === 'text' ? 'camera' : 'text'));
      setCapturedPhoto(null);
    });
  };

  const handleShutterPressIn = () => {
    Animated.spring(shutterScale, { toValue: 0.85, tension: 300, friction: 15, useNativeDriver: true }).start();
  };
  const handleShutterPressOut = () => {
    Animated.spring(shutterScale, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }).start();
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Trigger capture flash animation
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const photo = await cameraRef.current.takePictureAsync();
    // Reset shutter scale when photo is taken and UI transitions
    shutterScale.setValue(1);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const renderCaptureCard = () => {
    if (isSearching) return <View key="__capture__" style={{ height: 0, overflow: 'hidden' }} />;
    return (
      <View style={[styles.snapItem, { height: SNAP_HEIGHT, paddingTop: insets.top + 60 }]}>

        {/* Capture Area — animated crossfade on mode switch */}
        <Animated.View style={[styles.captureArea, { opacity: captureOpacity }]}>
          {captureMode === 'text' ? (
            <View
              style={[styles.textCard, { backgroundColor: colors.primary }]}
            >
              {/* Centered text area */}
              <View style={styles.cardTextCenter}>
                <TextInput
                  key={`note-text-${isSearching}`}
                  style={[styles.textInput, { color: isDark ? '#000' : '#1C1C1E' }]}
                  placeholder={t('capture.textPlaceholder', 'Note about this place...')}
                  placeholderTextColor="rgba(0,0,0,0.5)"
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                  maxLength={300}
                />
              </View>

              {/* Restaurant name — glass pill at bottom of card */}
              <GlassView
                style={styles.cardRestaurantPill}
                glassEffectStyle="regular"
                colorScheme="light"
              >
                <Ionicons name="restaurant-outline" size={14} color={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.4)'} />
                <TextInput
                  key={`restaurant-${isSearching}`}
                  style={[styles.cardRestaurantInput, { color: isDark ? '#000' : '#1C1C1E' }]}
                  placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                  placeholderTextColor={isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.3)'}
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                  maxLength={100}
                />
              </GlassView>
            </View>
          ) : capturedPhoto ? (
            <View style={styles.cameraContainer}>
              <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />

              <Pressable style={styles.retakeBtn} onPress={() => setCapturedPhoto(null)}>
                <Ionicons name="refresh" size={18} color="white" />
                <Text style={styles.retakeBtnText}>{t('capture.retake', 'Retake')}</Text>
              </Pressable>

              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'white', opacity: flashAnim, zIndex: 50 },
                ]}
              />
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
                <Ionicons name="camera-reverse" size={20} color="white" />
              </Pressable>

              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'white', opacity: flashAnim, zIndex: 50 },
                ]}
              />
            </View>
          )}
        </Animated.View>

        {/* Compact action below card */}
        <Animated.View style={[styles.belowCardSection, { opacity: captureOpacity }]}>
          {captureMode === 'camera' && !capturedPhoto ? (
            <View style={styles.belowCardShutterRow}>
              {permission?.granted ? (
                <Pressable
                  onPressIn={handleShutterPressIn}
                  onPressOut={handleShutterPressOut}
                  onPress={takePicture}
                  style={styles.shutterOuter}
                >
                  <Animated.View style={[styles.shutterInner, { backgroundColor: colors.primary, transform: [{ scale: shutterScale }] }]} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              style={[
                styles.belowCardSaveButton,
                { backgroundColor: isDark ? '#ffffff' : '#000000' },
                saving && { opacity: 0.6 }
              ]}
              onPress={saveNote}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={isDark ? '#000000' : '#ffffff'} />
              ) : (
                <Text style={[styles.saveButtonText, { color: isDark ? '#000' : '#fff' }]}>
                  {t('capture.save', 'Save Note 💛')}
                </Text>
              )}
            </Pressable>
          )}
        </Animated.View>
      </View >
    );
  };

  const renderNoteCard = ({ item, index }: { item: Note; index: number }) => {
    return (
      <View style={[styles.snapItem, { height: SNAP_HEIGHT, paddingTop: insets.top + 60 }]}>
        <AnimatedNoteCard
          item={item}
          index={index}
          onPress={() => router.push(`/note/${item.id}` as any)}
          colors={colors}
          isDark={isDark}
          t={t}
        />
      </View>
    );
  };

  // Build data: capture card as first item, then filtered notes
  const displayedNotes = isSearching ? filteredNotes : notes;
  const listData = [{ id: '__capture__', type: 'capture' as const }, ...displayedNotes.map(n => ({ ...n, type: n.type as string }))];

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
          style={[styles.floatingHeaderGlassContainer, { height: 60 }]}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
        >
          {/* Default Header */}
          <Animated.View
            pointerEvents={isSearching ? 'none' : 'auto'}
            style={[
              StyleSheet.absoluteFill,
              {
                paddingHorizontal: 20,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }]
              }
            ]}
          >
            <Text style={[styles.logoText, { color: colors.text }]}>ACTE 💛</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={() => {
                setIsSearching(true);
                Animated.timing(searchAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
              }}>
                <Ionicons name="search" size={20} color={colors.primary} />
              </Pressable>
              <Pressable onPress={toggleCaptureMode} style={[styles.modeToggleBtn, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons
                  name={captureMode === 'text' ? 'camera-outline' : 'document-text-outline'}
                  size={20}
                  color={colors.primary}
                />
              </Pressable>
            </View>
          </Animated.View>

          {/* Search Header */}
          <Animated.View
            pointerEvents={isSearching ? 'auto' : 'none'}
            style={[
              StyleSheet.absoluteFill,
              {
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: searchAnim,
                transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
              }
            ]}
          >
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={colors.secondaryText} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder={t('home.searchPlaceholder', 'Search notes...')}
                  placeholderTextColor={colors.secondaryText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={isSearching}
                  returnKeyType="search"
                />
              </View>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  Animated.timing(searchAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
                    setIsSearching(false);
                    setSearchQuery('');
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                  });
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
              </Pressable>
            </View>
          </Animated.View>
        </GlassView>
      </View>

      {/* Search empty state */}
      {isSearching && filteredNotes.length === 0 && searchQuery.trim() ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={48} color={colors.secondaryText} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('home.noResults', 'No notes found')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
            {t('home.noResultsMsg', 'Try a different keyword')}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            if (item.id === '__capture__') return renderCaptureCard();
            return renderNoteCard({ item: item as Note, index });
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
      )}
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
    gap: 8,
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
    borderRadius: 30, // fully rounded stadium borders
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    fontSize: 16,
    fontWeight: '500',
    width: '100%',
  },

  // ─── Capture Area ───────────────────────
  captureArea: {
    height: CARD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  textCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 40,
    borderCurve: 'continuous',
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
  cardTextCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  cardRestaurantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    width: '100%',
    marginTop: 8,
  },
  cardRestaurantInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  cameraContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 40,
    borderCurve: 'continuous',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
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
    top: 24,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  retakeBtn: {
    position: 'absolute',
    top: 24,
    right: 16,
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
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: 'rgba(150,150,150,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  saveButtonText: {
    fontSize: 19,
    fontWeight: '800',
  },

  // ─── Below-card section (capture) ──────
  belowCardSection: {
    paddingHorizontal: HORIZONTAL_PADDING + 4,
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90, // Prevents layout shift between camera shutter and save button
  },
  belowCardInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
  },
  belowCardInputText: {
    fontSize: 15,
    fontWeight: '600',
    width: '100%',
  },
  belowCardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  belowCardLocationText: {
    fontSize: 13,
    fontWeight: '600',
  },
  belowCardShutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  belowCardSaveButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },

  // ─── Note Cards ─────────────────────────
  noteCardWrapper: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  favBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // ─── Below-card metadata (notes) ───────
  belowCardMetaContainer: {
    alignItems: 'center', // Centers the pill horizontally
    paddingTop: 16,
  },
  metadataPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    maxWidth: '90%', // Prevents overflow if the location name is extremely long
  },
  metadataPillText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1, // Allows the location text to truncate with ellipsis
  },
  metadataPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
    opacity: 0.5, // Subtle separator
  },
  metadataPillDate: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ─── Empty states ──────────────────────
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
