import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { TFunction } from 'i18next';
import { ReactNode, RefObject, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Layout, Shadows, Typography } from '../../constants/theme';
import type { ThemeColors } from '../../hooks/useTheme';
import PrimaryButton from '../ui/PrimaryButton';
import { isOlderIOS } from '../../utils/platform';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;
const TOP_CONTROL_INSET = 24;
const TOP_CONTROL_HEIGHT = 38;
const TOP_CONTROL_RADIUS = 19;
const AnimatedIonicons = Reanimated.createAnimatedComponent(Ionicons);

interface CaptureCardProps {
  snapHeight: number;
  topInset: number;
  isSearching: boolean;
  captureMode: 'text' | 'camera';
  cameraSessionKey: number;
  captureScale: Animated.Value;
  captureTranslateY: Animated.Value;
  colors: Pick<
    ThemeColors,
    | 'primary'
    | 'captureButtonBg'
    | 'card'
    | 'border'
    | 'text'
    | 'secondaryText'
    | 'captureCardText'
    | 'captureCardPlaceholder'
    | 'captureCardBorder'
    | 'captureGlassFill'
    | 'captureGlassBorder'
    | 'captureGlassText'
    | 'captureGlassIcon'
    | 'captureGlassPlaceholder'
    | 'captureGlassColorScheme'
    | 'captureCameraOverlay'
    | 'captureCameraOverlayBorder'
    | 'captureCameraOverlayText'
    | 'captureFlashOverlay'
  >;
  t: TFunction;
  noteText: string;
  onChangeNoteText: (nextText: string) => void;
  restaurantName: string;
  onChangeRestaurantName: (nextName: string) => void;
  capturedPhoto: string | null;
  onRetakePhoto: () => void;
  needsCameraPermission: boolean;
  onRequestCameraPermission: () => void;
  facing: 'back' | 'front';
  onToggleFacing: () => void;
  onOpenPhotoLibrary: () => void;
  cameraRef: RefObject<CameraView | null>;
  shouldRenderCameraPreview: boolean;
  flashAnim: Animated.Value;
  permissionGranted: boolean;
  onShutterPressIn: () => void;
  onShutterPressOut: () => void;
  onTakePicture: () => void;
  onSaveNote: () => void;
  saving: boolean;
  shutterScale: Animated.Value;
  cameraStatusText?: string | null;
  libraryImportLocked?: boolean;
  importingPhoto?: boolean;
  shareTarget: 'private' | 'shared';
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  footerContent?: ReactNode;
}

