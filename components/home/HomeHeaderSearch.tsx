import { Ionicons } from '@expo/vector-icons';
import { Button, HStack, Host, Image as SwiftUIImage, Menu, Text as SwiftUIText } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  backgroundOverlay,
  buttonStyle,
  controlSize,
  cornerRadius,
  font,
  foregroundStyle,
  glassEffect,
  labelStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import { GlassView } from '../ui/GlassView';
import { TFunction } from 'i18next';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Sheet } from '../../constants/theme';
import { isIOS26OrNewer } from '../../utils/platform';
import type { NotesRouteTransitionRect } from '../../utils/notesRouteTransition';
import GlassHeader from '../ui/GlassHeader';

const HEADER_BUTTON_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const HEADER_BUTTON_PRESS_RETENTION_OFFSET = { top: 14, right: 14, bottom: 14, left: 14 } as const;
const BRAND_ICON_SOURCE = require('../../assets/images/icon/icon-default.png');

interface HomeHeaderSearchProps {
  topInset: number;
  isSearching: boolean;
  searchAnim: SharedValue<number>;
  searchQuery: string;
  onSearchChange: (nextQuery: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  showSearchButton?: boolean;
  showSharedButton?: boolean;
  showNotesButton?: boolean;
  onOpenShared?: () => void;
  onOpenNotes?: (origin?: NotesRouteTransitionRect) => void;
  sharedButtonMode?: 'manage' | 'filter';
  sharedButtonActive?: boolean;
  sharedFilterValue?: 'all' | 'friends';
  onChangeSharedFilter?: (nextFilter: 'all' | 'friends') => void;
  hasFriendsForFilter?: boolean;
  onToggleCaptureMode: () => void;
  captureMode: 'text' | 'camera';
  colors: {
    text: string;
    primary: string;
    secondaryText: string;
    card: string;
    border: string;
  };
  isDark: boolean;
  t: TFunction;
  showDockedBlur?: boolean;
}

export default function HomeHeaderSearch({
  topInset,
  isSearching,
  searchAnim,
  searchQuery,
  onSearchChange,
  onOpenSearch,
  onCloseSearch,
  showSearchButton = true,
  showSharedButton = false,
  showNotesButton = false,
  onOpenShared,
  onOpenNotes,
  sharedButtonMode = 'manage',
  sharedButtonActive = false,
  sharedFilterValue = 'all',
  onChangeSharedFilter,
  hasFriendsForFilter = true,
  onToggleCaptureMode,
  captureMode,
  colors,
  isDark,
  t,
  showDockedBlur = false,
}: HomeHeaderSearchProps) {
  const modeIconScale = useSharedValue(1);
  const didMountRef = useRef(false);
  const [showAndroidSharedMenuSheet, setShowAndroidSharedMenuSheet] = useState(false);
  const isAndroid = Platform.OS === 'android';
  const useDetachedWordmark = isIOS26OrNewer;
  const useDetachedControls = isIOS26OrNewer && !showSearchButton;
  const useDockedHeader = Platform.OS === 'android' || (Platform.OS === 'ios' && !isIOS26OrNewer);
  const useNativeLiquidGlassControls = Platform.OS === 'ios' && isIOS26OrNewer;
  const useIconOnlyHeaderControls = Platform.OS === 'ios';
  const androidHeaderControlBackgroundColor = isDark ? 'rgba(255,247,232,0.20)' : 'rgba(255,255,255,0.72)';
  const androidHeaderControlBorderColor = isDark ? 'rgba(255,247,232,0.22)' : 'rgba(113,86,26,0.10)';
  const androidHeaderControlForegroundColor = isDark ? '#FFF7E8' : '#6D530F';
  const androidHeaderSearchBackgroundColor = isDark ? 'rgba(255,247,232,0.22)' : 'rgba(255,255,255,0.88)';
  const notesButtonRef = useRef<View>(null);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    modeIconScale.value = 0.88;
    modeIconScale.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [captureMode, modeIconScale]);

