import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  HStack,
  Host,
  Image as SwiftUIImage,
  Menu,
  Text as SwiftUIText,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  backgroundOverlay,
  buttonStyle,
  cornerRadius,
  font,
  foregroundStyle,
  glassEffect,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import AppSheet from "../sheets/AppSheet";
import AppSheetScaffold from "../sheets/AppSheetScaffold";
import { TFunction } from "i18next";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Sheet } from "../../constants/theme";
import { isIOS26OrNewer } from "../../utils/platform";
import type { NotesRouteTransitionRect } from "../../utils/notesRouteTransition";
import GlassHeader from "../ui/GlassHeader";

const HEADER_BUTTON_HIT_SLOP = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
} as const;
const HEADER_BUTTON_PRESS_RETENTION_OFFSET = {
  top: 14,
  right: 14,
  bottom: 14,
  left: 14,
} as const;

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
  sharedButtonMode?: "manage" | "filter";
  sharedButtonActive?: boolean;
  sharedFilterValue?: "all" | "friends";
  onChangeSharedFilter?: (nextFilter: "all" | "friends") => void;
  hasFriendsForFilter?: boolean;
  onToggleCaptureMode: () => void;
  captureMode: "text" | "camera";
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
  sharedButtonMode = "manage",
  sharedButtonActive = false,
  sharedFilterValue = "all",
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
  const [showAndroidSharedMenuSheet, setShowAndroidSharedMenuSheet] =
    useState(false);
  const isAndroid = Platform.OS === "android";
  const useDockedHeader =
    Platform.OS === "android" || (Platform.OS === "ios" && !isIOS26OrNewer);
  const useNativeLiquidGlassControls = Platform.OS === "ios" && isIOS26OrNewer;
  const neutralHeaderControlForegroundColor = isDark
    ? "#FFF7E8"
    : colors.secondaryText;
  const androidHeaderControlBackgroundColor = isDark
    ? "rgba(24,20,18,0.68)"
    : "rgba(255,251,246,0.88)";
  const androidHeaderControlBorderColor =
    colors.border ??
    (isDark ? "rgba(255,255,255,0.12)" : "rgba(113,86,26,0.18)");
  const androidHeaderControlForegroundColor =
    neutralHeaderControlForegroundColor;
  const androidHeaderSearchBackgroundColor = isDark
    ? "rgba(255,247,232,0.22)"
    : "rgba(255,255,255,0.88)";
  const activeHeaderControlBackgroundColor = isDark
    ? "rgba(255,247,232,0.14)"
    : "rgba(109,95,74,0.10)";
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
    transform: [
      { translateY: interpolate(searchAnim.value, [0, 1], [0, -10]) },
    ],
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

  const getHeaderControlMetrics = (size: "regular" | "large" = "regular") => ({
    verticalPadding: size === "large" ? 11 : 9,
    horizontalPadding: size === "large" ? 12 : 10,
    iconOnlyPadding: size === "large" ? 14 : 11,
    iconSize: size === "large" ? 18 : 16,
    textSize: size === "large" ? 13 : 12,
  });

  const headerControlBackgroundColor = isDark
    ? "rgba(255,255,255,0.94)"
    : "rgba(255,255,255,0.88)";
  const headerControlForegroundColor = neutralHeaderControlForegroundColor;
  const searchFieldBackgroundColor = isAndroid
    ? androidHeaderSearchBackgroundColor
    : headerControlBackgroundColor;
  const searchFieldBorderColor = isAndroid
    ? androidHeaderControlBorderColor
    : isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(113,86,26,0.10)";

  const getControlColors = (emphasized = false) => ({
    backgroundColor: emphasized
      ? activeHeaderControlBackgroundColor
      : headerControlBackgroundColor,
    foregroundColor: headerControlForegroundColor,
  });

  const getHeaderControlModifiers = (label: string) => {
    const modifiers = [buttonStyle("plain"), accessibilityLabel(label)];

    if (!useNativeLiquidGlassControls) {
      modifiers.push(tint(headerControlForegroundColor));
    }

    return modifiers;
  };

  const renderHeaderControlLabel = (
    systemName: ComponentProps<typeof SwiftUIImage>["systemName"],
    label: string,
    size: "regular" | "large" = "regular",
    options?: {
      iconOnly?: boolean;
      emphasized?: boolean;
    }
  ) => {
    const metrics = getHeaderControlMetrics(size);
    const isIconOnly = options?.iconOnly ?? false;
    const { backgroundColor, foregroundColor } = getControlColors(
      options?.emphasized
    );

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
            ? !options?.emphasized
              ? [
                  glassEffect({
                    glass: {
                      variant: "regular",
                      interactive: true,
                    },
                    shape: isIconOnly ? "circle" : "capsule",
                  }),
                ]
              : [
                  backgroundOverlay({ color: backgroundColor }),
                  cornerRadius(999),
                ]
            : [
                backgroundOverlay({ color: backgroundColor }),
                cornerRadius(999),
              ]),
        ]}
      >
        <SwiftUIImage
          systemName={systemName}
          color={foregroundColor}
          size={metrics.iconSize}
        />
        {!isIconOnly ? (
          <SwiftUIText
            modifiers={[
              font({ size: metrics.textSize, weight: "semibold" }),
              foregroundStyle(foregroundColor),
            ]}
          >
            {label}
          </SwiftUIText>
        ) : null}
      </HStack>
    );
  };

  const renderTextControlLabel = (
    label: string,
    size: "regular" | "large" = "regular",
    options?: {
      systemName?: ComponentProps<typeof SwiftUIImage>["systemName"];
      emphasized?: boolean;
    }
  ) => {
    const metrics = getHeaderControlMetrics(size);
    const { backgroundColor, foregroundColor } = getControlColors(
      options?.emphasized
    );

    return (
      <HStack
        spacing={6}
        alignment="center"
        modifiers={[
          padding({
            top: metrics.verticalPadding,
            bottom: metrics.verticalPadding,
            leading: metrics.horizontalPadding + 2,
            trailing: metrics.horizontalPadding + 2,
          }),
          ...(useNativeLiquidGlassControls
            ? !options?.emphasized
              ? [
                  glassEffect({
                    glass: {
                      variant: "regular",
                      interactive: true,
                    },
                    shape: "capsule",
                  }),
                ]
              : [
                  backgroundOverlay({ color: backgroundColor }),
                  cornerRadius(999),
                ]
            : [
                backgroundOverlay({ color: backgroundColor }),
                cornerRadius(999),
              ]),
        ]}
      >
        {options?.systemName ? (
          <SwiftUIImage
            systemName={options.systemName}
            color={foregroundColor}
            size={metrics.iconSize - 1}
          />
        ) : null}
        <SwiftUIText
          modifiers={[
            font({ size: metrics.textSize, weight: "semibold" }),
            foregroundStyle(foregroundColor),
          ]}
        >
          {label}
        </SwiftUIText>
      </HStack>
    );
  };

  const renderSearchButton = () => {
    if (!showSearchButton) {
      return null;
    }

    const searchLabel = t("home.searchPlaceholder", "Search notes...");

    if (Platform.OS === "android") {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchLabel}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          onPress={onOpenSearch}
          pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          style={({ pressed }) => [
            styles.iconButton,
            styles.androidHeaderActionButton,
            {
              backgroundColor: androidHeaderControlBackgroundColor,
              borderColor: androidHeaderControlBorderColor,
            },
            pressed ? styles.headerButtonPressed : null,
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={androidHeaderControlForegroundColor}
          />
        </Pressable>
      );
    }

    return (
      <Host
        matchContents
        colorScheme={isDark ? "dark" : "light"}
        style={styles.swiftHeaderControlHost}
      >
        <Button
          onPress={onOpenSearch}
          modifiers={getHeaderControlModifiers(searchLabel)}
        >
          {renderHeaderControlLabel("magnifyingglass", searchLabel, "regular", {
            iconOnly: true,
          })}
        </Button>
      </Host>
    );
  };

  const renderModeToggle = (size: "regular" | "large" = "regular") => {
    const modeLabel =
      captureMode === "text"
        ? t("capture.switchCamera", "Camera")
        : t("capture.switchText", "Text");
    const systemName = captureMode === "text" ? "camera" : "square.and.pencil";

    if (Platform.OS === "ios") {
      return (
        <Host
          matchContents
          colorScheme={isDark ? "dark" : "light"}
          style={styles.swiftHeaderControlHost}
        >
          <Button
            onPress={onToggleCaptureMode}
            modifiers={getHeaderControlModifiers(modeLabel)}
          >
            {renderHeaderControlLabel(systemName, modeLabel, size, {
              iconOnly: true,
            })}
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
        style={({ pressed }) => [
          styles.iconButton,
          styles.androidHeaderActionButton,
          {
            backgroundColor: androidHeaderControlBackgroundColor,
            borderColor: androidHeaderControlBorderColor,
          },
          pressed ? styles.headerButtonPressed : null,
        ]}
      >
        <Animated.View style={modeIconAnimatedStyle}>
          <Ionicons
            name={captureMode === "text" ? "camera-outline" : "create-outline"}
            size={20}
            color={androidHeaderControlForegroundColor}
          />
        </Animated.View>
      </Pressable>
    );
  };

  const renderSharedButton = (size: "regular" | "large" = "regular") => {
    if (!showSharedButton || !onOpenShared) {
      return null;
    }

    const manageLabel = t("shared.manageTitle", "Friends");
    const isSharedFilterControl =
      sharedButtonMode === "filter" && hasFriendsForFilter;
    const filterStateLabel =
      sharedFilterValue === "friends"
        ? t("home.feedFilterFriends", "Friends")
        : t("home.feedFilterAll", "All");
    const sharedVisibleLabel = isSharedFilterControl
      ? filterStateLabel
      : manageLabel;
    const sharedA11yLabel = sharedVisibleLabel;
    const canShowFilterMenu =
      isSharedFilterControl && Boolean(onChangeSharedFilter);
    const isEmphasized = sharedButtonActive && isSharedFilterControl;
    const sharedSystemName = isSharedFilterControl
      ? "line.3.horizontal.decrease"
      : "person.2";
    const sharedAndroidIconName = isSharedFilterControl
      ? "funnel-outline"
      : "people-outline";

    if (Platform.OS === "ios") {
      const controlLabel = renderTextControlLabel(sharedVisibleLabel, size, {
        systemName: sharedSystemName,
        emphasized: isEmphasized,
      });

      if (canShowFilterMenu) {
        return (
          <View style={styles.sharedButtonContainer}>
            <Host
              matchContents
              colorScheme={isDark ? "dark" : "light"}
              style={styles.swiftHeaderControlHost}
            >
              <Menu
                label={controlLabel}
                modifiers={getHeaderControlModifiers(sharedA11yLabel)}
              >
                <Button
                  label={t("home.feedFilterAll", "All")}
                  systemImage={
                    sharedFilterValue === "all" ? "checkmark" : undefined
                  }
                  onPress={() => onChangeSharedFilter?.("all")}
                />
                <Button
                  label={t("home.feedFilterFriends", "Friends")}
                  systemImage={
                    sharedFilterValue === "friends" ? "checkmark" : undefined
                  }
                  onPress={() => onChangeSharedFilter?.("friends")}
                />
                <Button
                  label={manageLabel}
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
            colorScheme={isDark ? "dark" : "light"}
            style={styles.swiftHeaderControlHost}
          >
            <Button
              onPress={onOpenShared}
              modifiers={getHeaderControlModifiers(sharedA11yLabel)}
            >
              {controlLabel}
            </Button>
          </Host>
        </View>
      );
    }

    if (canShowFilterMenu) {
      return (
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
          style={({ pressed }) => [
            styles.textButton,
            styles.androidHeaderActionButton,
            isEmphasized
              ? {
                  backgroundColor: activeHeaderControlBackgroundColor,
                  borderColor: androidHeaderControlBorderColor,
                }
              : {
                  backgroundColor: androidHeaderControlBackgroundColor,
                  borderColor: androidHeaderControlBorderColor,
                },
            pressed ? styles.headerButtonPressed : null,
          ]}
        >
          <View style={styles.textButtonContent}>
            <Ionicons
              name={sharedAndroidIconName}
              size={16}
              color={androidHeaderControlForegroundColor}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.textButtonLabel,
                { color: androidHeaderControlForegroundColor },
              ]}
            >
              {sharedVisibleLabel}
            </Text>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sharedA11yLabel}
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        onPress={onOpenShared}
        pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
        style={({ pressed }) => [
          styles.textButton,
          styles.androidHeaderActionButton,
          isEmphasized
            ? {
                backgroundColor: activeHeaderControlBackgroundColor,
                borderColor: androidHeaderControlBorderColor,
              }
            : {
                backgroundColor: androidHeaderControlBackgroundColor,
                borderColor: androidHeaderControlBorderColor,
              },
          pressed ? styles.headerButtonPressed : null,
        ]}
      >
        <View style={styles.textButtonContent}>
          <Ionicons
            name={sharedAndroidIconName}
            size={16}
            color={androidHeaderControlForegroundColor}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.textButtonLabel,
              { color: androidHeaderControlForegroundColor },
            ]}
          >
            {sharedVisibleLabel}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderNotesButton = (size: "regular" | "large" = "regular") => {
    if (!showNotesButton || !onOpenNotes) {
      return null;
    }

    const notesLabel = t("notes.recap.allLabel", "All");
    const notesA11yLabel = t("notes.viewAllButton", "View all notes");

    if (Platform.OS === "ios") {
      return (
        <View ref={notesButtonRef} collapsable={false}>
          <Host
            matchContents
            colorScheme={isDark ? "dark" : "light"}
            style={styles.swiftHeaderControlHost}
          >
            <Button
              onPress={handleOpenNotesPress}
              modifiers={getHeaderControlModifiers(notesA11yLabel)}
            >
              {renderHeaderControlLabel("square.grid.2x2", notesLabel, size, {
                iconOnly: true,
              })}
            </Button>
          </Host>
        </View>
      );
    }

    return (
      <View ref={notesButtonRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notesA11yLabel}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          onPress={handleOpenNotesPress}
          pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
          style={({ pressed }) => [
            styles.iconButton,
            styles.androidHeaderActionButton,
            {
              backgroundColor: androidHeaderControlBackgroundColor,
              borderColor: androidHeaderControlBorderColor,
            },
            pressed ? styles.headerButtonPressed : null,
          ]}
        >
          <Ionicons
            name="grid-outline"
            size={20}
            color={androidHeaderControlForegroundColor}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <GlassHeader
        topInset={topInset}
        docked={useDockedHeader}
        dockedBlurred={showDockedBlur}
      >
        <Animated.View
          pointerEvents={isSearching ? "none" : "auto"}
          style={[
            StyleSheet.absoluteFill,
            styles.defaultHeader,
            defaultHeaderAnimatedStyle,
          ]}
        >
          <View style={[styles.headerSlot, styles.headerSlotLeft]}>
            <View style={styles.headerSlotGroup}>
              {renderNotesButton()}
              {showSearchButton ? renderSearchButton() : null}
            </View>
          </View>
          <View style={[styles.headerSlot, styles.headerSlotCenter]}>
            {renderSharedButton()}
          </View>
          <View style={[styles.headerSlot, styles.headerSlotRight]}>
            {renderModeToggle()}
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={isSearching ? "auto" : "none"}
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
                placeholder={t("home.searchPlaceholder", "Search notes...")}
                placeholderTextColor={colors.secondaryText}
                value={searchQuery}
                onChangeText={onSearchChange}
                autoFocus={isSearching}
                returnKeyType="search"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close", "Close")}
              hitSlop={HEADER_BUTTON_HIT_SLOP}
              onPress={onCloseSearch}
              pressRetentionOffset={HEADER_BUTTON_PRESS_RETENTION_OFFSET}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.secondaryText}
              />
            </Pressable>
          </View>
        </Animated.View>
      </GlassHeader>

      {Platform.OS === "android" &&
      sharedButtonMode === "filter" &&
      onChangeSharedFilter &&
      hasFriendsForFilter ? (
        <AppSheet
          visible={showAndroidSharedMenuSheet}
          onClose={() => setShowAndroidSharedMenuSheet(false)}
          topInset={topInset}
        >
          <AppSheetScaffold
            headerVariant="standard"
            title={t("shared.manageTitle", "Friends")}
            subtitle={t(
              "home.feedFilterHint",
              "Choose what kind of posts you want to see in Home."
            )}
            contentContainerStyle={styles.sharedFilterSheet}
            useHorizontalPadding={false}
          >
            <View>
              {(["all", "friends"] as const).map((option, index) => {
                const isSelected = sharedFilterValue === option;
                const label =
                  option === "all"
                    ? t("home.feedFilterAll", "All")
                    : t("home.feedFilterFriends", "Friends");

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
                        isSelected
                          ? { backgroundColor: `${colors.primary}12` }
                          : null,
                        pressed ? styles.sharedFilterRowPressed : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sharedFilterLabel,
                          { color: colors.text },
                        ]}
                      >
                        {label}
                      </Text>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.primary}
                        />
                      ) : null}
                    </Pressable>
                    {index === 0 ? (
                      <View
                        style={[
                          styles.sharedFilterDivider,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
              <View
                style={[
                  styles.sharedFilterDivider,
                  { backgroundColor: colors.border },
                ]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShowAndroidSharedMenuSheet(false);
                onOpenShared?.();
              }}
              style={({ pressed }) => [
                styles.sharedManageRow,
                pressed ? styles.sharedManageRowPressed : null,
              ]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={colors.primary}
              />
              <Text
                style={[styles.sharedManageLabel, { color: colors.primary }]}
              >
                {t("shared.manageTitle", "Friends")}
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
    flexDirection: "row",
    alignItems: "center",
  },
  headerSlot: {
    flex: 1,
    alignItems: "center",
  },
  headerSlotLeft: {
    alignItems: "flex-start",
  },
  headerSlotCenter: {
    justifyContent: "center",
  },
  headerSlotRight: {
    alignItems: "flex-end",
  },
  headerSlotGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  androidHeaderActionButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  swiftHeaderControlHost: {
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  sharedButtonContainer: {
    position: "relative",
  },
  searchHeader: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  searchContainer: {
    flex: 1,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
  },
  searchInput: {
    height: "100%",
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 0,
    width: "100%",
    fontFamily: "Noto Sans",
  },
  textButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    maxWidth: 156,
  },
  textButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  headerButtonPressed: {
    opacity: 0.82,
  },
  textButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Noto Sans",
    flexShrink: 1,
  },
  sharedFilterSheet: {
    gap: 12,
    paddingBottom:
      Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
  },
  sharedFilterRow: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sharedFilterRowPressed: {
    opacity: 0.9,
  },
  sharedFilterLabel: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Noto Sans",
  },
  sharedFilterDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
  sharedManageRow: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  sharedManageRowPressed: {
    opacity: 0.9,
  },
  sharedManageLabel: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Noto Sans",
  },
});