export default function CaptureCard({
  snapHeight,
  topInset,
  isSearching,
  captureMode,
  cameraSessionKey,
  captureScale,
  captureTranslateY,
  colors,
  t,
  noteText,
  onChangeNoteText,
  restaurantName,
  onChangeRestaurantName,
  capturedPhoto,
  onRetakePhoto,
  needsCameraPermission,
  onRequestCameraPermission,
  facing,
  onToggleFacing,
  onOpenPhotoLibrary,
  cameraRef,
  shouldRenderCameraPreview,
  flashAnim,
  permissionGranted,
  onShutterPressIn,
  onShutterPressOut,
  onTakePicture,
  onSaveNote,
  saving,
  shutterScale,
  cameraStatusText,
  libraryImportLocked = false,
  importingPhoto = false,
  shareTarget,
  onChangeShareTarget,
  footerContent,
}: CaptureCardProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [cameraIssueDetail, setCameraIssueDetail] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const isCameraSaveMode = captureMode === 'camera';
  const isSharedTarget = shareTarget === 'shared';
  const privateAudienceLabel = t('shared.capturePrivate', 'Just me');
  const sharedAudienceLabel = t('shared.manageTitle', 'Friends');
  const audienceLabel = isSharedTarget ? sharedAudienceLabel : privateAudienceLabel;
  const audienceSizerLabel =
    privateAudienceLabel.length >= sharedAudienceLabel.length ? privateAudienceLabel : sharedAudienceLabel;
  const privateAudienceSurfaceBackground = captureMode === 'text' ? colors.captureGlassFill : colors.captureCameraOverlay;
  const sharedAudienceSurfaceBackground = '#FFF4DE';
  const privateAudienceSurfaceBorder = captureMode === 'text' ? colors.captureGlassBorder : colors.captureCameraOverlayBorder;
  const sharedAudienceSurfaceBorder = 'rgba(255,255,255,0.56)';
  const privateAudienceColor = captureMode === 'text' ? colors.captureGlassText : colors.captureCameraOverlayText;
  const sharedAudienceColor = colors.primary;
  const audienceIconColor = isSharedTarget ? sharedAudienceColor : privateAudienceColor;
  const audienceProgress = useSharedValue(isSharedTarget ? 1 : 0);
  const audiencePressScale = useSharedValue(1);
  const audienceStateScale = useSharedValue(1);

  useEffect(() => {
    if (captureMode === 'camera' && !capturedPhoto && permissionGranted && shouldRenderCameraPreview) {
      setIsCameraReady(false);
      setCameraUnavailable(false);
      setCameraIssueDetail(null);
      return;
    }

    setIsCameraReady(true);
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
  }, [captureMode, capturedPhoto, permissionGranted, cameraSessionKey, cameraRetryNonce, shouldRenderCameraPreview]);

  useEffect(() => {
    let cancelled = false;

    if (captureMode !== 'camera' || capturedPhoto || !permissionGranted || !shouldRenderCameraPreview) {
      return () => {
        cancelled = true;
      };
    }

    void CameraView.isAvailableAsync()
      .then((available) => {
        if (cancelled || available) {
          return;
        }

        setCameraUnavailable(true);
        setIsCameraReady(false);
      })
      .catch(() => {
        // Ignore availability probe failures and rely on onMountError when available.
      });

    return () => {
      cancelled = true;
    };
  }, [captureMode, capturedPhoto, permissionGranted, cameraSessionKey, cameraRetryNonce, shouldRenderCameraPreview]);

  useEffect(() => {
    audienceProgress.value = withTiming(isSharedTarget ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    audienceStateScale.value = withSequence(
      withTiming(0.94, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.1)) })
    );
  }, [audienceProgress, audienceStateScale, isSharedTarget]);

  const animatedAudienceBadgeStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      audienceProgress.value,
      [0, 1],
      [privateAudienceSurfaceBackground, sharedAudienceSurfaceBackground]
    ),
    borderColor: interpolateColor(
      audienceProgress.value,
      [0, 1],
      [privateAudienceSurfaceBorder, sharedAudienceSurfaceBorder]
    ),
    transform: [{ scale: audiencePressScale.value * audienceStateScale.value }],
  }));

  const animatedAudienceIconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(audienceProgress.value, [0, 1], [privateAudienceColor, sharedAudienceColor]),
  }));

  const animatedAudienceTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(audienceProgress.value, [0, 1], [privateAudienceColor, sharedAudienceColor]),
  }));
  const showCameraUnavailableState =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && cameraUnavailable;
  const cameraUnavailableDetail =
    cameraIssueDetail?.trim() || t(
      'capture.cameraUnavailableHint',
      'This can happen on a simulator or when the camera session gets stuck. Try again or use a physical device.'
    );

  return (
    <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
      <Animated.View
        style={[
          styles.captureArea,
          {
            transform: [{ translateY: captureTranslateY }, { scale: captureScale }],
          },
        ]}
        pointerEvents={isSearching ? 'none' : 'auto'}
      >
        {captureMode === 'text' ? (
          <View
            style={[
              styles.textCard,
              {
                backgroundColor: colors.primary,
                borderColor: colors.captureCardBorder,
              },
            ]}
          >
            <View style={styles.cardTextCenter}>
              <TextInput
                key={`note-text-${isSearching}`}
                style={[styles.textInput, { color: colors.captureCardText }]}
                placeholder={t('capture.textPlaceholder', 'Note about this place...')}
                placeholderTextColor={colors.captureCardPlaceholder}
                multiline
                value={noteText}
                onChangeText={onChangeNoteText}
                maxLength={300}
                selectionColor={colors.captureCardText}
              />
            </View>

            <View style={[styles.cardRestaurantPill, { borderColor: colors.captureGlassBorder }]}>
              {isOlderIOS ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: colors.captureGlassFill,
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
                colorScheme={colors.captureGlassColorScheme}
              />
              <Ionicons
                name="restaurant-outline"
                size={14}
                color={colors.captureGlassIcon}
              />
              <TextInput
                key={`restaurant-${isSearching}`}
                style={[styles.cardRestaurantInput, { color: colors.captureGlassText }]}
                placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                placeholderTextColor={colors.captureGlassPlaceholder}
                value={restaurantName}
                onChangeText={onChangeRestaurantName}
                maxLength={100}
                selectionColor={colors.captureGlassText}
              />
            </View>
          </View>
        ) : capturedPhoto ? (
          <View style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}>
            <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />
            <Pressable
              style={[
                styles.cameraOverlayButton,
                styles.retakeBtn,
                {
                  backgroundColor: colors.captureCameraOverlay,
                  borderColor: colors.captureCameraOverlayBorder,
                },
              ]}
              onPress={onRetakePhoto}
            >
              <Ionicons name="refresh" size={18} color={colors.captureCameraOverlayText} />
              <Text style={[styles.retakeBtnText, { color: colors.captureCameraOverlayText }]}>
                {t('capture.retake', 'Retake')}
              </Text>
            </Pressable>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.captureFlashOverlay, opacity: flashAnim, zIndex: 50 },
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
          <View
            style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
            collapsable={false}
          >
            {showCameraUnavailableState ? (
              <View style={styles.cameraUnavailableState}>
                <Ionicons name="camera-outline" size={42} color={colors.captureCameraOverlayText} />
                <Text style={[styles.cameraUnavailableTitle, { color: colors.captureCameraOverlayText }]}>
                  {t('capture.cameraUnavailable', "Camera preview couldn't start")}
                </Text>
                <Text style={[styles.cameraUnavailableHint, { color: colors.captureCameraOverlayText }]}>
                  {cameraUnavailableDetail}
                </Text>
                <PrimaryButton
                  label={t('capture.cameraTryAgain', 'Try Again')}
                  variant="secondary"
                  onPress={() => {
                    setCameraUnavailable(false);
                    setCameraIssueDetail(null);
                    setIsCameraReady(false);
                    setCameraRetryNonce((current) => current + 1);
                  }}
                  style={styles.cameraRetryButton}
                />
              </View>
            ) : (
              <>
                {captureMode === 'camera' && shouldRenderCameraPreview ? (
                  <CameraView
                    key={`camera-session-${cameraSessionKey}-${cameraRetryNonce}-${facing}`}
                    style={styles.cameraPreview}
                    facing={facing}
                    ref={cameraRef}
                    onCameraReady={() => {
                      setCameraUnavailable(false);
                      setCameraIssueDetail(null);
                      setIsCameraReady(true);
                    }}
                    onMountError={(error) => {
                      setCameraUnavailable(true);
                      setCameraIssueDetail(error.message);
                      setIsCameraReady(false);
                    }}
                  />
                ) : null}
                {shouldRenderCameraPreview && !isCameraReady ? (
                  <View pointerEvents="none" style={styles.cameraLoadingOverlay}>
                    <ActivityIndicator size="small" color={colors.captureCameraOverlayText} />
                  </View>
                ) : null}
              </>
            )}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.captureFlashOverlay, opacity: flashAnim, zIndex: 50 },
              ]}
            />
            <Pressable
              style={[
                styles.cameraOverlayButton,
                styles.libraryBtn,
                {
                  backgroundColor: colors.captureCameraOverlay,
                  borderColor: colors.captureCameraOverlayBorder,
                },
              ]}
              onPress={onOpenPhotoLibrary}
            >
              {importingPhoto ? (
                <ActivityIndicator size="small" color={colors.captureCameraOverlayText} />
              ) : (
                <>
                  <Ionicons name={libraryImportLocked ? 'sparkles' : 'images'} size={18} color={colors.captureCameraOverlayText} />
                  <Text style={[styles.libraryBtnText, { color: colors.captureCameraOverlayText }]}>
                    {libraryImportLocked ? t('capture.plusLibraryLocked', 'Plus') : t('capture.importPhoto', 'Photos')}
                  </Text>
                </>
              )}
            </Pressable>
            {!showCameraUnavailableState ? (
              <Pressable
                style={[
                  styles.cameraOverlayButton,
                  styles.flipBtn,
                  {
                    backgroundColor: colors.captureCameraOverlay,
                    borderColor: colors.captureCameraOverlayBorder,
                  },
                ]}
                onPress={onToggleFacing}
              >
                <Ionicons name="camera-reverse" size={20} color={colors.captureCameraOverlayText} />
              </Pressable>
            ) : null}
          </View>
        )}

        <View pointerEvents="box-none" style={styles.cardAudienceBadgeHost}>
          <Pressable
            testID="capture-share-target-toggle"
            accessibilityRole="button"
            accessibilityState={{ selected: isSharedTarget }}
            onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
            onPressIn={() => {
              audiencePressScale.value = withTiming(0.97, { duration: 120, easing: Easing.out(Easing.quad) });
            }}
            onPressOut={() => {
              audiencePressScale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
            }}
          >
            <Reanimated.View
              style={[
                styles.cardAudienceBadge,
                isSharedTarget ? styles.cardAudienceBadgeSelected : null,
                animatedAudienceBadgeStyle,
              ]}
            >
              <View pointerEvents="none" style={styles.cardAudienceBadgeSizer}>
                <Ionicons name="lock-closed-outline" size={16} color="transparent" />
                <Text style={[styles.cardAudienceBadgeText, styles.cardAudienceBadgeSizerText]}>
                  {audienceSizerLabel}
                </Text>
              </View>
              <Reanimated.View style={styles.cardAudienceBadgeVisibleContent}>
                <AnimatedIonicons
                  name={shareTarget === 'shared' ? 'people-outline' : 'lock-closed-outline'}
                  size={16}
                  color={audienceIconColor}
                  style={animatedAudienceIconStyle}
                />
                <Reanimated.Text
                  style={[
                    styles.cardAudienceBadgeText,
                    animatedAudienceTextStyle,
                  ]}
                >
                  {audienceLabel}
                </Reanimated.Text>
              </Reanimated.View>
            </Reanimated.View>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.belowCardSection,
          {
            transform: [{ translateY: captureTranslateY }, { scale: captureScale }],
          },
        ]}
      >
        {cameraStatusText ? (
          <Text style={[styles.cameraStatusText, { color: colors.secondaryText }]}>{cameraStatusText}</Text>
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
          <View style={styles.belowCardShutterRow}>
            <Pressable
              testID="capture-save-button"
              onPress={onSaveNote}
              disabled={saving}
              style={[
                styles.shutterOuter,
                {
                  borderColor: colors.border,
                  opacity: saving ? 0.72 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.shutterInner,
                  styles.saveInner,
                  {
                    backgroundColor: isCameraSaveMode ? colors.primary : colors.captureButtonBg,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'} />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={24}
                    color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'}
                  />
                )}
              </View>
            </Pressable>
          </View>
        )}
        {footerContent ? <View style={styles.footerSlot}>{footerContent}</View> : null}
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
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.card,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'android' ? {} : Shadows.card),
    backgroundColor: '#000',
  },
  cameraOverlayButton: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 10,
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraUnavailableState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  cameraUnavailableTitle: {
    ...Typography.body,
    textAlign: 'center',
    fontWeight: '700',
  },
  cameraUnavailableHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
    lineHeight: 18,
  },
  cameraRetryButton: {
    minWidth: 150,
    marginTop: 4,
  },
  flipBtn: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    right: 16,
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  libraryBtn: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 16,
    minHeight: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  libraryBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  retakeBtn: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    right: 16,
    minHeight: TOP_CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: TOP_CONTROL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 5,
    zIndex: 10,
  },
  retakeBtnText: {
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
  cameraStatusText: {
    ...Typography.pill,
    textAlign: 'center',
  },
  cardAudienceBadgeHost: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cardAudienceBadge: {
    minHeight: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAudienceBadgeSizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardAudienceBadgeVisibleContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardAudienceBadgeText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  cardAudienceBadgeSizerText: {
    color: 'transparent',
  },
  cardAudienceBadgeSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInner: {
    transform: [{ scale: 1 }],
  },
  footerSlot: {
    width: '100%',
    paddingTop: 2,
  },
});
