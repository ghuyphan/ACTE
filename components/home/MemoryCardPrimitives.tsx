import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Layout, Typography } from '../../constants/theme';
import * as Haptics from '../../hooks/useHaptics';
import { useRelativeTimeNow } from '../../hooks/useRelativeTimeNow';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';
import {
  captureViewAsImage,
  cleanupCapturedImage,
  PolaroidExportError,
  requestSavePermission,
  savePolaroidToLibrary,
  type SavePermissionStatus,
} from '../../services/polaroidExport';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import { getNotePhotoUri } from '../../services/photoStorage';
import { SharedPost } from '../../services/sharedFeedService';
import { showAppAlert } from '../../utils/alert';
import { formatNoteTimestamp } from '../../utils/dateUtils';
import ImageMemoryCard from '../notes/ImageMemoryCard';
import {
  DEFAULT_DEBUG_TILT_STATE,
  type DebugTiltState,
} from '../notes/StickerPhysicsDebugControls';
import PolaroidCaptureButton from '../notes/detail/PolaroidCaptureButton';
import PolaroidExportAnimation from '../notes/detail/PolaroidExportAnimation';
import PolaroidExportView from '../notes/detail/PolaroidExportView';
import TextMemoryCard from '../notes/TextMemoryCard';
import { GlassView } from '../ui/GlassView';
import { glassTokens, getGlassSurfacePalette } from '../ui/glassTokens';
import LivePhotoIcon from '../ui/LivePhotoIcon';
import SharedPostCardVisual from './SharedPostCardVisual';

type MemoryColors = {
  primary: string;
  text: string;
  secondaryText: string;
  danger: string;
  card: string;
  border?: string;
  primarySoft?: string;
};

interface NoteMemoryCardProps {
  note: Note;
  colors: MemoryColors;
  t: TFunction;
  onPress?: () => void;
  cardSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  isActive?: boolean;
  isSharedByMe?: boolean;
}

interface SharedPostMemoryCardProps {
  post: SharedPost;
  colors: MemoryColors;
  t: TFunction;
  onPress?: () => void;
  cardSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  isActive?: boolean;
  showSharedBadge?: boolean;
  metadataFullWidth?: boolean;
}

const RENDER_SIGNATURE_SEPARATOR = '\u001f';

function signatureValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

export function getNoteMemoryCardRenderSignature(note: Note) {
  return [
    note.id,
    note.type,
    note.content,
    note.caption,
    note.photoLocalUri,
    note.photoSyncedLocalUri,
    note.photoRemoteBase64,
    note.isLivePhoto,
    note.pairedVideoLocalUri,
    note.pairedVideoSyncedLocalUri,
    note.pairedVideoRemotePath,
    note.locationName,
    note.captureVariant,
    note.dualPrimaryPhotoLocalUri,
    note.dualSecondaryPhotoLocalUri,
    note.dualPrimaryFacing,
    note.dualSecondaryFacing,
    note.dualLayoutPreset,
    note.dualComposedPhotoLocalUri,
    note.createdAt,
    note.isFavorite,
    note.moodEmoji,
    note.noteColor,
    note.hasDoodle,
    note.doodleStrokesJson,
    note.hasStickers,
    note.stickerPlacementsJson,
  ].map(signatureValue).join(RENDER_SIGNATURE_SEPARATOR);
}