  const modeIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modeIconScale.value }],
  }));
  const defaultHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchAnim.value, [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(searchAnim.value, [0, 1], [0, -10]) }],
  }));
  const searchHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchAnim.value,
    transform: [{ translateY: interpolate(searchAnim.value, [0, 1], [10, 0]) }],
  }));
  const handleOpenNotesPress = useCallback(() => {
    if (!onOpenNotes) {
      return;
    }

    const notesButtonNode = notesButtonRef.current;
    if (!notesButtonNode?.measureInWindow) {
      onOpenNotes();
      return;
    }

    notesButtonNode.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onOpenNotes({ x, y, width, height });
        return;
      }

      onOpenNotes();
    });
  }, [onOpenNotes]);

  const getHeaderControlMetrics = (size: 'regular' | 'large' = 'regular') => ({
    verticalPadding: size === 'large' ? 11 : 9,
    horizontalPadding: size === 'large' ? 12 : 10,
    iconOnlyPadding: size === 'large' ? 14 : 11,
    iconSize: size === 'large' ? 18 : 16,
    textSize: size === 'large' ? 13 : 12,
  });

  const headerControlBackgroundColor = isDark
    ? 'rgba(255,255,255,0.94)'
    : 'rgba(255,255,255,0.88)';
  const headerControlForegroundColor = '#1C1C1E';
  const searchFieldBackgroundColor = isAndroid ? androidHeaderSearchBackgroundColor : headerControlBackgroundColor;
  const searchFieldBorderColor = isAndroid
    ? androidHeaderControlBorderColor
    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(113,86,26,0.10)');

  const getHeaderControlModifiers = (label: string) => {
    const modifiers = [buttonStyle('plain'), accessibilityLabel(label)];

    if (!useNativeLiquidGlassControls) {
      modifiers.push(tint(colors.primary));
    }

    return modifiers;
  };

  const renderHeaderControlLabel = (
    systemName: ComponentProps<typeof SwiftUIImage>['systemName'],
    label: string,
    size: 'regular' | 'large' = 'regular'
  ) => {
    const metrics = getHeaderControlMetrics(size);
    const isIconOnly = useIconOnlyHeaderControls;

    return (
      <HStack
        modifiers={[
          isIconOnly
            ? padding({ all: metrics.iconOnlyPadding })
            : padding({
                top: metrics.verticalPadding,
                bottom: metrics.verticalPadding,
                leading: metrics.horizontalPadding,
                trailing: metrics.horizontalPadding,
              }),
          ...(useNativeLiquidGlassControls
            ? [
                glassEffect({
                  glass: {
                    variant: 'regular',
                    interactive: true,
                  },
                  shape: isIconOnly ? 'circle' : 'capsule',
                }),
              ]
            : [backgroundOverlay({ color: headerControlBackgroundColor }), cornerRadius(999)]),
        ]}
      >
        <SwiftUIImage
          systemName={systemName}
          color={useNativeLiquidGlassControls ? undefined : headerControlForegroundColor}
          size={metrics.iconSize}
        />
        {!isIconOnly ? (
          <SwiftUIText
            modifiers={[
              font({ size: metrics.textSize, weight: 'semibold' }),
              ...(!useNativeLiquidGlassControls ? [foregroundStyle(headerControlForegroundColor)] : []),
            ]}
          >
            {label}
          </SwiftUIText>
        ) : null}
      </HStack>
    );
  };

  const renderDetachedGlassIconButton = ({
    label,
    systemImage,
    onPress,
  }: {
    label: string;
    systemImage: ComponentProps<typeof SwiftUIImage>['systemName'];
    onPress: () => void;
  }) => (
    <Button
      label={label}
      systemImage={systemImage}
      onPress={onPress}
      modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
    >
      {renderHeaderControlLabel(systemImage, label, 'large')}
    </Button>
  );

  const renderSearchButton = () => {
    if (!showSearchButton) {
      return null;
    }

    if (Platform.OS === 'android') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.searchPlaceholder', 'Search notes...')}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          onPress={onOpenSearch}
          pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          style={({ pressed }) => [
            styles.androidSearchButton,
            styles.androidHeaderActionButton,
            {
              backgroundColor: androidHeaderSearchBackgroundColor,
              borderColor: androidHeaderControlBorderColor,
            },
            pressed ? styles.androidGroupedActionPressed : null,
          ]}
        >
          <Ionicons name="search" size={20} color={androidHeaderControlForegroundColor} />
        </Pressable>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.searchPlaceholder', 'Search notes...')}
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        onPress={onOpenSearch}
        pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
      >
        <Ionicons name="search" size={20} color={colors.primary} />
      </Pressable>
    );
  };

  const renderModeToggle = (size: 'regular' | 'large' = 'regular') => {
    const modeLabel =
      captureMode === 'text'
        ? t('capture.switchCamera', 'Camera')
        : t('capture.switchText', 'Text');
    const systemName = captureMode === 'text' ? 'camera' : 'square.and.pencil';

    if (Platform.OS === 'ios') {
      return (
        <Host
          matchContents
          colorScheme={isDark ? 'dark' : 'light'}
          style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
        >
          <Button onPress={onToggleCaptureMode} modifiers={getHeaderControlModifiers(modeLabel)}>
            {renderHeaderControlLabel(systemName, modeLabel, size)}
          </Button>
        </Host>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={modeLabel}
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        onPress={onToggleCaptureMode}
        pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
        style={[
          styles.modeToggleBtn,
          styles.androidHeaderActionButton,
          {
            backgroundColor: androidHeaderControlBackgroundColor,
            borderColor: androidHeaderControlBorderColor,
          },
        ]}
      >
        <Animated.View style={modeIconAnimatedStyle}>
          <Ionicons
            name={captureMode === 'text' ? 'camera-outline' : 'create-outline'}
            size={20}
            color={colors.primary}
          />
        </Animated.View>
      </Pressable>
    );
  };

  const renderSharedButton = (size: 'regular' | 'large' = 'regular') => {
    if (!showSharedButton || !onOpenShared) {
      return null;
    }

    const sharedLabel = t('shared.manageTitle', 'Friends');
    const isSharedFilterControl = sharedButtonMode === 'filter' && hasFriendsForFilter;
    const sharedA11yLabel =
      isSharedFilterControl
        ? sharedButtonActive
          ? t('home.friendsFilterActive', 'Friends filter on')
          : t('home.friendsFilterInactive', 'Filter by friends')
        : sharedLabel;
    const canShowFilterMenu =
      isSharedFilterControl && Boolean(onChangeSharedFilter);
    const sharedSystemName =
      isSharedFilterControl
        ? sharedButtonActive
          ? 'line.3.horizontal.decrease.circle.fill'
          : 'line.3.horizontal.decrease.circle'
        : 'person.2';
    const sharedAndroidIcon =
      isSharedFilterControl
        ? sharedButtonActive
          ? 'filter'
          : 'filter-outline'
        : 'people-outline';
    if (Platform.OS === 'ios') {
      const controlLabel = renderHeaderControlLabel(sharedSystemName, sharedLabel, size);

      if (canShowFilterMenu) {
        return (
          <View style={styles.sharedButtonContainer}>
            <Host
              matchContents
              colorScheme={isDark ? 'dark' : 'light'}
              style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
            >
              <Menu
                label={controlLabel}
                modifiers={getHeaderControlModifiers(sharedA11yLabel)}
              >
                <Button
                  label={t('home.feedFilterAll', 'All posts')}
                  systemImage={sharedFilterValue === 'all' ? 'checkmark' : undefined}
                  onPress={() => onChangeSharedFilter?.('all')}
                />
                <Button
                  label={t('home.feedFilterFriends', 'Friends only')}
                  systemImage={sharedFilterValue === 'friends' ? 'checkmark' : undefined}
                  onPress={() => onChangeSharedFilter?.('friends')}
                />
                <Button
                  label={t('shared.manageTitle', 'Friends')}
                  systemImage="person.crop.circle"
                  onPress={onOpenShared}
                />
              </Menu>
            </Host>
          </View>
        );
      }

      return (
        <View style={styles.sharedButtonContainer}>
          <Host
            matchContents
            colorScheme={isDark ? 'dark' : 'light'}
            style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
          >
            <Button onPress={onOpenShared} modifiers={getHeaderControlModifiers(sharedA11yLabel)}>
              {controlLabel}
            </Button>
          </Host>
        </View>
      );
    }

    if (canShowFilterMenu) {
      return (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sharedA11yLabel}
            hitSlop={HEADER_BUTTON_HIT_SLOP}
            onPress={() => {
              if (hasFriendsForFilter) {
                setShowAndroidSharedMenuSheet(true);
                return;
              }

              onOpenShared();
            }}
            pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
            style={[
              styles.modeToggleBtn,
              styles.androidHeaderActionButton,
              {
                backgroundColor: androidHeaderControlBackgroundColor,
                borderColor: androidHeaderControlBorderColor,
              },
            ]}
          >
            <Ionicons name={sharedAndroidIcon} size={20} color={colors.primary} />
          </Pressable>
        </View>
      );
    }

    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sharedA11yLabel}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          onPress={onOpenShared}
          pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          style={[
            styles.modeToggleBtn,
            styles.androidHeaderActionButton,
            {
              backgroundColor: androidHeaderControlBackgroundColor,
              borderColor: androidHeaderControlBorderColor,
            },
            ]}
          >
            <Ionicons name={sharedAndroidIcon} size={20} color={colors.primary} />
          </Pressable>
      </View>
    );
  };

  const renderNotesButton = (size: 'regular' | 'large' = 'regular') => {
    if (!showNotesButton || !onOpenNotes) {
      return null;
    }

    const notesLabel = t('notes.viewAllButton', 'View all notes');

    if (Platform.OS === 'ios') {
      return (
        <View ref={notesButtonRef} collapsable={false}>
          <Host
            matchContents
            colorScheme={isDark ? 'dark' : 'light'}
            style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
          >
            <Button onPress={handleOpenNotesPress} modifiers={getHeaderControlModifiers(notesLabel)}>
              {renderHeaderControlLabel('square.grid.2x2', notesLabel, size)}
            </Button>
          </Host>
        </View>
      );
    }

    return (
      <View ref={notesButtonRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notesLabel}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          onPress={handleOpenNotesPress}
          pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          style={[
            styles.modeToggleBtn,
            styles.androidHeaderActionButton,
            {
              backgroundColor: androidHeaderControlBackgroundColor,
              borderColor: androidHeaderControlBorderColor,
            },
          ]}
        >
          <Ionicons name="grid-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>
    );
  };

  const renderDetachedNativeControls = () => {
    const modeLabel =
      captureMode === 'text'
        ? t('capture.switchCamera', 'Camera')
        : t('capture.switchText', 'Text');
    const modeSystemName = captureMode === 'text' ? 'camera' : 'square.and.pencil';

    return (
      <Host matchContents colorScheme={isDark ? 'dark' : 'light'} style={styles.detachedSwiftControlsHost}>
        <HStack spacing={10} alignment="center">
          {showSharedButton && onOpenShared ? (
            sharedButtonMode === 'filter' && onChangeSharedFilter && hasFriendsForFilter ? (
              <Menu
                label={
                  sharedButtonActive
                    ? t('home.friendsFilterActive', 'Friends filter on')
                    : t('home.friendsFilterInactive', 'Filter by friends')
                }
                systemImage={
                  sharedButtonActive
                    ? 'line.3.horizontal.decrease.circle.fill'
                    : 'line.3.horizontal.decrease.circle'
                }
                modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
              >
                <Button
                  label={t('home.feedFilterAll', 'All posts')}
                  systemImage={sharedFilterValue === 'all' ? 'checkmark' : undefined}
                  onPress={() => onChangeSharedFilter?.('all')}
                />
                <Button
                  label={t('home.feedFilterFriends', 'Friends only')}
                  systemImage={sharedFilterValue === 'friends' ? 'checkmark' : undefined}
                  onPress={() => onChangeSharedFilter?.('friends')}
                />
                <Button
                  label={t('shared.manageTitle', 'Friends')}
                  systemImage="person.crop.circle"
                  onPress={onOpenShared}
                />
              </Menu>
            ) : (
              renderDetachedGlassIconButton({
                label: t('shared.manageTitle', 'Friends'),
                systemImage: 'person.2',
                onPress: onOpenShared,
              })
            )
          ) : null}
          {showNotesButton && onOpenNotes ? (
            <View ref={notesButtonRef} collapsable={false}>
              {renderDetachedGlassIconButton({
                label: t('notes.viewAllButton', 'View all notes'),
                systemImage: 'square.grid.2x2',
                onPress: handleOpenNotesPress,
              })}
            </View>
          ) : null}
          {renderDetachedGlassIconButton({
            label: modeLabel,
            systemImage: modeSystemName,
            onPress: onToggleCaptureMode,
          })}
        </HStack>
      </Host>
    );
  };

  const renderAndroidGroupedControls = () => (
    <GlassView
      style={[
        styles.androidHeaderActionGroup,
        {
          borderColor: androidHeaderControlBorderColor,
        },
      ]}
      fallbackColor={androidHeaderControlBackgroundColor}
      glassEffectStyle="regular"
      colorScheme={isDark ? 'dark' : 'light'}
    >
      <View style={styles.androidHeaderActionRow}>
        {showNotesButton && onOpenNotes ? (
          <>
            <View ref={notesButtonRef} collapsable={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notes.viewAllButton', 'View all notes')}
                hitSlop={HEADER_BUTTON_HIT_SLOP}
                onPress={handleOpenNotesPress}
                pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
                style={({ pressed }) => [styles.androidGroupedAction, pressed ? styles.androidGroupedActionPressed : null]}
              >
                <Ionicons name="grid-outline" size={18} color={androidHeaderControlForegroundColor} />
              </Pressable>
            </View>
            <View style={[styles.androidGroupedActionDivider, { backgroundColor: androidHeaderControlBorderColor }]} />
          </>
        ) : null}

        {showSharedButton && onOpenShared ? (
          <>
            <View style={styles.sharedButtonContainer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  sharedButtonMode === 'filter'
                    && hasFriendsForFilter
                    ? sharedButtonActive
                      ? t('home.friendsFilterActive', 'Friends filter on')
                      : t('home.friendsFilterInactive', 'Filter by friends')
                    : t('shared.manageTitle', 'Friends')
                }
                hitSlop={HEADER_BUTTON_HIT_SLOP}
                onPress={() => {
                  if (sharedButtonMode === 'filter' && onChangeSharedFilter && hasFriendsForFilter) {
                    setShowAndroidSharedMenuSheet(true);
                    return;
                  }

                  onOpenShared();
                }}
                pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
                style={({ pressed }) => [styles.androidGroupedAction, pressed ? styles.androidGroupedActionPressed : null]}
                >
                  <Ionicons
                    name={
                      sharedButtonMode === 'filter' && hasFriendsForFilter
                        ? sharedButtonActive
                          ? 'filter'
                          : 'filter-outline'
                        : 'people-outline'
                    }
                    size={18}
                    color={androidHeaderControlForegroundColor}
                  />
              </Pressable>
            </View>
            <View style={[styles.androidGroupedActionDivider, { backgroundColor: androidHeaderControlBorderColor }]} />
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            captureMode === 'text'
              ? t('capture.switchCamera', 'Camera')
              : t('capture.switchText', 'Text')
          }
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          onPress={onToggleCaptureMode}
          pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          style={({ pressed }) => [styles.androidGroupedAction, pressed ? styles.androidGroupedActionPressed : null]}
        >
          <Animated.View style={modeIconAnimatedStyle}>
            <Ionicons
              name={captureMode === 'text' ? 'camera-outline' : 'create-outline'}
              size={18}
              color={androidHeaderControlForegroundColor}
            />
          </Animated.View>
        </Pressable>
      </View>
    </GlassView>
  );

  const renderBrandMark = (variant: 'inline' | 'detached' = 'inline') => {
    const isDetached = variant === 'detached';

    return (
      <View style={isDetached ? styles.detachedBrandLockup : styles.brandLockup}>
        <View style={isDetached ? styles.detachedBrandBadge : styles.brandBadge}>
          <Image
            source={BRAND_ICON_SOURCE}
            resizeMode="contain"
            style={isDetached ? styles.detachedBrandIcon : styles.brandIcon}
          />
        </View>
        <Text
          style={[
            isDetached ? styles.detachedBrandLabel : styles.brandLabel,
            { color: colors.text },
          ]}
        >
          ノート
        </Text>
      </View>
    );
  };

  if (useDetachedControls) {
    return (
      <>
        <View pointerEvents="box-none" style={[styles.detachedTopRow, { top: topInset + 6 }]}>
          {renderBrandMark('detached')}
          {renderDetachedNativeControls()}
        </View>
      </>
    );
  }

  return (
    <>
      {useDetachedWordmark ? (
        <View pointerEvents="none" style={[styles.detachedBrandWrap, { top: topInset + 6 }]}>
          {renderBrandMark('detached')}
        </View>
      ) : null}

      <GlassHeader
        topInset={topInset}
        docked={useDockedHeader}
        dockedBlurred={showDockedBlur}
        style={useDetachedWordmark ? styles.detachedHeaderOffset : undefined}
      >
      <Animated.View
        pointerEvents={isSearching ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          styles.defaultHeader,
          useDetachedWordmark ? styles.defaultHeaderDetached : null,
          defaultHeaderAnimatedStyle,
        ]}
      >
        {!useDetachedWordmark ? (
          renderBrandMark()
        ) : null}
        {isAndroid ? (
          <View style={styles.androidHeaderControls}>
            {renderAndroidGroupedControls()}
            {renderSearchButton()}
          </View>
        ) : (
          <View style={styles.headerActions}>
            {renderSearchButton()}
            {renderNotesButton()}
            {renderSharedButton()}
            {renderModeToggle()}
          </View>
        )}
      </Animated.View>

      <Animated.View
        pointerEvents={isSearching ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          styles.searchHeader,
          searchHeaderAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: searchFieldBackgroundColor,
              borderColor: searchFieldBorderColor,
            },
          ]}
        >
          <Ionicons name="search" size={16} color={colors.secondaryText} />
          <View style={styles.searchInputWrap}>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('home.searchPlaceholder', 'Search notes...')}
              placeholderTextColor={colors.secondaryText}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus={isSearching}
              returnKeyType="search"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            hitSlop={HEADER_BUTTON_HIT_SLOP}
            onPress={onCloseSearch}
            pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          >
            <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
          </Pressable>
        </View>
      </Animated.View>
      </GlassHeader>

      {Platform.OS === 'android' && sharedButtonMode === 'filter' && onChangeSharedFilter && hasFriendsForFilter ? (
        <AppSheet
          visible={showAndroidSharedMenuSheet}
          onClose={() => setShowAndroidSharedMenuSheet(false)}
          topInset={topInset}
        >
          <AppSheetScaffold
            headerVariant="standard"
            title={t('shared.manageTitle', 'Friends')}
            subtitle={t('home.feedFilterHint', 'Choose what kind of posts you want to see in Home.')}
            contentContainerStyle={styles.sharedFilterSheet}
            useHorizontalPadding={false}
          >
            <View>
              {(['all', 'friends'] as const).map((option, index) => {
                const isSelected = sharedFilterValue === option;
                const label =
                  option === 'all'
                    ? t('home.feedFilterAll', 'All posts')
                    : t('home.feedFilterFriends', 'Friends only');

                return (
                  <View key={option}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onChangeSharedFilter(option);
                        setShowAndroidSharedMenuSheet(false);
                      }}
                      style={({ pressed }) => [
                        styles.sharedFilterRow,
                        isSelected ? { backgroundColor: `${colors.primary}12` } : null,
                        pressed ? styles.sharedFilterRowPressed : null,
                      ]}
                    >
                      <Text style={[styles.sharedFilterLabel, { color: colors.text }]}>{label}</Text>
                      {isSelected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                    </Pressable>
                    {index === 0 ? (
                      <View style={[styles.sharedFilterDivider, { backgroundColor: colors.border }]} />
                    ) : null}
                  </View>
                );
              })}
              <View style={[styles.sharedFilterDivider, { backgroundColor: colors.border }]} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShowAndroidSharedMenuSheet(false);
                onOpenShared?.();
              }}
              style={({ pressed }) => [styles.sharedManageRow, pressed ? styles.sharedManageRowPressed : null]}
            >
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={[styles.sharedManageLabel, { color: colors.primary }]}>
                {t('shared.manageTitle', 'Friends')}
              </Text>
            </Pressable>
          </AppSheetScaffold>
        </AppSheet>
      ) : null}

    </>
  );
}

