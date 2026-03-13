import { Ionicons } from '@expo/vector-icons';
import { Button, HStack, Host, Image as SwiftUIImage, Menu, Text as SwiftUIText } from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  buttonStyle,
  cornerRadius,
  font,
  foregroundStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { GlassView } from 'expo-glass-effect';
import { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  onToggleCaptureMode: () => void;
  captureMode: 'text' | 'camera';
  radius: number;
  onChangeRadius: (nextRadius: number) => void;
  colors: {
    text: string;
    primary: string;
    secondaryText: string;
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
  onToggleCaptureMode,
  captureMode,
  radius,
  onChangeRadius,
  colors,
  isDark,
  t,
}: HomeHeaderSearchProps) {
  const modeIconScale = useRef(new Animated.Value(1)).current;
  const modeIconRotate = useRef(new Animated.Value(0)).current;
  const didMountRef = useRef(false);
  const useDetachedWordmark = isIOS26OrNewer;
  const useDetachedControls = isIOS26OrNewer && !showSearchButton;
  const showHeaderRadiusMenu = Platform.OS === 'ios';

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    modeIconScale.setValue(0.88);
    modeIconRotate.setValue(0);

    Animated.parallel([
      Animated.spring(modeIconScale, {
        toValue: 1,
        tension: 260,
        friction: 18,
        useNativeDriver: true,
      }),
      Animated.timing(modeIconRotate, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      modeIconRotate.setValue(0);
    });
  }, [captureMode, modeIconRotate, modeIconScale]);

  const getHeaderControlMetrics = (size: 'regular' | 'large' = 'regular') => ({
    verticalPadding: size === 'large' ? 11 : 9,
    horizontalPadding: size === 'large' ? 12 : 10,
    iconSize: size === 'large' ? 13 : 12,
    textSize: size === 'large' ? 13 : 12,
  });

  const headerControlBackgroundColor = isDark
    ? 'rgba(255,255,255,0.94)'
    : 'rgba(255,255,255,0.88)';
  const headerControlForegroundColor = '#1C1C1E';

  const renderHeaderControlLabel = (
    systemName: string,
    label: string,
    size: 'regular' | 'large' = 'regular'
  ) => {
    const metrics = getHeaderControlMetrics(size);

    return (
      <HStack
        modifiers={[
          padding({
            top: metrics.verticalPadding,
            bottom: metrics.verticalPadding,
            leading: metrics.horizontalPadding,
            trailing: metrics.horizontalPadding,
          }),
          backgroundOverlay({ color: headerControlBackgroundColor }),
          cornerRadius(999),
        ]}
      >
        <SwiftUIImage systemName={systemName} color={headerControlForegroundColor} size={metrics.iconSize} />
        <SwiftUIText
          modifiers={[
            font({ size: metrics.textSize, weight: 'semibold' }),
            foregroundStyle(headerControlForegroundColor),
          ]}
        >
          {label}
        </SwiftUIText>
      </HStack>
    );
  };

  const renderRadiusMenu = (size: 'regular' | 'large' = 'regular') => {
    if (!showHeaderRadiusMenu) {
      return null;
    }

    return (
      <Host
        matchContents
        colorScheme={isDark ? 'dark' : 'light'}
        style={size === 'large' ? styles.detachedSwiftHeaderControlHost : styles.swiftHeaderControlHost}
      >
        <Menu
          label={renderHeaderControlLabel('scope', formatRadiusLabel(radius), size)}
          modifiers={[buttonStyle('plain'), tint(colors.primary)]}
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
          <Button onPress={onToggleCaptureMode} modifiers={[buttonStyle('plain'), tint(colors.primary)]}>
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
            transform: [
              { scale: modeIconScale },
              {
                rotate: modeIconRotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-14deg', '0deg'],
                }),
              },
            ],
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

  if (useDetachedControls) {
    return (
      <View pointerEvents="box-none" style={[styles.detachedTopRow, { top: topInset + 6 }]}>
        <GlassView
          style={styles.detachedBrandGlass}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
        >
          <Text style={[styles.logoText, styles.detachedBrandText, { color: colors.text }]}>Charmly 💛</Text>
        </GlassView>
        <View style={styles.detachedControlsGroup}>
          {renderRadiusMenu('large')}
          {renderModeToggle('large')}
        </View>
      </View>
    );
  }

  return (
    <>
      {useDetachedWordmark ? (
        <View pointerEvents="none" style={[styles.detachedBrandWrap, { top: topInset + 6 }]}>
          <Text style={[styles.logoText, styles.detachedBrandText, { color: colors.text }]}>Charmly 💛</Text>
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
        {!useDetachedWordmark ? <Text style={[styles.logoText, { color: colors.text }]}>Charmly 💛</Text> : null}
        <View style={styles.headerActions}>
          {showSearchButton ? (
            <Pressable onPress={onOpenSearch}>
              <Ionicons name="search" size={20} color={colors.primary} />
            </Pressable>
          ) : null}

          {renderRadiusMenu()}

          {renderModeToggle()}
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
  logoText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'System',
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
  detachedControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  detachedHeaderOffset: {
    marginTop: 28,
  },
});
