import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SharedPostMemoryCard } from '../../components/home/MemoryCardPrimitives';
import { Layout } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { formatDate } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';

export default function SharedPostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { sharedPosts, deleteSharedPostById } = useSharedFeedStore();

  const post = sharedPosts.find((item) => item.id === id);

  const handleDelete = () => {
    if (!post) {
      return;
    }

    Alert.alert(
      t('shared.deleteTitle', 'Delete shared moment'),
      t('shared.deleteBody', 'This shared post will be removed for everyone in the feed.'),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('shared.deleteButton', 'Delete'),
          style: 'destructive',
          onPress: () => {
            void deleteSharedPostById(post.id)
              .then(() => {
                router.back();
              })
              .catch((error) => {
                Alert.alert(
                  t('shared.deleteTitle', 'Delete shared moment'),
                  error instanceof Error ? error.message : t('shared.genericError', 'Something went wrong.')
                );
              });
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: '',
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
          animation: 'none',
        }}
      />

      {!post ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.detailNotFound', 'Shared moment not found')}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>
              {t('common.goBack', 'Go Back')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 72,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: Layout.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SharedPostMemoryCard post={post} colors={colors} t={t} />

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {post.authorDisplayName ?? t('shared.someone', 'Someone')}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={colors.secondaryText} />
              <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                {formatDate(post.createdAt, 'long')}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.secondaryText} />
              <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                {post.placeName ?? t('shared.sharedNow', 'Shared now')}
              </Text>
            </View>
          </View>

          {user?.uid === post.authorUid ? (
            <Pressable
              onPress={handleDelete}
              style={[
                styles.deleteButton,
                {
                  backgroundColor: isDark ? 'rgba(255,69,58,0.12)' : 'rgba(255,59,48,0.1)',
                },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.deleteLabel, { color: colors.danger }]}>
                {t('shared.deleteButton', 'Delete')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
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
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'System',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  infoCard: {
    marginTop: 24,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'System',
  },
  deleteButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