const styles = StyleSheet.create({
  defaultHeader: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defaultHeaderDetached: {
    justifyContent: 'flex-end',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandIcon: {
    width: 30,
    height: 30,
  },
  brandLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
    fontFamily: 'Noto Sans',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  androidHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  androidHeaderActionGroup: {
    minHeight: 42,
    paddingHorizontal: 6,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  androidHeaderActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  androidGroupedAction: {
    minWidth: 42,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidGroupedActionPressed: {
    opacity: 0.8,
  },
  androidGroupedActionDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 8,
  },
  androidSearchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleBtn: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  androidHeaderActionButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  swiftHeaderControlHost: {
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedButtonContainer: {
    position: 'relative',
  },
  searchHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 16,
    fontWeight: '500',
    width: '100%',
    fontFamily: 'Noto Sans',
  },
  detachedBrandWrap: {
    position: 'absolute',
    left: 20,
    zIndex: 140,
  },
  detachedBrandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detachedTopRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detachedBrandBadge: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detachedBrandIcon: {
    width: 36,
    height: 36,
  },
  detachedBrandLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.8,
    fontFamily: 'Noto Sans',
  },
  detachedSwiftHeaderControlHost: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detachedSwiftControlsHost: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detachedHeaderOffset: {
    marginTop: 28,
  },
  sharedFilterSheet: {
    gap: 12,
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
  },
  sharedFilterRow: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sharedFilterRowPressed: {
    opacity: 0.9,
  },
  sharedFilterLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  sharedFilterDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
  sharedManageRow: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  sharedManageRowPressed: {
    opacity: 0.9,
  },
  sharedManageLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
