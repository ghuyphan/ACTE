import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import * as Haptics from '../../hooks/useHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSavedNoteRevealUi } from '../../hooks/ui/useSavedNoteRevealUi';
import { useTheme } from '../../hooks/useTheme';
import {
  requestAndroidTabSearchFocus,
  setAndroidTabSearchQuery,
  useAndroidTabSearchFocusRequestId,
  useAndroidTabSearchQuery,
} from '../../hooks/useAndroidTabSearchState';
import {
  ANDROID_TAB_SHELL_BOTTOM_OFFSET,
  ANDROID_TAB_SHELL_HEIGHT,
  ANDROID_TAB_SHELL_HORIZONTAL_INSET,
  ANDROID_TAB_SHELL_INNER_PADDING,
  ANDROID_TAB_SHELL_MIN_SAFE_AREA,
  ANDROID_TAB_SHELL_TAB_GAP,
  ANDROID_TAB_SHELL_TOP_PADDING,
} from './androidTabShellMetrics';

const BAR_PADDING = ANDROID_TAB_SHELL_INNER_PADDING;
const BAR_CONTENT_INSET = BAR_PADDING - 1;
const TAB_GAP = ANDROID_TAB_SHELL_TAB_GAP;
const TAB_MIN_HEIGHT = ANDROID_TAB_SHELL_HEIGHT;
const SEARCH_MORPH_ANIMATION = {
  duration: 320,
  easing: Easing.bezier(0.2, 1, 0.22, 1),
} as const;
const INDICATOR_SPRING = {
  damping: 18,
  mass: 0.78,
  overshootClamping: true,
  stiffness: 220,
} as const;
const SEARCH_NAVIGATION_DELAY_MS = 170;
const KEYBOARD_AVOIDANCE_GAP = 10;
const COMPACT_SCREEN_WIDTH = 390;
const VERY_NARROW_SCREEN_WIDTH = 360;

type PrimaryRouteItem = {
  accessibilityLabel: string;
  key: string;
  label: string;
  params: object | undefined;
  routeName: string;
  descriptor: BottomTabBarProps['descriptors'][string];
};

