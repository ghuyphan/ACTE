import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { Shadows } from '../../constants/theme';
import {
  requestAndroidTabSearchFocus,
  setAndroidTabSearchQuery,
  useAndroidTabSearchState,
} from '../../hooks/useAndroidTabSearchState';
import {
  ANDROID_TAB_SHELL_BOTTOM_OFFSET,
  ANDROID_TAB_SHELL_GAP,
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
const SHELL_GAP = ANDROID_TAB_SHELL_GAP;
const TAB_MIN_HEIGHT = ANDROID_TAB_SHELL_HEIGHT;
const SEARCH_BUTTON_SIZE = ANDROID_TAB_SHELL_HEIGHT;
const COMPACT_PRIMARY_BUTTON_SIZE = ANDROID_TAB_SHELL_HEIGHT;
const ACTIVE_ANIMATION = {
  duration: 260,
  easing: Easing.out(Easing.cubic),
} as const;
const SEARCH_NAVIGATION_DELAY_MS = 170;
const KEYBOARD_AVOIDANCE_GAP = 22;

function shouldDisplayTabBar(route: BottomTabBarProps['state']['routes'][number]) {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  return focusedRouteName == null || focusedRouteName === 'index';
}

export default function AndroidFloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [searchPreviewActive, setSearchPreviewActive] = useState(false);
  const [lastPrimaryRouteKey, setLastPrimaryRouteKey] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorIndex = useSharedValue(state.index);
  const visibility = useSharedValue(1);
  const searchExpansion = useSharedValue(0);
  const activeRoute = state.routes[state.index];
  const searchSelected = activeRoute.name === 'search';
  const searchMorphActive = searchSelected || searchPreviewActive;
  const keyboardVisible = keyboardHeight > 0;
  const tabBarVisible = shouldDisplayTabBar(activeRoute) && (!keyboardVisible || searchMorphActive);
  const { query, focusRequestId } = useAndroidTabSearchState();
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
  const shellUsableWidth = Math.max(windowWidth - ANDROID_TAB_SHELL_HORIZONTAL_INSET * 2, 0);
  const primaryBarExpandedWidth = Math.max(
    shellUsableWidth - SHELL_GAP - SEARCH_BUTTON_SIZE,
    COMPACT_PRIMARY_BUTTON_SIZE
  );
  const primaryBarCollapsedWidth = COMPACT_PRIMARY_BUTTON_SIZE;
  const searchExpandedWidth = Math.max(
    shellUsableWidth - SHELL_GAP - primaryBarCollapsedWidth,
    SEARCH_BUTTON_SIZE
  );
  const compactPrimaryRoute = useMemo(
    () =>
      primaryRoutes.find((route) => route.key === lastPrimaryRouteKey) ??
      primaryRoutes[activePrimaryIndex >= 0 ? activePrimaryIndex : 0] ??
      null,
    [activePrimaryIndex, lastPrimaryRouteKey, primaryRoutes]
  );

  const tabWidth = useMemo(() => {
    if (primaryBarExpandedWidth <= 0 || primaryRoutes.length === 0) {
      return 0;
    }

    return Math.max(
      (primaryBarExpandedWidth - BAR_CONTENT_INSET * 2 - TAB_GAP * (primaryRoutes.length - 1)) /
        primaryRoutes.length,
      0
    );
  }, [primaryBarExpandedWidth, primaryRoutes.length]);

  useEffect(() => {
    indicatorIndex.value = withTiming(Math.max(activePrimaryIndex, 0), ACTIVE_ANIMATION);
  }, [activePrimaryIndex, indicatorIndex]);

  useEffect(() => {
    visibility.value = withTiming(tabBarVisible ? 1 : 0, {
      duration: tabBarVisible ? 220 : 160,
      easing: tabBarVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [tabBarVisible, visibility]);

  useEffect(() => {
    searchExpansion.value = withTiming(searchMorphActive ? 1 : 0, ACTIVE_ANIMATION);
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

  useEffect(() => {
    if (!searchSelected) {
      return;
    }

    const handle = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(handle);
  }, [focusRequestId, searchSelected]);

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

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tabWidth > 0 && activePrimaryIndex >= 0 && !searchMorphActive ? visibility.value : 0,
    width: tabWidth,
    transform: [{ translateX: indicatorIndex.value * (tabWidth + TAB_GAP) }],
  }), [activePrimaryIndex, searchMorphActive, tabWidth]);

  const primaryBarAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      searchExpansion.value,
      [0, 1],
      [primaryBarExpandedWidth, primaryBarCollapsedWidth]
    ),
  }), [primaryBarCollapsedWidth, primaryBarExpandedWidth]);

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(searchExpansion.value, [0, 1], [SEARCH_BUTTON_SIZE, searchExpandedWidth]),
  }), [searchExpandedWidth]);

  const searchInputAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchExpansion.value,
    transform: [{ translateX: interpolate(searchExpansion.value, [0, 1], [10, 0]) }],
  }));

  const searchIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(searchExpansion.value, [0, 1], [1, 0.92]) }],
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
                KEYBOARD_AVOIDANCE_GAP
              : Math.max(insets.bottom, ANDROID_TAB_SHELL_MIN_SAFE_AREA) + ANDROID_TAB_SHELL_BOTTOM_OFFSET,
        },
      ]}
    >
      <View style={styles.shellRow}>
        <Animated.View
          style={[
            styles.bar,
            primaryBarAnimatedStyle,
            {
              backgroundColor: colors.androidTabShellBackground,
              borderColor: colors.androidTabShellBorder,
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

          {searchMorphActive && compactPrimaryRoute
            ? (() => {
                const descriptor = descriptors[compactPrimaryRoute.key];
                const label =
                  typeof descriptor.options.tabBarLabel === 'string'
                    ? descriptor.options.tabBarLabel
                    : typeof descriptor.options.title === 'string'
                      ? descriptor.options.title
                      : compactPrimaryRoute.name;
                const accessibilityLabel =
                  descriptor.options.tabBarAccessibilityLabel ??
                  descriptor.options.title ??
                  label;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    onLongPress={() => emitLongPress(compactPrimaryRoute.key)}
                    onPress={() =>
                      navigateToRoute(
                        compactPrimaryRoute.key,
                        compactPrimaryRoute.name,
                        compactPrimaryRoute.params,
                        activeRoute.key === compactPrimaryRoute.key
                      )
                    }
                    style={({ pressed }) => [
                      styles.compactPrimaryButton,
                      pressed ? styles.tabButtonPressed : null,
                    ]}
                  >
                    {descriptor.options.tabBarIcon?.({
                      focused: true,
                      color: colors.androidTabShellActive,
                      size: 22,
                    })}
                  </Pressable>
                );
              })()
            : primaryRoutes.map((route, index) => {
                const descriptor = descriptors[route.key];
                const isFocused = activeRoute.key === route.key;
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
                const icon =
                  descriptor.options.tabBarIcon?.({
                    focused: isFocused,
                    color: isFocused
                      ? colors.androidTabShellActive
                      : colors.androidTabShellInactive,
                    size: 20,
                  }) ?? null;

                return (
                  <Pressable
                    key={route.key}
                    accessibilityRole="tab"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={accessibilityLabel}
                    onLongPress={() => emitLongPress(route.key)}
                    onPress={() => navigateToRoute(route.key, route.name, route.params, isFocused)}
                    style={({ pressed }) => [
                      styles.tabButton,
                      index < primaryRoutes.length - 1 ? styles.tabGap : null,
                      pressed ? styles.tabButtonPressed : null,
                    ]}
                  >
                    <View style={styles.tabInner}>
                      <View style={styles.iconWrap}>{icon}</View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.tabLabel,
                          {
                            color: isFocused
                              ? colors.androidTabShellActive
                              : colors.androidTabShellInactive,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
        </Animated.View>

        {searchRoute ? (
          <Animated.View
            style={[
              searchAnimatedStyle,
            ]}
          >
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
              <Animated.View style={[styles.searchIconWrap, searchIconAnimatedStyle]}>
                {descriptors[searchRoute.key].options.tabBarIcon?.({
                  focused: searchSelected,
                  color: searchSelected
                    ? colors.androidTabShellActive
                    : colors.androidTabShellInactive,
                  size: 22,
                })}
              </Animated.View>
              {searchSelected ? (
                <Animated.View style={[styles.searchInputWrap, searchInputAnimatedStyle]}>
                  <TextInput
                    ref={searchInputRef}
                    accessibilityLabel={t('tabs.search', 'Search')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setAndroidTabSearchQuery}
                    placeholder={t('home.searchPlaceholder', 'Search your journal...')}
                    placeholderTextColor={colors.androidTabShellInactive}
                    returnKeyType="search"
                    selectionColor={colors.androidTabShellActive}
                    style={[styles.searchInput, { color: colors.androidTabShellActive }]}
                    value={query}
                  />
                </Animated.View>
              ) : null}
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
    paddingHorizontal: ANDROID_TAB_SHELL_HORIZONTAL_INSET,
    paddingTop: ANDROID_TAB_SHELL_TOP_PADDING,
    position: 'absolute',
    right: 0,
    zIndex: 30,
  },
  shellRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SHELL_GAP,
  },
  bar: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: BAR_CONTENT_INSET,
    ...Shadows.androidChrome,
  },
  activeCapsule: {
    borderRadius: 999,
    borderWidth: 1,
    bottom: BAR_CONTENT_INSET,
    left: BAR_CONTENT_INSET,
    overflow: 'hidden',
    position: 'absolute',
    top: BAR_CONTENT_INSET,
  },
  compactPrimaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: COMPACT_PRIMARY_BUTTON_SIZE - BAR_CONTENT_INSET * 2,
    justifyContent: 'center',
    width: COMPACT_PRIMARY_BUTTON_SIZE - BAR_CONTENT_INSET * 2,
  },
  tabButton: {
    flex: 1,
    minHeight: TAB_MIN_HEIGHT,
    zIndex: 1,
  },
  tabButtonPressed: {
    opacity: 0.9,
  },
  tabGap: {
    marginRight: TAB_GAP,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TAB_MIN_HEIGHT,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iconWrap: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontFamily: 'Noto Sans',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: SEARCH_BUTTON_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 14,
    ...Shadows.androidChrome,
  },
  searchIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    zIndex: 1,
  },
  searchInputWrap: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    marginLeft: 34,
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
