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
import { formatRadiusLabel, NOTE_RADIUS_OPTIONS } from '../../constants/noteRadius';
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
  onToggleCaptureMode: () => void;
  captureMode: 'text' | 'camera';
  radius: number;
  onChangeRadius: (nextRadius: number) => void;
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
  onToggleCaptureMode,
  captureMode,
  radius,
  onChangeRadius,
  colors,
  isDark,
  t,
}: HomeHeaderSearchProps) {
  const modeIconScale = useRef(new Animated.Value(1)).current;
  const didMountRef = useRef(false);
  const [showAndroidRadiusSheet, setShowAndroidRadiusSheet] = useState(false);
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

  const renderRadiusMenu = (size: 'regular' | 'large' = 'regular') => {
    if (Platform.OS !== 'ios') {
      return null;
    }

    const radiusAccessibilityLabel = `${t('capture.radius', 'Radius')}: ${formatRadiusLabel(radius)}`;

    return (
      <Host
        matchContents
        colorScheme={isDark ? 'dark' : 'light'}
        style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
      >
        <Menu
          label={renderHeaderControlLabel('scope', formatRadiusLabel(radius), size)}
          modifiers={[...getHeaderControlModifiers(radiusAccessibilityLabel)]}
        >
          {NOTE_RADIUS_OPTIONS.map((option) => (
            <Button
              key={option}
              label={formatRadiusLabel(option)}
              systemImage={radius === option ? 'checkmark' : undefined}
              onPress={() => onChangeRadius(option)}
            />
          ))}
        </Menu>
      </Host>
    );
  };

  const renderAndroidRadiusButton = () => {
    if (Platform.OS !== 'android') {
      return null;
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('capture.radius', 'Radius')}: ${formatRadiusLabel(radius)}`}
        onPress={() => setShowAndroidRadiusSheet(true)}
        style={[styles.radiusToggleBtn, { backgroundColor: `${colors.primary}18` }]}
      >
        <Ionicons name="locate-outline" size={16} color={colors.primary} />
        <Text style={[styles.radiusToggleText, { color: colors.primary }]}>{formatRadiusLabel(radius)}</Text>
      </Pressable>
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

    if (Platform.OS === 'ios') {
      return (
        <Host
          matchContents
          colorScheme={isDark ? 'dark' : 'light'}
          style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
        >
          <Button onPress={onOpenShared} modifiers={getHeaderControlModifiers(sharedLabel)}>
            {renderHeaderControlLabel('person.2', sharedLabel, size)}
          </Button>
        </Host>
      );
    }

    return (
      <Pressable
        onPress={onOpenShared}
        style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
      >
        <Ionicons name="people-outline" size={20} color={colors.primary} />
      </Pressable>
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
    const radiusAccessibilityLabel = `${t('capture.radius', 'Radius')}: ${formatRadiusLabel(radius)}`;

    return (
      <Host matchContents colorScheme={isDark ? 'dark' : 'light'} style={styles.detachedSwiftControlsHost}>
        <HStack spacing={10} alignment="center">
          <Menu
            label={radiusAccessibilityLabel}
            systemImage="scope"
            modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
          >
            {NOTE_RADIUS_OPTIONS.map((option) => (
              <Button
                key={option}
                label={formatRadiusLabel(option)}
                systemImage={radius === option ? 'checkmark' : undefined}
                onPress={() => onChangeRadius(option)}
              />
            ))}
          </Menu>
          {showSharedButton && onOpenShared ? (
            <Button
              label={t('shared.manageTitle', 'Friends')}
              systemImage="person.2"
              onPress={onOpenShared}
              modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
            />
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

          {renderRadiusMenu()}
          {renderAndroidRadiusButton()}

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

      {Platform.OS === 'android' ? (
        <AppSheet
          visible={showAndroidRadiusSheet}
          onClose={() => setShowAndroidRadiusSheet(false)}
          androidPresentation="floating"
          topInset={topInset}
        >
          <AppSheetScaffold
            headerVariant="standard"
            title={t('capture.radius', 'Radius')}
            contentContainerStyle={styles.radiusSheet}
          >
            <View style={[styles.radiusSheetCard, { backgroundColor: colors.card }]}>
              {NOTE_RADIUS_OPTIONS.map((option, index) => {
                const isSelected = radius === option;

                return (
                  <View key={option}>
                    <Pressable
                      testID={`header-radius-${option}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onChangeRadius(option);
                        setShowAndroidRadiusSheet(false);
                      }}
                      style={({ pressed }) => [
                        styles.radiusSheetRow,
                        isSelected ? { backgroundColor: `${colors.primary}12` } : null,
                        pressed ? styles.radiusSheetRowPressed : null,
                      ]}
                    >
                      <View>
                        <Text style={[styles.radiusSheetLabel, { color: colors.text }]}>
                          {formatRadiusLabel(option)}
                        </Text>
                        <Text style={[styles.radiusSheetHint, { color: colors.secondaryText }]}>
                          {t('capture.reminderRadiusLabel', 'Reminder trigger distance')}
                        </Text>
                      </View>
                      {isSelected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                    </Pressable>
                    {index < NOTE_RADIUS_OPTIONS.length - 1 ? (
                      <View style={[styles.radiusSheetDivider, { backgroundColor: colors.border }]} />
                    ) : null}
                  </View>
                );
              })}
            </View>
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
  radiusToggleBtn: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radiusToggleText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
  swiftHeaderControlHost: {
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
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
  radiusSheet: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  radiusSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'System',
    marginBottom: 16,
  },
  radiusSheetCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  radiusSheetRow: {
    minHeight: 68,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusSheetRowPressed: {
    opacity: 0.84,
  },
  radiusSheetLabel: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'System',
  },
  radiusSheetHint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'System',
    marginTop: 4,
  },
  radiusSheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
});
