import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SharedPostMemoryCard } from '../../home/MemoryCardPrimitives';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import { SharedPost } from '../../../services/sharedFeedService';

const { width } = Dimensions.get('window');
const DEFAULT_SHARED_CARD_SIZE = width - (Layout.screenPadding - 8) * 2;
const ESTIMATED_SHARED_CARD_HEIGHT = DEFAULT_SHARED_CARD_SIZE + 84;

export default function SharedIndexScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { enabled, loading, sharedPosts } = useSharedFeedStore();

  const sortedPosts = useMemo(
    () => [...sharedPosts].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sharedPosts]
  );

  const contentTopInset = insets.top + 72;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: t('shared.viewAllTitle', 'Shared moments'),
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
        }}
      />

      {!enabled ? (
        <View style={[styles.center, { paddingTop: contentTopInset }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.unavailableTitle', 'Shared moments unavailable')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t('shared.unavailableBody', 'This build does not have shared social enabled right now.')}
          </Text>
        </View>
      ) : !user ? (
        <View style={[styles.center, { paddingTop: contentTopInset }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.signInTitle', 'Sign in to connect with friends')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t('shared.signInBody', 'Connect your account to invite and join friends on Home.')}
          </Text>
          <Pressable
            onPress={() => {
              router.push('/auth');
            }}
            style={[styles.signInButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.signInButtonLabel}>
              {t('shared.signInButton', 'Sign in')}
            </Text>
          </Pressable>
        </View>
      ) : loading && sortedPosts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlashList
          data={sortedPosts}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          drawDistance={ESTIMATED_SHARED_CARD_HEIGHT * 2}
          renderItem={({ item }: { item: SharedPost }) => (
            <SharedPostMemoryCard
              post={item}
              colors={colors}
              t={t}
              containerStyle={styles.cardRow}
              onPress={() => {
                router.push(`/shared/${item.id}` as any);
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: contentTopInset,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: Layout.screenPadding,
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('shared.emptyPostsTitle', 'You\'re connected')}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                {t('shared.emptyPostsBody', 'Shared notes will appear here as soon as either of you posts one.')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    gap: 10,
  },
  cardRow: {
    marginBottom: 28,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  signInButton: {
    marginTop: 8,
    borderRadius: 18,
    minHeight: 44,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  signInButtonLabel: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