type ResponsiveMetrics = {
  barContentInset: number;
  compactPrimaryButtonSize: number;
  isCompact: boolean;
  keyboardAvoidanceGap: number;
  searchBarGap: number;
  searchButtonSize: number;
  searchCollapsedTargetWidth: number;
  searchExpandedMinWidth: number;
  searchHorizontalPadding: number;
  searchIconLeft: number;
  searchIconSize: number;
  searchTextOffset: number;
  shellHorizontalInset: number;
  tabGap: number;
  tabIconSize: number;
  tabInnerPaddingHorizontal: number;
  tabInnerPaddingVertical: number;
  tabLabelFontSize: number;
  tabLabelVisible: boolean;
  tabMinWidth: number;
  wrapperTopPadding: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function shouldDisplayTabBar(route: BottomTabBarProps['state']['routes'][number]) {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  return focusedRouteName == null || focusedRouteName === 'index';
}

const CompactPrimaryButton = memo(function CompactPrimaryButton({
  activeRouteKey,
  colors,
  item,
  metrics,
  onLongPress,
  onNavigate,
}: {
  activeRouteKey: string;
  colors: ReturnType<typeof useTheme>['colors'];
  item: PrimaryRouteItem;
  metrics: ResponsiveMetrics;
  onLongPress: (routeKey: string) => void;
  onNavigate: (routeKey: string, routeName: string, routeParams: object | undefined, isFocused: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
      onLongPress={() => onLongPress(item.key)}
      onPress={() => onNavigate(item.key, item.routeName, item.params, activeRouteKey === item.key)}
      style={({ pressed }) => [
        styles.compactPrimaryButton,
        {
          height: metrics.compactPrimaryButtonSize - metrics.barContentInset * 2,
          width: metrics.compactPrimaryButtonSize - metrics.barContentInset * 2,
        },
        pressed ? styles.tabButtonPressed : null,
      ]}
    >
      {item.descriptor.options.tabBarIcon?.({
        focused: true,
        color: colors.androidTabShellActive,
        size: metrics.searchIconSize,
      })}
    </Pressable>
  );
});

const PrimaryRouteButton = memo(function PrimaryRouteButton({
  colors,
  isFocused,
  isLast,
  item,
  metrics,
  onLongPress,
  onNavigate,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  isFocused: boolean;
  isLast: boolean;
  item: PrimaryRouteItem;
  metrics: ResponsiveMetrics;
  onLongPress: (routeKey: string) => void;
  onNavigate: (routeKey: string, routeName: string, routeParams: object | undefined, isFocused: boolean) => void;
}) {
  const icon =
    item.descriptor.options.tabBarIcon?.({
      focused: isFocused,
      color: isFocused ? colors.androidTabShellActive : colors.androidTabShellInactive,
      size: metrics.tabIconSize,
    }) ?? null;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={item.accessibilityLabel}
      onLongPress={() => onLongPress(item.key)}
      onPress={() => onNavigate(item.key, item.routeName, item.params, isFocused)}
      style={({ pressed }) => [
        styles.tabButton,
        !isLast ? { marginRight: metrics.tabGap } : null,
        pressed ? styles.tabButtonPressed : null,
      ]}
    >
      <View
        style={[
          styles.tabInner,
          {
            minHeight: TAB_MIN_HEIGHT,
            paddingHorizontal: metrics.tabInnerPaddingHorizontal,
            paddingVertical: metrics.tabInnerPaddingVertical,
          },
        ]}
      >
        <View style={styles.iconWrap}>{icon}</View>
        {metrics.tabLabelVisible ? (
          <Text
            numberOfLines={1}
            style={[
              styles.tabLabel,
              {
                color: isFocused ? colors.androidTabShellActive : colors.androidTabShellInactive,
                fontSize: metrics.tabLabelFontSize,
              },
            ]}
          >
            {item.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const SearchFieldContent = memo(function SearchFieldContent({
  colors,
  inputAnimatedStyle,
  placeholder,
  placeholderAnimatedStyle,
  searchMorphActive,
  searchSelected,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  inputAnimatedStyle: any;
  placeholder: string;
  placeholderAnimatedStyle: any;
  searchMorphActive: boolean;
  searchSelected: boolean;
}) {
  const { t } = useTranslation();
  const query = useAndroidTabSearchQuery();
  const focusRequestId = useAndroidTabSearchFocusRequestId();
  const searchInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!searchSelected) {
      return;
    }

    const handle = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(handle);
  }, [focusRequestId, searchSelected]);

  return (
    <>
      {searchMorphActive && !searchSelected ? (
        <Animated.View pointerEvents="none" style={[styles.searchPreviewTextWrap, placeholderAnimatedStyle]}>
          <Text numberOfLines={1} style={[styles.searchPreviewText, { color: colors.androidTabShellInactive }]}>
            {placeholder}
          </Text>
        </Animated.View>
      ) : null}

      {searchSelected ? (
        <Animated.View style={[styles.searchInputWrap, inputAnimatedStyle]}>
          <TextInput
            ref={searchInputRef}
            accessibilityLabel={t('tabs.search', 'Search')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setAndroidTabSearchQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.androidTabShellInactive}
            returnKeyType="search"
            selectionColor={colors.androidTabShellActive}
            style={[styles.searchInput, { color: colors.androidTabShellActive }]}
            value={query}
          />
        </Animated.View>
      ) : null}
    </>
  );
});

export default function AndroidFloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isSavedNoteRevealActive } = useSavedNoteRevealUi();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [searchPreviewActive, setSearchPreviewActive] = useState(false);
  const [lastPrimaryRouteKey, setLastPrimaryRouteKey] = useState<string | null>(null);
  const searchNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorIndex = useSharedValue(state.index);
  const visibility = useSharedValue(1);
  const searchExpansion = useSharedValue(0);
  const activeRoute = state.routes[state.index];
  const searchSelected = activeRoute.name === 'search';
  const searchMorphActive = searchSelected || searchPreviewActive;
  const keyboardVisible = keyboardHeight > 0;
  const tabBarVisible =
    shouldDisplayTabBar(activeRoute) &&
    (!keyboardVisible || searchMorphActive) &&
    !isSavedNoteRevealActive;
  const primaryRoutes = useMemo(
    () => state.routes.filter((route) => route.name !== 'search'),
    [state.routes]
  );
  const searchRoute = useMemo(
    () => state.routes.find((route) => route.name === 'search') ?? null,
    [state.routes]
  );
  const activePrimaryIndex = useMemo(
    () => primaryRoutes.findIndex((route) => route.key === activeRoute.key),
    [activeRoute.key, primaryRoutes]
  );

  const responsiveMetrics = useMemo<ResponsiveMetrics>(() => {
    const isVeryNarrow = windowWidth < VERY_NARROW_SCREEN_WIDTH;
    const isCompact = windowWidth < COMPACT_SCREEN_WIDTH;
    const shellHorizontalInset = isVeryNarrow ? 12 : isCompact ? 14 : ANDROID_TAB_SHELL_HORIZONTAL_INSET;
    const searchBarGap = isVeryNarrow ? 6 : isCompact ? 7 : 8;
    const wrapperTopPadding = isVeryNarrow ? 4 : ANDROID_TAB_SHELL_TOP_PADDING;
    const barContentInset = isVeryNarrow ? 2 : BAR_CONTENT_INSET;
    const tabGap = isVeryNarrow ? 0 : TAB_GAP;
    const tabIconSize = isVeryNarrow ? 18 : 20;
    const searchIconSize = isVeryNarrow ? 20 : 22;
    const tabLabelVisible = !isVeryNarrow;
    const tabLabelFontSize = isCompact ? 9 : 10;
    const tabInnerPaddingHorizontal = isVeryNarrow ? 6 : isCompact ? 8 : 10;
    const tabInnerPaddingVertical = tabLabelVisible ? (isCompact ? 5 : 6) : 0;
    const searchButtonSize = TAB_MIN_HEIGHT + barContentInset * 2;
    const compactPrimaryButtonSize = searchButtonSize;
    const searchCollapsedTargetWidth = searchButtonSize;
    const searchExpandedMinWidth = isVeryNarrow ? 164 : isCompact ? 184 : 212;
    const searchHorizontalPadding = isVeryNarrow ? 12 : 14;
    const searchIconLeft = isVeryNarrow ? 14 : isCompact ? 15 : 16;
    const searchTextOffset = isVeryNarrow ? 30 : 34;
    const tabMinWidth = tabLabelVisible ? (isCompact ? 70 : 82) : 50;
    const keyboardAvoidanceGap = isVeryNarrow ? 8 : KEYBOARD_AVOIDANCE_GAP;

    return {
      barContentInset,
      compactPrimaryButtonSize,
      isCompact,
      keyboardAvoidanceGap,
      searchBarGap,
      searchButtonSize,
      searchCollapsedTargetWidth,
      searchExpandedMinWidth,
      searchHorizontalPadding,
      searchIconLeft,
      searchIconSize,
      searchTextOffset,
      shellHorizontalInset,
      tabGap,
      tabIconSize,
      tabInnerPaddingHorizontal,
      tabInnerPaddingVertical,
      tabLabelFontSize,
      tabLabelVisible,
      tabMinWidth,
      wrapperTopPadding,
    };
  }, [windowWidth]);

  const shellUsableWidth = Math.max(windowWidth - responsiveMetrics.shellHorizontalInset * 2, 0);
  const maximumPrimaryExpandedWidth = Math.max(
    shellUsableWidth - responsiveMetrics.searchBarGap - responsiveMetrics.searchButtonSize,
    responsiveMetrics.compactPrimaryButtonSize
  );
  const minimumPrimaryExpandedWidth = Math.min(
    responsiveMetrics.barContentInset * 2 +
      primaryRoutes.length * responsiveMetrics.tabMinWidth +
      Math.max(primaryRoutes.length - 1, 0) * responsiveMetrics.tabGap,
    maximumPrimaryExpandedWidth
  );
  const primaryBarExpandedWidth = clamp(
    shellUsableWidth - responsiveMetrics.searchBarGap - responsiveMetrics.searchCollapsedTargetWidth,
    minimumPrimaryExpandedWidth,
    maximumPrimaryExpandedWidth
  );
  const primaryBarCollapsedWidth = responsiveMetrics.compactPrimaryButtonSize;
  const searchCollapsedWidth = clamp(
    shellUsableWidth - responsiveMetrics.searchBarGap - primaryBarExpandedWidth,
    responsiveMetrics.searchButtonSize,
    Math.max(responsiveMetrics.searchCollapsedTargetWidth, responsiveMetrics.searchButtonSize)
  );
  const searchExpandedWidth = Math.max(
    shellUsableWidth - responsiveMetrics.searchBarGap - primaryBarCollapsedWidth,
    responsiveMetrics.searchExpandedMinWidth
  );
  const primaryRouteItems = useMemo<PrimaryRouteItem[]>(
    () =>
      primaryRoutes.map((route) => {
        const descriptor = descriptors[route.key];
        const label =
          typeof descriptor.options.tabBarLabel === 'string'
            ? descriptor.options.tabBarLabel
            : typeof descriptor.options.title === 'string'
              ? descriptor.options.title
              : route.name;
        const accessibilityLabel =
          descriptor.options.tabBarAccessibilityLabel ??
          descriptor.options.title ??
          label;

        return {
          accessibilityLabel,
          descriptor,
          key: route.key,
          label,
          params: route.params,
          routeName: route.name,
        };
      }),
    [descriptors, primaryRoutes]
  );
  const compactPrimaryItem = useMemo(
    () =>
      primaryRouteItems.find((route) => route.key === lastPrimaryRouteKey) ??
      primaryRouteItems[activePrimaryIndex >= 0 ? activePrimaryIndex : 0] ??
      null,
    [activePrimaryIndex, lastPrimaryRouteKey, primaryRouteItems]
  );
  const searchPlaceholder = responsiveMetrics.isCompact
    ? t('tabs.search', 'Search')
    : t('home.searchPlaceholder', 'Search your journal...');

  const tabWidth = useMemo(() => {
    if (primaryBarExpandedWidth <= 0 || primaryRoutes.length === 0) {
      return 0;
    }

    return Math.max(
      (primaryBarExpandedWidth -
        responsiveMetrics.barContentInset * 2 -
        responsiveMetrics.tabGap * (primaryRoutes.length - 1)) /
        primaryRoutes.length,
      0
    );
  }, [
    primaryBarExpandedWidth,
    primaryRoutes.length,
    responsiveMetrics.barContentInset,
    responsiveMetrics.tabGap,
  ]);

  useEffect(() => {
    indicatorIndex.value = withSpring(Math.max(activePrimaryIndex, 0), INDICATOR_SPRING);
  }, [activePrimaryIndex, indicatorIndex]);

  useEffect(() => {
    visibility.value = withTiming(tabBarVisible ? 1 : 0, {
      duration: tabBarVisible ? 220 : 160,
      easing: tabBarVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [tabBarVisible, visibility]);

  useEffect(() => {
    searchExpansion.value = withTiming(searchMorphActive ? 1 : 0, SEARCH_MORPH_ANIMATION);
  }, [searchExpansion, searchMorphActive]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (searchSelected) {
      setSearchPreviewActive(false);
    } else if (activeRoute.name !== 'search' && searchNavigationTimerRef.current == null) {
      setSearchPreviewActive(false);
    }
  }, [activeRoute.name, searchSelected]);

  useEffect(() => {
    if (activeRoute.name === 'search') {
      return;
    }

    const isPrimaryRoute = primaryRoutes.some((route) => route.key === activeRoute.key);
    if (isPrimaryRoute) {
      setLastPrimaryRouteKey(activeRoute.key);
    }
  }, [activeRoute.key, activeRoute.name, primaryRoutes]);

  useEffect(() => () => {
    if (searchNavigationTimerRef.current) {
      clearTimeout(searchNavigationTimerRef.current);
      searchNavigationTimerRef.current = null;
    }
  }, []);

  const wrapperAnimatedStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: (1 - visibility.value) * 28 }],
  }));

  const indicatorAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: tabWidth > 0 && activePrimaryIndex >= 0 && !searchMorphActive ? visibility.value : 0,
      width: tabWidth,
      transform: [{ translateX: indicatorIndex.value * (tabWidth + responsiveMetrics.tabGap) }],
    }),
    [activePrimaryIndex, searchMorphActive, responsiveMetrics.tabGap, tabWidth]
  );

  const primaryBarAnimatedStyle = useAnimatedStyle(
    () => ({
      width: interpolate(
        searchExpansion.value,
        [0, 1],
        [primaryBarExpandedWidth, primaryBarCollapsedWidth]
      ),
    }),
    [primaryBarCollapsedWidth, primaryBarExpandedWidth]
  );

  const primaryTabsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchExpansion.value, [0, 0.55, 1], [1, 0.18, 0]),
    transform: [{ scale: interpolate(searchExpansion.value, [0, 1], [1, 0.92]) }],
  }));

  const compactPrimaryAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchExpansion.value, [0, 0.4, 1], [0, 0.25, 1]),
    transform: [{ scale: interpolate(searchExpansion.value, [0, 1], [0.84, 1]) }],
  }));

  const searchAnimatedStyle = useAnimatedStyle(
    () => ({
      width: interpolate(searchExpansion.value, [0, 1], [searchCollapsedWidth, searchExpandedWidth]),
    }),
    [searchCollapsedWidth, searchExpandedWidth]
  );

  const searchInputAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchExpansion.value,
    transform: [{ translateX: interpolate(searchExpansion.value, [0, 1], [12, 0]) }],
  }));

  const searchPlaceholderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchExpansion.value,
    transform: [{ translateX: interpolate(searchExpansion.value, [0, 1], [12, 0]) }],
  }));

  const searchIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(searchExpansion.value, [0, 1], [1, 0.94]) },
      { translateX: interpolate(searchExpansion.value, [0, 1], [0, -1]) },
    ],
  }));

  const navigateToRoute = useCallback(
    (routeKey: string, routeName: string, routeParams: object | undefined, isFocused: boolean) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });

      if (!isFocused) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName, routeParams);
      }
    },
    [navigation]
  );

  const emitLongPress = useCallback(
    (routeKey: string) => {
      navigation.emit({
        type: 'tabLongPress',
        target: routeKey,
      });
    },
    [navigation]
  );

  const activateSearch = useCallback(() => {
    if (!searchRoute) {
      return;
    }

    if (searchSelected) {
      requestAndroidTabSearchFocus();
      return;
    }

    if (searchNavigationTimerRef.current) {
      clearTimeout(searchNavigationTimerRef.current);
    }

    setSearchPreviewActive(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    searchNavigationTimerRef.current = setTimeout(() => {
      searchNavigationTimerRef.current = null;
      navigation.navigate(searchRoute.name, searchRoute.params);
      requestAndroidTabSearchFocus();
    }, SEARCH_NAVIGATION_DELAY_MS);
  }, [navigation, searchRoute, searchSelected]);

  return (
    <Animated.View
      pointerEvents={tabBarVisible ? 'auto' : 'none'}
      style={[
        styles.wrapper,
        wrapperAnimatedStyle,
        {
          bottom:
            keyboardVisible && searchMorphActive
              ? keyboardHeight +
                Math.max(insets.bottom, ANDROID_TAB_SHELL_MIN_SAFE_AREA) +
                ANDROID_TAB_SHELL_BOTTOM_OFFSET +
                responsiveMetrics.keyboardAvoidanceGap
              : Math.max(insets.bottom, ANDROID_TAB_SHELL_MIN_SAFE_AREA) + ANDROID_TAB_SHELL_BOTTOM_OFFSET,
          paddingHorizontal: responsiveMetrics.shellHorizontalInset,
          paddingTop: responsiveMetrics.wrapperTopPadding,
        },
      ]}
    >
      <View style={[styles.shellRow, { gap: responsiveMetrics.searchBarGap }]}>
        <Animated.View
          style={[
            styles.bar,
            primaryBarAnimatedStyle,
            {
              backgroundColor: colors.androidTabShellBackground,
              borderColor: colors.androidTabShellBorder,
              padding: responsiveMetrics.barContentInset,
              shadowColor: colors.androidTabShellShadow,
            },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={
              isDark
                ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)']
                : ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)']
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeCapsule,
              indicatorAnimatedStyle,
              {
                backgroundColor: colors.androidTabShellSelectedBackground,
                borderColor: colors.androidTabShellSelectedBorder,
                bottom: responsiveMetrics.barContentInset,
                left: responsiveMetrics.barContentInset,
                top: responsiveMetrics.barContentInset,
              },
            ]}
          >
            <LinearGradient
              colors={colors.androidTabShellSelectedGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.barContent}>
            <Animated.View
              pointerEvents={searchMorphActive ? 'none' : 'auto'}
              style={[styles.primaryTabsRow, primaryTabsAnimatedStyle]}
            >
              {primaryRouteItems.map((route, index) => (
                <PrimaryRouteButton
                  key={route.key}
                  colors={colors}
                  isFocused={activeRoute.key === route.key}
                  isLast={index === primaryRouteItems.length - 1}
                  item={route}
                  metrics={responsiveMetrics}
                  onLongPress={emitLongPress}
                  onNavigate={navigateToRoute}
                />
              ))}
            </Animated.View>

            {compactPrimaryItem ? (
              <Animated.View
                pointerEvents={searchMorphActive ? 'auto' : 'none'}
                style={[styles.compactPrimaryWrap, compactPrimaryAnimatedStyle]}
              >
                <CompactPrimaryButton
                  activeRouteKey={activeRoute.key}
                  colors={colors}
                  item={compactPrimaryItem}
                  metrics={responsiveMetrics}
                  onLongPress={emitLongPress}
                  onNavigate={navigateToRoute}
                />
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>

        {searchRoute ? (
          <Animated.View style={searchAnimatedStyle}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={searchSelected ? { selected: true } : {}}
              accessibilityLabel={descriptors[searchRoute.key].options.tabBarAccessibilityLabel ?? 'Search'}
              onLongPress={() => emitLongPress(searchRoute.key)}
              onPress={activateSearch}
              style={({ pressed }) => [
                styles.searchButton,
                {
                  backgroundColor: searchSelected
                    ? colors.androidTabShellSelectedBackground
                    : colors.androidTabShellBackground,
                  borderColor: searchSelected
                    ? colors.androidTabShellSelectedBorder
                    : colors.androidTabShellBorder,
                  height: responsiveMetrics.searchButtonSize,
                  paddingHorizontal: responsiveMetrics.searchHorizontalPadding,
                  shadowColor: colors.androidTabShellShadow,
                },
                pressed ? styles.tabButtonPressed : null,
              ]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={
                  isDark
                    ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)']
                    : ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)']
                }
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {searchSelected ? (
                <LinearGradient
                  colors={colors.androidTabShellSelectedGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}

              <Animated.View
                style={[
                  styles.searchIconWrap,
                  searchIconAnimatedStyle,
                  searchMorphActive ? { left: responsiveMetrics.searchIconLeft } : styles.searchIconCentered,
                ]}
              >
                {descriptors[searchRoute.key].options.tabBarIcon?.({
                  focused: searchSelected,
                  color: searchSelected
                    ? colors.androidTabShellActive
                    : colors.androidTabShellInactive,
                  size: responsiveMetrics.searchIconSize,
                })}
              </Animated.View>

              <SearchFieldContent
                colors={colors}
                inputAnimatedStyle={[searchInputAnimatedStyle, { marginLeft: responsiveMetrics.searchTextOffset }]}
                placeholder={searchPlaceholder}
                placeholderAnimatedStyle={[
                  searchPlaceholderAnimatedStyle,
                  { marginLeft: responsiveMetrics.searchTextOffset, marginRight: responsiveMetrics.searchHorizontalPadding },
                ]}
                searchMorphActive={searchMorphActive}
                searchSelected={searchSelected}
              />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 30,
  },
  shellRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  bar: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  barContent: {
    justifyContent: 'center',
    minHeight: TAB_MIN_HEIGHT,
  },
  primaryTabsRow: {
    flexDirection: 'row',
  },
  compactPrimaryWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  activeCapsule: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
  },
  compactPrimaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
  },
  tabButton: {
    flex: 1,
    minHeight: TAB_MIN_HEIGHT,
    zIndex: 1,
  },
  tabButtonPressed: {
    opacity: 0.84,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  searchIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 1,
  },
  searchIconCentered: {
    left: 0,
    right: 0,
  },
  searchPreviewTextWrap: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  searchPreviewText: {
    fontFamily: 'Noto Sans',
    fontSize: 14,
    fontWeight: '600',
  },
  searchInputWrap: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  searchInput: {
    fontFamily: 'Noto Sans',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    textAlign: 'left',
    width: '100%',
  },
});
