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
import AppSheet from '../AppSheet';
import AppSheetScaffold from '../AppSheetScaffold';
import { GlassView } from '../ui/GlassView';
import { TFunction } from 'i18next';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isIOS26OrNewer } from '../../utils/platform';
import GlassHeader from '../ui/GlassHeader';

interface HomeHeaderSearchProps {
  topInset: number;
  isSearching: boolean;
  searchAnim: Animated.Value;
  searchQuery: string;
  onSearchChange: (nextQuery: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  showSearchButton?: boolean;
  showSharedButton?: boolean;
  showNotesButton?: boolean;
  onOpenShared?: () => void;
  onOpenNotes?: () => void;
  sharedButtonMode?: 'manage' | 'filter';
  sharedButtonActive?: boolean;
  sharedFilterValue?: 'all' | 'friends';
  onChangeSharedFilter?: (nextFilter: 'all' | 'friends') => void;
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
  onToggleCaptureMode,
  captureMode,
  colors,
  isDark,
  t,
}: HomeHeaderSearchProps) {
  const modeIconScale = useRef(new Animated.Value(1)).current;
  const sharedModeProgress = useRef(new Animated.Value(sharedButtonMode === 'filter' ? 1 : 0)).current;
  const sharedFilterProgress = useRef(new Animated.Value(sharedButtonActive ? 1 : 0)).current;
  const didMountRef = useRef(false);
  const [showAndroidSharedFilterSheet, setShowAndroidSharedFilterSheet] = useState(false);
  const useDetachedWordmark = isIOS26OrNewer;
  const useDetachedControls = isIOS26OrNewer && !showSearchButton;
  const useNativeLiquidGlassControls = Platform.OS === 'ios' && isIOS26OrNewer;
  const useIconOnlyHeaderControls = Platform.OS === 'ios';

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    modeIconScale.setValue(0.88);

    Animated.timing(modeIconScale, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [captureMode, modeIconScale]);

  useEffect(() => {
    Animated.timing(sharedModeProgress, {
      toValue: sharedButtonMode === 'filter' ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sharedButtonMode, sharedModeProgress]);

  useEffect(() => {
    Animated.timing(sharedFilterProgress, {
      toValue: sharedButtonActive ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sharedButtonActive, sharedFilterProgress]);

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

  const renderSearchButton = () => {
    if (!showSearchButton) {
      return null;
    }

    if (Platform.OS === 'android') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.searchPlaceholder', 'Search notes...')}
          onPress={onOpenSearch}
          style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
        >
          <Ionicons name="search" size={20} color={colors.primary} />
        </Pressable>
      );
    }

    return (
      <Pressable onPress={onOpenSearch}>
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
        onPress={onToggleCaptureMode}
        style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
      >
        <Animated.View
          style={{
            transform: [{ scale: modeIconScale }],
          }}
        >
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
    const sharedA11yLabel =
      sharedButtonMode === 'filter'
        ? sharedButtonActive
          ? t('home.friendsFilterActive', 'Friends filter on')
          : t('home.friendsFilterInactive', 'Filter by friends')
        : sharedLabel;
    const canShowFilterMenu = sharedButtonMode === 'filter' && Boolean(onChangeSharedFilter);
    const sharedSystemName =
      sharedButtonMode === 'filter' && sharedButtonActive ? 'person.2.fill' : 'person.2';
    const sharedAndroidIcon =
      sharedButtonMode === 'filter' && sharedButtonActive ? 'people' : 'people-outline';
    const animatedContainerStyle = {
      transform: [
        {
          scale: sharedModeProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.04],
          }),
        },
      ],
    };
    const badgeAnimatedStyle = {
      opacity: Animated.multiply(sharedModeProgress, Animated.add(0.35, Animated.multiply(sharedFilterProgress, 0.65))),
      transform: [
        {
          scale: Animated.add(
            0.72,
            Animated.multiply(sharedModeProgress, Animated.add(0.18, Animated.multiply(sharedFilterProgress, 0.1)))
          ),
        },
      ],
    };

    if (Platform.OS === 'ios') {
      const controlLabel = renderHeaderControlLabel(sharedSystemName, sharedLabel, size);

      if (canShowFilterMenu) {
        return (
          <Animated.View style={[styles.sharedButtonContainer, animatedContainerStyle]}>
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
            <Animated.View
              pointerEvents="none"
              style={[
              styles.sharedButtonBadge,
              styles.sharedButtonChevronBadge,
              {
                  backgroundColor: colors.card,
                  borderColor: `${colors.primary}2E`,
                },
                badgeAnimatedStyle,
              ]}
            >
              <Ionicons name="chevron-down" size={9} color={colors.primary} />
            </Animated.View>
          </Animated.View>
        );
      }

      return (
        <Animated.View style={[styles.sharedButtonContainer, animatedContainerStyle]}>
          <Host
            matchContents
            colorScheme={isDark ? 'dark' : 'light'}
            style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
          >
            <Button onPress={onOpenShared} modifiers={getHeaderControlModifiers(sharedA11yLabel)}>
              {controlLabel}
            </Button>
          </Host>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sharedButtonBadge,
              {
                backgroundColor: colors.primary,
              },
              badgeAnimatedStyle,
            ]}
          />
        </Animated.View>
      );
    }

    if (canShowFilterMenu) {
      return (
        <Animated.View style={animatedContainerStyle}>
          <Pressable
            accessibilityLabel={sharedA11yLabel}
            onPress={() => setShowAndroidSharedFilterSheet(true)}
            style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
          >
            <Ionicons name={sharedAndroidIcon} size={20} color={colors.primary} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sharedButtonBadge,
                styles.sharedButtonBadgeAndroid,
                styles.sharedButtonChevronBadge,
                {
                  backgroundColor: colors.card,
                  borderColor: `${colors.primary}2A`,
                },
                badgeAnimatedStyle,
              ]}
            >
              <Ionicons name="chevron-down" size={9} color={colors.primary} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={animatedContainerStyle}>
        <Pressable
          accessibilityLabel={sharedA11yLabel}
          onPress={onOpenShared}
          style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
        >
          <Ionicons name={sharedAndroidIcon} size={20} color={colors.primary} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sharedButtonBadge,
              styles.sharedButtonBadgeAndroid,
              {
                backgroundColor: colors.primary,
              },
              badgeAnimatedStyle,
            ]}
          />
        </Pressable>
      </Animated.View>
    );
  };

  const renderNotesButton = (size: 'regular' | 'large' = 'regular') => {
    if (!showNotesButton || !onOpenNotes) {
      return null;
    }

    const notesLabel = t('notes.viewAllButton', 'View all notes');

    if (Platform.OS === 'ios') {
      return (
        <Host
          matchContents
          colorScheme={isDark ? 'dark' : 'light'}
          style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
        >
          <Button onPress={onOpenNotes} modifiers={getHeaderControlModifiers(notesLabel)}>
            {renderHeaderControlLabel('square.grid.2x2', notesLabel, size)}
          </Button>
        </Host>
      );
    }

    return (
      <Pressable
        onPress={onOpenNotes}
        style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
      >
        <Ionicons name="grid-outline" size={20} color={colors.primary} />
      </Pressable>
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
            sharedButtonMode === 'filter' && onChangeSharedFilter ? (
              <Menu
                label={
                  sharedButtonActive
                    ? t('home.friendsFilterActive', 'Friends filter on')
                    : t('home.friendsFilterInactive', 'Filter by friends')
                }
                systemImage={sharedButtonActive ? 'person.2.fill' : 'person.2'}
                modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
              >
                <Button
                  label={t('home.feedFilterAll', 'All posts')}
                  systemImage={sharedFilterValue === 'all' ? 'checkmark' : undefined}
                  onPress={() => onChangeSharedFilter('all')}
                />
                <Button
                  label={t('home.feedFilterFriends', 'Friends only')}
                  systemImage={sharedFilterValue === 'friends' ? 'checkmark' : undefined}
                  onPress={() => onChangeSharedFilter('friends')}
                />
                <Button
                  label={t('shared.manageTitle', 'Friends')}
                  systemImage="person.crop.circle"
                  onPress={onOpenShared}
                />
              </Menu>
            ) : (
              <Button
                label={t('shared.manageTitle', 'Friends')}
                systemImage="person.2"
                onPress={onOpenShared}
                modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
              />
            )
          ) : null}
          {showNotesButton && onOpenNotes ? (
            <Button
              label={t('notes.viewAllButton', 'View all notes')}
              systemImage="square.grid.2x2"
              onPress={onOpenNotes}
              modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
            />
          ) : null}
          <Button
            label={modeLabel}
            systemImage={modeSystemName}
            onPress={onToggleCaptureMode}
            modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
          />
        </HStack>
      </Host>
    );
  };

  if (useDetachedControls) {
    return (
      <>
        <View pointerEvents="box-none" style={[styles.detachedTopRow, { top: topInset + 6 }]}>
          <GlassView
            style={styles.detachedBrandGlass}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          >
            <View style={styles.brandLockup}>
              <Text style={[styles.logoText, styles.detachedBrandText, { color: colors.text }]}>Noto 💛</Text>
              <Text style={[styles.katakanaText, { color: colors.secondaryText }]}>ノート</Text>
            </View>
          </GlassView>
          {renderDetachedNativeControls()}
        </View>
      </>
    );
  }

  return (
    <>
      {useDetachedWordmark ? (
        <View pointerEvents="none" style={[styles.detachedBrandWrap, { top: topInset + 6 }]}>
          <View style={styles.brandLockup}>
            <Text style={[styles.logoText, styles.detachedBrandText, { color: colors.text }]}>Noto 💛</Text>
            <Text style={[styles.katakanaText, { color: colors.secondaryText }]}>ノート</Text>
          </View>
        </View>
      ) : null}

      <GlassHeader
        topInset={topInset}
        style={useDetachedWordmark ? styles.detachedHeaderOffset : undefined}
      >
      <Animated.View
        pointerEvents={isSearching ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          styles.defaultHeader,
          useDetachedWordmark ? styles.defaultHeaderDetached : null,
          {
            opacity: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
            ],
          },
        ]}
      >
        {!useDetachedWordmark ? (
          <View style={styles.brandLockup}>
            <Text style={[styles.logoText, { color: colors.text }]}>Noto 💛</Text>
            <Text style={[styles.katakanaText, { color: colors.secondaryText }]}>ノート</Text>
          </View>
        ) : null}
        <View style={styles.headerActions}>
          {Platform.OS === 'ios' ? renderSearchButton() : null}
          {renderSharedButton()}
          {renderNotesButton()}

          {renderModeToggle()}
          {Platform.OS === 'android' ? renderSearchButton() : null}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={isSearching ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          styles.searchHeader,
          {
            opacity: searchAnim,
            transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <View style={styles.searchContainer}>
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
          <Pressable onPress={onCloseSearch}>
            <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
          </Pressable>
        </View>
      </Animated.View>
      </GlassHeader>

      {Platform.OS === 'android' && sharedButtonMode === 'filter' && onChangeSharedFilter ? (
        <AppSheet
          visible={showAndroidSharedFilterSheet}
          onClose={() => setShowAndroidSharedFilterSheet(false)}
          androidPresentation="floating"
          topInset={topInset}
        >
          <AppSheetScaffold
            headerVariant="standard"
            title={t('shared.manageTitle', 'Friends')}
            subtitle={t('home.feedFilterHint', 'Choose what kind of posts you want to see in Home.')}
            contentContainerStyle={styles.sharedFilterSheet}
          >
            <View
              style={[
                styles.sharedFilterSheetCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
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
                        setShowAndroidSharedFilterSheet(false);
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
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShowAndroidSharedFilterSheet(false);
                onOpenShared?.();
              }}
              style={({ pressed }) => [
                styles.sharedManageRow,
                {
                  backgroundColor: `${colors.primary}10`,
                  borderColor: `${colors.primary}24`,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defaultHeaderDetached: {
    justifyContent: 'flex-end',
  },
  brandLockup: {
    gap: 2,
  },
  logoText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'System',
  },
  katakanaText: {
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    opacity: 0.8,
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
  swiftHeaderControlHost: {
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedButtonContainer: {
    position: 'relative',
  },
  sharedButtonBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sharedButtonBadgeAndroid: {
    right: 8,
    bottom: 8,
  },
  sharedButtonChevronBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
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
    fontFamily: 'System',
  },
  detachedBrandWrap: {
    position: 'absolute',
    left: 20,
    zIndex: 140,
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
  detachedBrandText: {
    fontSize: 16,
  },
  detachedBrandGlass: {
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
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
  },
  sharedFilterSheetCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sharedFilterRow: {
    minHeight: 60,
    paddingHorizontal: 18,
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
    fontFamily: 'System',
  },
  sharedFilterDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 18,
  },
  sharedManageRow: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sharedManageLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
