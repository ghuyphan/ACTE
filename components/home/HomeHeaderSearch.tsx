import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  colors: {
    text: string;
    primary: string;
    secondaryText: string;
  };
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
  colors,
  t,
}: HomeHeaderSearchProps) {
  const modeIconScale = useRef(new Animated.Value(1)).current;
  const modeIconRotate = useRef(new Animated.Value(0)).current;
  const didMountRef = useRef(false);

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

  return (
    <GlassHeader topInset={topInset}>
      <Animated.View
        pointerEvents={isSearching ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          styles.defaultHeader,
          {
            opacity: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.logoText, { color: colors.text }]}>ACTE 💛</Text>
        <View style={styles.headerActions}>
          {showSearchButton ? (
            <Pressable onPress={onOpenSearch}>
              <Ionicons name="search" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
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
                name={captureMode === 'text' ? 'camera-outline' : 'document-text-outline'}
                size={20}
                color={colors.primary}
              />
            </Animated.View>
          </Pressable>
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
  );
}

const styles = StyleSheet.create({
  defaultHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