export function getSharedPostMemoryCardRenderSignature(post: SharedPost) {
  return [
    post.id,
    post.type,
    post.text,
    post.photoLocalUri,
    post.photoPath,
    post.isLivePhoto,
    post.pairedVideoLocalUri,
    post.pairedVideoPath,
    post.doodleStrokesJson,
    post.hasStickers,
    post.stickerPlacementsJson,
    post.noteColor,
    post.placeName,
    post.createdAt,
    post.authorDisplayName,
    post.authorPhotoURLSnapshot,
  ].map(signatureValue).join(RENDER_SIGNATURE_SEPARATOR);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function MemoryVisualPressable({
  accessibilityLabel,
  children,
  onPress,
  testID,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
  onPress?: () => void;
  testID: string;
}) {
  if (!onPress) {
    return <View style={styles.cardFill}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={() => [
        styles.cardFill,
        styles.visualCardPressable,
      ]}
    >
      {children}
    </Pressable>
  );
}

function NoteCardVisual({
  debugTiltOverride,
  fallbackGradient,
  isActive,
  note,
}: {
  debugTiltOverride: ReturnType<typeof useSharedValue<DebugTiltState>>;
  fallbackGradient: readonly [string, string];
  isActive: boolean;
  note: Note;
}) {
  if (note.type === 'photo') {
    return (
      <ImageMemoryCard
        imageUrl={getNotePhotoUri(note)}
        caption={note.caption}
        isLivePhoto={note.isLivePhoto}
        pairedVideoUri={getNotePairedVideoUri(note)}
        showLiveBadge={false}
        enablePlayback={isActive}
        autoPreviewOnceOnEnable={isActive}
        doodleStrokesJson={note.doodleStrokesJson}
        stickerPlacementsJson={note.stickerPlacementsJson}
        isActive={isActive}
        debugTiltOverride={debugTiltOverride}
      />
    );
  }

  return (
    <TextMemoryCard
      text={note.content}
      noteId={note.id}
      emoji={note.moodEmoji}
      noteColor={note.noteColor}
      fallbackGradient={fallbackGradient}
      doodleStrokesJson={note.doodleStrokesJson}
      stickerPlacementsJson={note.stickerPlacementsJson}
      isActive={isActive}
      debugTiltOverride={debugTiltOverride}
    />
  );
}

function MetadataContainer({
  accessibilityLabel,
  children,
  onPress,
  containerStyle,
  pillStyle,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
  onPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  pillStyle?: StyleProp<ViewStyle>;
}) {
  const pill = (
    <MetadataSurface style={[styles.metadataPill, pillStyle]}>
      {children}
    </MetadataSurface>
  );

  if (!onPress) {
    return containerStyle ? <View style={containerStyle}>{pill}</View> : pill;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metadataPressable,
        containerStyle,
        pressed ? styles.metadataPressablePressed : null,
      ]}
    >
      {pill}
    </Pressable>
  );
}

function MetadataSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  const glassPalette = getGlassSurfacePalette({
    isDark,
    borderColor: colors.border,
    colors,
  });

  return (
    <View
      style={[
        styles.metadataPillShell,
        style,
        {
          borderColor: glassPalette.controlBorderColor,
          backgroundColor: Platform.OS === 'android' ? glassPalette.controlBackgroundColor : 'transparent',
        },
      ]}
    >
      {Platform.OS !== 'android' ? (
        <GlassView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          fallbackColor={glassPalette.fallbackControlBackgroundColor}
        />
      ) : null}
      {children}
    </View>
  );
}

function MetadataIconButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metadataIconButtonPressable,
        disabled ? styles.metadataIconButtonDisabled : null,
        pressed && !disabled ? styles.metadataIconButtonPressablePressed : null,
      ]}
    >
      <MetadataSurface style={[styles.metadataPill, styles.metadataIconButton]}>
        {children}
      </MetadataSurface>
    </Pressable>
  );
}

const BADGE_COLLAPSED_SIZE = 36;
const BADGE_GLYPH_BOX = 18;
const BADGE_HORIZONTAL_PADDING = 10;
const BADGE_LABEL_GAP = 6;
const BADGE_EXPAND_IN_DURATION_MS = 180;
const BADGE_EXPAND_OUT_DURATION_MS = 140;

function estimateBadgeLabelWidth(label: string) {
  return Math.max(32, Math.ceil(label.trim().length * 7.6));
}

