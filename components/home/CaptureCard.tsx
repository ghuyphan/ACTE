import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { TFunction } from 'i18next';
import { RefObject } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NOTE_RADIUS_OPTIONS, formatRadiusLabel } from '../../constants/noteRadius';
import { Layout, Typography } from '../../constants/theme';
import PrimaryButton from '../ui/PrimaryButton';
import { isOlderIOS } from '../../utils/platform';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;

interface CaptureCardProps {
  snapHeight: number;
  topInset: number;
  isSearching: boolean;
  captureMode: 'text' | 'camera';
  captureOpacity: Animated.Value;
  captureScale: Animated.Value;
  captureTranslateY: Animated.Value;
  colors: {
    primary: string;
    card: string;
    border: string;
    text: string;
    secondaryText: string;
    primaryContrastText?: string;
    primaryContrastPlaceholder?: string;
    primaryGlassOverlay?: string;
    primaryGlassIcon?: string;
    primaryGlassPlaceholder?: string;
    primaryGlassColorScheme?: 'light' | 'dark';
  };
  isDark: boolean;
  t: TFunction;
  noteText: string;
  onChangeNoteText: (nextText: string) => void;
  restaurantName: string;
  onChangeRestaurantName: (nextName: string) => void;
  radius: number;
  onChangeRadius: (nextRadius: number) => void;
  capturedPhoto: string | null;
  onRetakePhoto: () => void;
  needsCameraPermission: boolean;
  onRequestCameraPermission: () => void;
  isFocused: boolean;
  facing: 'back' | 'front';
  onToggleFacing: () => void;
  cameraRef: RefObject<CameraView | null>;
  flashAnim: Animated.Value;
  permissionGranted: boolean;
  onShutterPressIn: () => void;
  onShutterPressOut: () => void;
  onTakePicture: () => void;
  onSaveNote: () => void;
  saving: boolean;
  shutterScale: Animated.Value;
}

