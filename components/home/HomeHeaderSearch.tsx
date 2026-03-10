import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
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
  onToggleCaptureMode,
  captureMode,
  colors,
  t,
}: HomeHeaderSearchProps) {
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
          <Pressable onPress={onOpenSearch}>
            <Ionicons name="search" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={onToggleCaptureMode}
            style={[styles.modeToggleBtn, { backgroundColor: `${colors.primary}18` }]}
          >
            <Ionicons
              name={captureMode === 'text' ? 'camera-outline' : 'document-text-outline'}
              size={20}
              color={colors.primary}
            />
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