function ExpandableStatusBadge({
  accessibilityHint,
  accessibilityLabel,
  expanded,
  icon,
  label,
  labelColor,
  onPress,
  side,
  testID,
}: {
  accessibilityHint: string;
  accessibilityLabel: string;
  expanded: boolean;
  icon: ReactNode;
  label: string;
  labelColor: string;
  onPress: () => void;
  side: 'left' | 'right';
  testID: string;
}) {
  const { colors, isDark } = useTheme();
  const glassPalette = getGlassSurfacePalette({
    isDark,
    borderColor: colors.border,
    colors,
  });
  const progress = useSharedValue(expanded ? 1 : 0);
  const labelWidth = useMemo(() => estimateBadgeLabelWidth(label), [label]);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? BADGE_EXPAND_IN_DURATION_MS : BADGE_EXPAND_OUT_DURATION_MS,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [expanded, progress]);

  const targetExpandedWidth = Math.max(
    BADGE_COLLAPSED_SIZE,
    BADGE_HORIZONTAL_PADDING * 2 + BADGE_GLYPH_BOX + BADGE_LABEL_GAP + labelWidth
  );

  const animatedContainerStyle = useAnimatedStyle(() => ({
    width:
      BADGE_COLLAPSED_SIZE + (targetExpandedWidth - BADGE_COLLAPSED_SIZE) * progress.value,
    paddingHorizontal: BADGE_HORIZONTAL_PADDING * progress.value,
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    width: labelWidth * progress.value,
    marginLeft: side === 'left' ? BADGE_LABEL_GAP * progress.value : 0,
    marginRight: side === 'right' ? BADGE_LABEL_GAP * progress.value : 0,
    transform: [
      {
        translateX: side === 'right' ? -6 * (1 - progress.value) : 6 * (1 - progress.value),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      hitSlop={8}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.badgePressable, pressed ? styles.badgePressablePressed : null]}
    >
      <Animated.View
        style={[
          styles.badge,
          styles.expandableBadge,
          expanded
            ? side === 'right'
              ? styles.rightExpandableBadgeExpanded
              : styles.leftExpandableBadgeExpanded
            : null,
          animatedContainerStyle,
          {
            borderColor: glassPalette.controlBorderColor,
            backgroundColor: Platform.OS === 'android' ? glassPalette.controlBackgroundColor : 'transparent',
          },
        ]}
      >
        {Platform.OS !== 'android' ? (
          <GlassView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
            fallbackColor={glassPalette.fallbackControlBackgroundColor}
          />
        ) : null}
        {side === 'right' ? (
          <>
            <Animated.View style={[styles.badgeLabelWrap, animatedLabelStyle]}>
              <Text numberOfLines={1} style={[styles.expandableBadgeText, { color: labelColor }]}>
                {label}
              </Text>
            </Animated.View>
            <View style={styles.badgeGlyph}>{icon}</View>
          </>
        ) : (
          <>
            <View style={styles.badgeGlyph}>{icon}</View>
            <Animated.View style={[styles.badgeLabelWrap, animatedLabelStyle]}>
              <Text numberOfLines={1} style={[styles.expandableBadgeText, { color: labelColor }]}>
                {label}
              </Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function NoteMemoryCard({
  note,
  colors,
  t,
  onPress,
  cardSize,
  containerStyle,
  isActive = false,
  isSharedByMe = false,
}: NoteMemoryCardProps) {
  const { colors: themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotion();
  const now = useRelativeTimeNow();
  const resolvedCardSize = cardSize ?? width - (Layout.screenPadding - 8) * 2;
  const dateStr = formatNoteTimestamp(note.createdAt, 'card', now);
  const debugTiltOverride = useSharedValue<DebugTiltState>(DEFAULT_DEBUG_TILT_STATE);
  const locationLabel = note.locationName ?? t('home.unknownLocation', 'Unknown location');
  const [expandedBadgeKey, setExpandedBadgeKey] = useState<'shared' | 'live-photo' | 'favorite' | null>(null);
  const [polaroidExporting, setPolaroidExporting] = useState(false);
  const [showPolaroidCapture, setShowPolaroidCapture] = useState(false);
  const [polaroidAnimationUri, setPolaroidAnimationUri] = useState<string | null>(null);
  const [polaroidAnimationSuccess, setPolaroidAnimationSuccess] = useState(false);
  const polaroidCaptureRef = useRef<View | null>(null);
  const polaroidTempUriRef = useRef<string | null>(null);
  const polaroidReadyResolverRef = useRef<(() => void) | null>(null);
  const sharedStatusLabel = t('home.noteStatusShared', 'Shared');
  const sharedStatusA11yLabel = t('home.noteStatusSharedA11y', 'Shared with friends');
  const livePhotoPreviewHintLabel = t('home.noteStatusLivePhotoHint', 'Hold to preview');
  const livePhotoStatusA11yLabel = t('home.noteStatusLivePhotoA11y', 'Live Photo memory');
  const favoriteStatusLabel = t('home.noteStatusFavorite', 'Favorite');
  const favoriteStatusA11yLabel = t('home.noteStatusFavoriteA11y', 'Marked as favorite');
  const statusDisclosureHint = t('home.noteStatusShowHint', 'Shows what this badge means');
  const toggleExpandedBadge = (key: 'shared' | 'live-photo' | 'favorite') => {
    setExpandedBadgeKey((current) => (current === key ? null : key));
  };
  const noteCardAccessibilityLabel = onPress
    ? t('home.openNoteDetailsA11y', {
        defaultValue: 'Open note details for {{location}}',
        location: locationLabel,
      })
    : undefined;
  const noteCardPolaroidAccessibilityLabel = onPress
    ? t('noteDetail.downloadPolaroid', 'Save as Polaroid')
    : undefined;

  const cleanupPolaroidCaptureResources = useCallback(() => {
    cleanupCapturedImage(polaroidTempUriRef.current);
    polaroidTempUriRef.current = null;
    polaroidReadyResolverRef.current = null;
  }, []);

  const resetPolaroidCaptureState = useCallback(() => {
    cleanupPolaroidCaptureResources();
    setPolaroidAnimationUri(null);
    setPolaroidAnimationSuccess(false);
    setShowPolaroidCapture(false);
    setPolaroidExporting(false);
  }, [cleanupPolaroidCaptureResources]);

  const waitForPolaroidRenderReady = useCallback(() => {
    return new Promise<void>((resolve) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        polaroidReadyResolverRef.current = null;
        resolve();
      }, 900);

      polaroidReadyResolverRef.current = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        polaroidReadyResolverRef.current = null;
        resolve();
      };
    });
  }, []);

  const handlePolaroidRenderReady = useCallback(() => {
    polaroidReadyResolverRef.current?.();
  }, []);

  const handlePolaroidAnimationFinished = useCallback(() => {
    resetPolaroidCaptureState();
  }, [resetPolaroidCaptureState]);

  const showPolaroidPermissionAlert = useCallback((status: SavePermissionStatus) => {
    const buttons = status === 'blocked'
      ? [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel' as const,
          },
          {
            text: t('common.openSettings', 'Open Settings'),
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      : undefined;

    showAppAlert(
      t('noteDetail.polaroidPermissionTitle', 'Photo library access needed'),
      t(
        status === 'blocked'
          ? 'noteDetail.polaroidPermissionSettingsMsg'
          : 'noteDetail.polaroidPermissionMsg',
        status === 'blocked'
          ? 'Photo library access is blocked for Noto. Open Settings so polaroids can be saved to your camera roll.'
          : 'Allow photo library access so Noto can save polaroid cards to your camera roll.'
      ),
      buttons
    );
  }, [t]);

  const showPolaroidRequiresUpdateAlert = useCallback(() => {
    showAppAlert(
      t('noteDetail.polaroidRequiresUpdateTitle', 'Update required'),
      t(
        'noteDetail.polaroidRequiresUpdateMsg',
        'Saving polaroids needs the latest app build. Restart after rebuilding to use this feature.'
      )
    );
  }, [t]);

  const handleDownloadPolaroid = useCallback(async () => {
    if (!noteCardPolaroidAccessibilityLabel || polaroidExporting) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPolaroidExporting(true);
    setPolaroidAnimationSuccess(false);
    setPolaroidAnimationUri(null);

    let permissionStatus: SavePermissionStatus;

    try {
      permissionStatus = await requestSavePermission();
    } catch (error) {
      setPolaroidExporting(false);
      if (error instanceof PolaroidExportError && error.code === 'requires-update') {
        showPolaroidRequiresUpdateAlert();
        return;
      }

      showAppAlert(
        t('noteDetail.polaroidExportFailedTitle', 'Could not save polaroid'),
        t(
          'noteDetail.polaroidExportFailed',
          'Could not create the polaroid right now. Please try again.'
        )
      );
      return;
    }

    if (permissionStatus !== 'granted') {
      setPolaroidExporting(false);
      showPolaroidPermissionAlert(permissionStatus);
      return;
    }

    setShowPolaroidCapture(true);
    await waitForPolaroidRenderReady();
    await delay(reduceMotionEnabled ? 60 : 140);

    let capturedUri: string | null = null;

    try {
      capturedUri = await captureViewAsImage(polaroidCaptureRef);
      polaroidTempUriRef.current = capturedUri;
      setPolaroidAnimationUri(capturedUri);
      await savePolaroidToLibrary(capturedUri);
      setPolaroidAnimationSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Note card polaroid export failed:', error);
      resetPolaroidCaptureState();
      if (error instanceof PolaroidExportError && error.code === 'requires-update') {
        showPolaroidRequiresUpdateAlert();
        return;
      }

      showAppAlert(
        t('noteDetail.polaroidExportFailedTitle', 'Could not save polaroid'),
        t(
          'noteDetail.polaroidExportFailed',
          'Could not create the polaroid right now. Please try again.'
        )
      );
      return;
    } finally {
      setPolaroidExporting(false);
    }
  }, [
    noteCardPolaroidAccessibilityLabel,
    polaroidExporting,
    reduceMotionEnabled,
    resetPolaroidCaptureState,
    showPolaroidPermissionAlert,
    showPolaroidRequiresUpdateAlert,
    t,
    waitForPolaroidRenderReady,
  ]);

  useEffect(() => () => {
    cleanupPolaroidCaptureResources();
  }, [cleanupPolaroidCaptureResources]);
  const noteMetadata = (
    <View style={styles.metadataPillContent}>
      <View style={styles.metadataPillMain}>
        <View style={styles.metadataLocationGroup}>
          <Ionicons name="location" size={14} color={colors.secondaryText} />
          <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
            {locationLabel}
          </Text>
        </View>
        <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
        <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
      </View>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={15}
          color={colors.secondaryText}
          style={styles.metadataPillChevron}
        />
      ) : null}
    </View>
  );

  const noteCardBody = (
    <View style={[styles.cardRoot, containerStyle, { width: resolvedCardSize }]}>
      <View style={[styles.noteCardWrapper, { width: resolvedCardSize, height: resolvedCardSize }]}>
        <MemoryVisualPressable
          accessibilityLabel={noteCardAccessibilityLabel}
          onPress={onPress}
          testID="note-memory-visual-action"
        >
          <NoteCardVisual
            debugTiltOverride={debugTiltOverride}
            fallbackGradient={themeColors.captureGradient}
            isActive={isActive}
            note={note}
          />
        </MemoryVisualPressable>

        {note.isFavorite || note.isLivePhoto || isSharedByMe ? (
          <View style={styles.badgeStack}>
            {note.isFavorite ? (
              <ExpandableStatusBadge
                accessibilityHint={statusDisclosureHint}
                accessibilityLabel={favoriteStatusA11yLabel}
                expanded={expandedBadgeKey === 'favorite'}
                icon={<Ionicons name="heart" size={16} color={colors.danger} />}
                label={favoriteStatusLabel}
                labelColor={colors.danger}
                onPress={() => toggleExpandedBadge('favorite')}
                side="right"
                testID="note-memory-favorite-badge"
              />
            ) : null}
            {note.isLivePhoto ? (
              <ExpandableStatusBadge
                accessibilityHint={statusDisclosureHint}
                accessibilityLabel={livePhotoStatusA11yLabel}
                expanded={expandedBadgeKey === 'live-photo'}
                icon={<LivePhotoIcon size={16} color={colors.primary} />}
                label={livePhotoPreviewHintLabel}
                labelColor={colors.primary}
                onPress={() => toggleExpandedBadge('live-photo')}
                side="right"
                testID="note-memory-live-badge"
              />
            ) : null}
            {isSharedByMe ? (
              <ExpandableStatusBadge
                accessibilityHint={statusDisclosureHint}
                accessibilityLabel={sharedStatusA11yLabel}
                expanded={expandedBadgeKey === 'shared'}
                icon={<Ionicons name="people-outline" size={16} color={colors.secondaryText} />}
                label={sharedStatusLabel}
                labelColor={colors.secondaryText}
                onPress={() => toggleExpandedBadge('shared')}
                side="right"
                testID="note-memory-shared-badge"
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.metaContainer, { width: resolvedCardSize }]}>
        {onPress ? (
          <View style={styles.noteMetaRow}>
            <MetadataContainer
              accessibilityLabel={noteCardAccessibilityLabel}
              containerStyle={styles.noteMetaPrimaryAction}
              onPress={onPress}
              pillStyle={styles.noteMetadataPill}
            >
              {noteMetadata}
            </MetadataContainer>
            {noteCardPolaroidAccessibilityLabel ? (
              <MetadataIconButton
                accessibilityLabel={noteCardPolaroidAccessibilityLabel}
                disabled={polaroidExporting}
                onPress={handleDownloadPolaroid}
              >
                <PolaroidCaptureButton
                  color={colors.primary}
                  isCapturing={polaroidExporting}
                />
              </MetadataIconButton>
            ) : null}
          </View>
        ) : (
          <MetadataContainer>
            {noteMetadata}
          </MetadataContainer>
        )}
        {showPolaroidCapture ? (
          <View pointerEvents="none" style={styles.offscreenPolaroidCapture}>
            <PolaroidExportView
              ref={polaroidCaptureRef}
              note={note}
              fallbackLocationLabel={t('noteDetail.unknownLocation', 'Unknown place')}
              fallbackGradient={themeColors.captureGradient}
              onReady={handlePolaroidRenderReady}
            />
          </View>
        ) : null}
        <PolaroidExportAnimation
          uri={polaroidAnimationUri}
          success={polaroidAnimationSuccess}
          successLabel={t('noteDetail.polaroidSaved', 'Saved to your photos')}
          presentation="modal"
          variant="home-feed"
          onFinished={handlePolaroidAnimationFinished}
        />
      </View>
    </View>
  );

  return noteCardBody;
}

export function SharedPostMemoryCard({
  post,
  colors,
  t,
  onPress,
  cardSize,
  containerStyle,
  isActive = false,
  showSharedBadge = false,
  metadataFullWidth = false,
}: SharedPostMemoryCardProps) {
  const { width } = useWindowDimensions();
  const now = useRelativeTimeNow();
  const resolvedCardSize = cardSize ?? width - (Layout.screenPadding - 8) * 2;
  const authorLabel = post.authorDisplayName ?? t('shared.someone', 'Someone');
  const dateStr = formatNoteTimestamp(post.createdAt, 'card', now);
  const debugTiltOverride = useSharedValue<DebugTiltState>(DEFAULT_DEBUG_TILT_STATE);
  const placeLabel = post.placeName ?? t('shared.sharedNow', 'Shared now');
  const authorAvatar = post.authorPhotoURLSnapshot ? (
    <Image
      source={{ uri: post.authorPhotoURLSnapshot }}
      style={styles.sharedAvatarImage}
      contentFit="cover"
    />
  ) : (
    <View style={[styles.sharedAvatarFallback, { backgroundColor: colors.card }]}>
      <Text style={[styles.sharedAvatarLabel, { color: colors.primary }]}>
        {authorLabel.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
  const sharedMetadata = (
    <View style={styles.metadataPillContent}>
      <View style={styles.metadataPillMain}>
        {authorAvatar}
        <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
        <View style={styles.metadataLocationGroup}>
          <Ionicons name="location" size={14} color={colors.secondaryText} />
          <Text style={[styles.metadataPillText, { color: colors.secondaryText }]} numberOfLines={1}>
            {placeLabel}
          </Text>
        </View>
        <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
        <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
      </View>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={15}
          color={colors.secondaryText}
          style={styles.metadataPillChevron}
        />
      ) : null}
    </View>
  );

  const sharedCardAccessibilityLabel = onPress
    ? t('shared.openSharedDetailsA11y', {
        defaultValue: 'Open shared post details for {{location}}',
        location: placeLabel,
      })
    : undefined;
  const sharedCardBody = (
    <View style={[styles.sharedCardWrap, { width: resolvedCardSize }]}>
      <View style={[styles.noteCardWrapper, { width: resolvedCardSize, height: resolvedCardSize }]}>
        <MemoryVisualPressable
          accessibilityLabel={sharedCardAccessibilityLabel}
          onPress={onPress}
          testID="shared-post-memory-visual-action"
        >
          <SharedPostCardVisual
            post={post}
            fallbackText={t('shared.noteFallback', 'Shared note')}
            isActive={isActive}
            debugTiltOverride={debugTiltOverride}
          />
        </MemoryVisualPressable>
        {showSharedBadge ? (
          <View
            pointerEvents="none"
            style={[
              styles.sharedBadge,
              {
                backgroundColor: colors.card,
                borderColor: colors.primarySoft ?? colors.border ?? colors.card,
              },
            ]}
          >
            <Ionicons name="paper-plane-outline" size={14} color={colors.primary} />
            <Text style={[styles.sharedBadgeText, { color: colors.primary }]}>
              {t('shared.cardBadge', 'Shared')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.metaContainer, { width: resolvedCardSize }]}>
        {onPress ? (
          <View style={styles.noteMetaRow}>
            <MetadataContainer
              accessibilityLabel={sharedCardAccessibilityLabel}
              containerStyle={[
                styles.noteMetaPrimaryAction,
                metadataFullWidth ? styles.metadataFullWidth : null,
              ]}
              onPress={onPress}
              pillStyle={[
                styles.noteMetadataPill,
                metadataFullWidth ? styles.metadataFullWidth : null,
              ]}
            >
              {sharedMetadata}
            </MetadataContainer>
          </View>
        ) : (
          <MetadataContainer pillStyle={metadataFullWidth ? styles.metadataFullWidth : null}>
            {sharedMetadata}
          </MetadataContainer>
        )}
      </View>
    </View>
  );

  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: resolvedCardSize }]}>
      {sharedCardBody}
    </View>
  );
  return content;
}