export default function CaptureCard({
  snapHeight,
  topInset,
  isSearching,
  captureMode,
  captureOpacity,
  captureScale,
  captureTranslateY,
  colors,
  isDark,
  t,
  noteText,
  onChangeNoteText,
  restaurantName,
  onChangeRestaurantName,
  radius,
  onChangeRadius,
  capturedPhoto,
  onRetakePhoto,
  needsCameraPermission,
  onRequestCameraPermission,
  isFocused,
  facing,
  onToggleFacing,
  cameraRef,
  flashAnim,
  permissionGranted,
  onShutterPressIn,
  onShutterPressOut,
  onTakePicture,
  onSaveNote,
  saving,
  shutterScale,
}: CaptureCardProps) {
  const showInlineRadiusOptions = Platform.OS !== 'ios';
  const primaryTextColor = colors.primaryContrastText ?? '#1C1C1E';
  const primaryPlaceholderColor =
    colors.primaryContrastPlaceholder ?? (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(28,28,30,0.48)');
  const primaryGlassOverlay =
    colors.primaryGlassOverlay ?? (isDark ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.7)');
  const primaryGlassIcon =
    colors.primaryGlassIcon ?? (isDark ? 'rgba(28,28,30,0.5)' : 'rgba(28,28,30,0.4)');
  const primaryGlassPlaceholder =
    colors.primaryGlassPlaceholder ?? (isDark ? 'rgba(28,28,30,0.35)' : 'rgba(28,28,30,0.3)');
  const primaryGlassColorScheme = colors.primaryGlassColorScheme ?? 'light';

  return (
    <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
      <Animated.View
        style={[
          styles.captureArea,
          {
            opacity: captureOpacity,
            transform: [{ translateY: captureTranslateY }, { scale: captureScale }],
          },
        ]}
        pointerEvents={isSearching ? 'none' : 'auto'}
      >
        {captureMode === 'text' ? (
          <View style={[styles.textCard, { backgroundColor: colors.primary }]}>
            <View style={styles.cardTextCenter}>
              <TextInput
                key={`note-text-${isSearching}`}
                style={[styles.textInput, { color: primaryTextColor }]}
                placeholder={t('capture.textPlaceholder', 'Note about this place...')}
                placeholderTextColor={primaryPlaceholderColor}
                multiline
                value={noteText}
                onChangeText={onChangeNoteText}
                maxLength={300}
              />
            </View>

            <View style={styles.cardRestaurantPill}>
              {isOlderIOS ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: primaryGlassOverlay,
                      borderRadius: 20,
                    },
                  ]}
                />
              ) : null}
              {/* Keep interactive content outside the native glass host to avoid intermittent child layout misses. */}
              <GlassView
                pointerEvents="none"
                style={StyleSheet.absoluteFillObject}
                glassEffectStyle="regular"
                colorScheme={primaryGlassColorScheme}
              />
              <Ionicons
                name="restaurant-outline"
                size={14}
                color={primaryGlassIcon}
              />
              <TextInput
                key={`restaurant-${isSearching}`}
                style={[styles.cardRestaurantInput, { color: primaryTextColor }]}
                placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                placeholderTextColor={primaryGlassPlaceholder}
                value={restaurantName}
                onChangeText={onChangeRestaurantName}
                maxLength={100}
              />
            </View>
          </View>
        ) : capturedPhoto ? (
          <View style={styles.cameraContainer}>
            <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />
            <Pressable style={styles.retakeBtn} onPress={onRetakePhoto}>
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
            <PrimaryButton
              label={t('capture.grantAccess', 'Grant Access')}
              onPress={onRequestCameraPermission}
              style={styles.permissionButton}
            />
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            {isFocused && captureMode === 'camera' ? (
              <CameraView style={styles.cameraPreview} facing={facing} ref={cameraRef} />
            ) : null}
            <Pressable style={styles.flipBtn} onPress={onToggleFacing}>
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

      <Animated.View
        style={[
          styles.belowCardSection,
          {
            opacity: captureOpacity,
            transform: [{ translateY: captureTranslateY }, { scale: captureScale }],
          },
        ]}
      >
        {showInlineRadiusOptions ? (
          <View style={styles.radiusOptions}>
            {NOTE_RADIUS_OPTIONS.map((option) => {
              const isSelected = radius === option;
              return (
                <Pressable
                  key={option}
                  testID={`capture-radius-${option}`}
                  style={[
                    styles.radiusChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => onChangeRadius(option)}
                >
                  <Text
                    style={[
                      styles.radiusChipText,
                      { color: isSelected ? primaryTextColor : colors.text },
                    ]}
                  >
                    {formatRadiusLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {captureMode === 'camera' && !capturedPhoto ? (
          <View style={styles.belowCardShutterRow}>
            {permissionGranted ? (
              <Pressable
                onPressIn={onShutterPressIn}
                onPressOut={onShutterPressOut}
                onPress={onTakePicture}
                style={[styles.shutterOuter, { borderColor: colors.border }]}
              >
                <Animated.View
                  style={[
                    styles.shutterInner,
                    {
                      backgroundColor: colors.primary,
                      transform: [{ scale: shutterScale }],
                    },
                  ]}
                />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <PrimaryButton
            label={t('capture.save', 'Save Note 💛')}
            variant="neutral"
            onPress={onSaveNote}
            loading={saving}
            style={styles.belowCardSaveButton}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  snapItem: {
    width,
    justifyContent: 'center',
  },
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
    paddingTop: 0,
    paddingBottom: 0,
    width: '100%',
    textShadowRadius: 6,
    fontFamily: 'System',
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
    overflow: 'hidden',
    position: 'relative',
  },
  cardRestaurantInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    paddingTop: 0,
    paddingBottom: 0,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 5,
  },
  retakeBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  permissionText: {
    ...Typography.body,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 16,
    width: '100%',
  },
  belowCardSection: {
    paddingHorizontal: HORIZONTAL_PADDING + 4,
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    gap: 12,
  },
  radiusOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  radiusChip: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  radiusChipText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
  belowCardShutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
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
  belowCardSaveButton: {
    width: '100%',
    borderRadius: 999,
  },
});