const styles = StyleSheet.create({
  cardRoot: {
    alignSelf: 'center',
    position: 'relative',
  },
  cardFill: {
    flex: 1,
  },
  visualCardPressable: {
    minHeight: 44,
  },
  noteCardWrapper: {
    alignSelf: 'center',
    justifyContent: 'center',
  },
  badge: {
    height: 36,
    minWidth: 36,
    borderRadius: 18,
    borderWidth: glassTokens.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  badgePressable: {
    borderRadius: 18,
  },
  badgePressablePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  badgeStack: {
    position: 'absolute',
    top: 18,
    right: 24,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  metaContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingTop: 16,
  },
  offscreenPolaroidCapture: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 1080,
    height: 1350,
    opacity: 1,
    zIndex: -1,
  },
  noteMetaRow: {
    width: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  noteMetaPrimaryAction: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  noteMetadataPill: {
    maxWidth: '100%',
  },
  expandableBadge: {
    width: BADGE_COLLAPSED_SIZE,
    minWidth: BADGE_COLLAPSED_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leftExpandableBadgeExpanded: {
    justifyContent: 'flex-start',
  },
  rightExpandableBadgeExpanded: {
    justifyContent: 'flex-end',
  },
  badgeGlyph: {
    width: BADGE_GLYPH_BOX,
    height: BADGE_GLYPH_BOX,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabelWrap: {
    overflow: 'hidden',
    flexShrink: 1,
  },
  expandableBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  sharedCardWrap: {
    alignSelf: 'center',
  },
  sharedBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  sharedBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  sharedAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sharedAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedAvatarLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  metadataPill: {
    minHeight: glassTokens.pillControlHeight,
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: glassTokens.pillControlRadius,
  },
  metadataFullWidth: {
    width: '100%',
    maxWidth: '100%',
  },
  metadataPillShell: {
    borderWidth: glassTokens.borderWidth,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  metadataPressable: {
    alignSelf: 'center',
    maxWidth: '88%',
  },
  metadataPressablePressed: {
    opacity: 0.84,
  },
  metadataIconButtonPressable: {
    flexShrink: 0,
  },
  metadataIconButtonDisabled: {
    opacity: 0.68,
  },
  metadataIconButtonPressablePressed: {
    opacity: 0.84,
  },
  metadataIconButton: {
    minHeight: glassTokens.pillControlHeight,
    width: glassTokens.pillControlHeight,
    height: glassTokens.pillControlHeight,
    maxWidth: glassTokens.pillControlHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: glassTokens.pillControlRadius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  metadataPillText: {
    ...Typography.pill,
    flexShrink: 1,
    minWidth: 0,
  },
  metadataLocationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
  },
  metadataPillDate: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
    flexShrink: 0,
  },
  metadataPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  metadataPillChevron: {
    flexShrink: 0,
    marginLeft: -2,
  },
  metadataPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    minWidth: 0,
  },
  metadataPillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
    flexShrink: 1,
  },
});
