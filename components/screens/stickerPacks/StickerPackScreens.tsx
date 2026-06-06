import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useConnectivity } from '../../../hooks/useConnectivity';
import { useNotesStore } from '../../../hooks/useNotes';
import { useStickerPacks } from '../../../hooks/useStickerPacks';
import { useTheme } from '../../../hooks/useTheme';
import {
  ensureStickerAssetRegistered,
  importStickerAsset,
  type StickerAsset,
} from '../../../services/noteStickers';
import {
  cleanupSubjectCutoutImportSource,
  createStickerImportSourceFromSubjectCutout,
  prepareStickerSubjectCutout,
  SubjectCutoutError,
} from '../../../services/stickerSubjectCutout';
import {
  approveStickerPackRevision,
  getStickerPackDetail,
  getStickerPackErrorMessage,
  listModerationQueue,
  listMyStickerPacks,
  listStickerPackCatalog,
  rejectStickerPackRevision,
  saveStickerPackDraft,
  setStickerPackLiked,
  STICKER_PACK_DESCRIPTION_MAX_LENGTH,
  STICKER_PACK_MAX_ITEMS,
  STICKER_PACK_NAME_MAX_LENGTH,
  submitStickerPackRevision,
  unpublishStickerPack,
  validateStickerPackDraft,
  type StickerPackDetail,
  type StickerPackCatalogSort,
  type StickerPackRevisionStatus,
  type StickerPackSummary,
} from '../../../services/stickerPacks';
import { showAppAlert } from '../../../utils/alert';
import PrimaryButton from '../../ui/PrimaryButton';
import NotoLoader from '../../ui/NotoLoader';
import OfflineNotice from '../../ui/OfflineNotice';
import SittingCatIcon from '../../ui/SittingCatIcon';
import CatBoxIcon from '../../ui/CatBoxIcon';
import { buildCreatedStickerLibrary } from '../notes/stickerLibrary';

function PackScreen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.screenContent,
    { paddingTop: 16, paddingBottom: insets.bottom + 28 },
  ];

  if (!scroll) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.flex, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function FixedActionScreen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.fixedActionContent}>{children}</View>
      {footer ? (
        <View
          style={[
          styles.fixedActionFooter,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 12),
          },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

function StateMessage({
  iconType = 'cat',
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  iconType?: 'cat' | 'box' | 'ionicons';
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={styles.stateIconWrap}>
        {iconType === 'cat' ? (
          <SittingCatIcon size={56} color={colors.secondaryText} />
        ) : iconType === 'box' ? (
          <CatBoxIcon size={56} color={colors.secondaryText} />
        ) : icon ? (
          <Ionicons name={icon} size={42} color={colors.secondaryText} />
        ) : (
          <SittingCatIcon size={56} color={colors.secondaryText} />
        )}
      </View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateBody, { color: colors.secondaryText }]}>{body}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.stateButton} />
      ) : null}
    </View>
  );
}

function CenteredLoader() {
  return (
    <View style={styles.centeredContent}>
      <NotoLoader />
    </View>
  );
}

function PressableRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowPressable,
        pressed ? styles.rowPressed : null,
      ]}
      android_ripple={{ color: `${colors.text}10` }}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
    </Pressable>
  );
}

function AuthRequired() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <StateMessage
      iconType="ionicons"
      icon="person-circle-outline"
      title={t('stickerPacks.authTitle', 'Sign in for public packs')}
      body={t(
        'stickerPacks.authBody',
        'An online Noto account is required to publish or install sticker packs.'
      )}
      actionLabel={t('stickerPacks.signIn', 'Sign in')}
      onAction={() => router.push('/auth' as never)}
    />
  );
}

function PackArtwork({
  pack,
  size = 82,
}: {
  pack: StickerPackSummary;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.artwork,
        { width: size, height: size, backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      {pack.thumbnail.localUri ? (
        <Image source={{ uri: pack.thumbnail.localUri }} style={styles.artworkImage} />
      ) : (
        <Ionicons name="image-outline" size={size * 0.35} color={colors.secondaryText} />
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: StickerPackRevisionStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t(`stickerPacks.status.${status}`, status);
  const backgroundColor =
    status === 'approved'
      ? `${colors.success}22`
      : status === 'rejected'
        ? colors.dangerSoft
        : status === 'pending'
          ? colors.primarySoft
          : colors.surface;
  return (
    <View style={[styles.statusBadge, { backgroundColor, borderColor: colors.border }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function PackCard({
  pack,
  onPress,
  trailing,
}: {
  pack: StickerPackSummary;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.packCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <PackArtwork pack={pack} size={72} />
      <View style={styles.packCardText}>
        <Text style={[styles.packName, { color: colors.text }]} numberOfLines={1}>
          {pack.name}
        </Text>
        <Text style={[styles.packMeta, { color: colors.secondaryText }]} numberOfLines={1}>
          {t('stickerPacks.byCreator', 'By {{creator}}', { creator: pack.creatorName })}
        </Text>
        <Text style={[styles.packMeta, { color: colors.secondaryText }]}>
          {t('stickerPacks.stickerCount', '{{count}} stickers', { count: pack.stickerCount })}
        </Text>
        <View style={styles.packStats}>
          <View style={styles.packStat}>
            <Ionicons name="download-outline" size={13} color={colors.secondaryText} />
            <Text style={[styles.packStatText, { color: colors.secondaryText }]}>
              {pack.downloadCount}
            </Text>
          </View>
          <View style={styles.packStat}>
            <Ionicons
              name={pack.liked ? 'heart' : 'heart-outline'}
              size={13}
              color={pack.liked ? colors.danger : colors.secondaryText}
            />
            <Text style={[styles.packStatText, { color: colors.secondaryText }]}>
              {pack.likeCount}
            </Text>
          </View>
        </View>
      </View>
      {trailing ?? <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />}
    </Pressable>
  );
}

function useRemoteList<T>(loader: () => Promise<T[]>, enabled = true) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setItems(await loader());
    } catch (nextError) {
      setError(getStickerPackErrorMessage(nextError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, loader]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, refreshing, error, reload: () => load(true) };
}

export function StickerPackCatalogScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { isModerator, install, pendingPackIds } = useStickerPacks();
  const [sort, setSort] = useState<StickerPackCatalogSort>('newest');
  const loader = useCallback(() => listStickerPackCatalog(sort), [sort]);
  const { items, loading, refreshing, error, reload } = useRemoteList(loader, Boolean(user && isOnline));
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'store' | 'library'>('store');
  const fadeAnim = useState(() => new Animated.Value(1))[0];

  const handleTabChange = (tab: 'store' | 'library') => {
    if (tab === activeTab) return;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 90,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  if (!user) {
    return <PackScreen><AuthRequired /></PackScreen>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('stickerPacks.title', 'Sticker Studio') }} />
      <View style={[styles.segmentedControlContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.segmentedWrap,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Pressable
            style={[
              styles.segmentedButton,
              activeTab === 'store' && { backgroundColor: colors.primarySoft },
            ]}
            onPress={() => handleTabChange('store')}
          >
            <Text
              style={[
                styles.segmentedLabel,
                { color: activeTab === 'store' ? colors.primary : colors.secondaryText },
              ]}
            >
              {t('stickerPacks.discoverTab', 'Discover')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentedButton,
              activeTab === 'library' && { backgroundColor: colors.primarySoft },
            ]}
            onPress={() => handleTabChange('library')}
          >
            <Text
              style={[
                styles.segmentedLabel,
                { color: activeTab === 'library' ? colors.primary : colors.secondaryText },
              ]}
            >
              {t('stickerPacks.libraryTab', 'My stickers')}
            </Text>
          </Pressable>
        </View>
      </View>

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {activeTab === 'store' ? (
          loading ? (
            <CenteredLoader />
          ) : error ? (
            <View style={styles.centeredContent}>
              <StateMessage
                iconType="ionicons"
                icon="cloud-offline-outline"
                title={t('stickerPacks.loadErrorTitle', 'Could not load sticker packs')}
                body={error}
                actionLabel={t('stickerPacks.retry', 'Try again')}
                onAction={reload}
              />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centeredContent}>
              <StateMessage
                iconType="cat"
                title={t('stickerPacks.emptyCatalogTitle', 'No public packs yet')}
                body={t('stickerPacks.emptyCatalogBody', 'Check back soon.')}
              />
            </View>
          ) : (
            <FlashList
              style={styles.flex}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <PackCard
                  pack={item}
                  onPress={() => router.push(`/sticker-packs/${item.id}` as never)}
                  trailing={
                    item.installed ? (
                      <View style={[styles.storeActionBtn, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={!isOnline || pendingPackIds.has(item.id)}
                        onPress={(e) => {
                          e.stopPropagation();
                          void install(item.id);
                        }}
                        style={({ pressed }) => [
                          styles.storeActionBtn,
                          { backgroundColor: colors.primarySoft, opacity: pressed ? 0.78 : 1 },
                        ]}
                      >
                        {pendingPackIds.has(item.id) ? (
                          <NotoLoader size="small" variant="inline" />
                        ) : (
                          <Ionicons name="download-outline" size={16} color={colors.primary} />
                        )}
                      </Pressable>
                    )
                  }
                />
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
              contentContainerStyle={[
                styles.listContent,
                { paddingTop: 4, paddingBottom: insets.bottom + 28 },
              ]}
              ListHeaderComponent={
                <View style={styles.catalogActions}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sortRow}
                  >
                    {([
                      ['newest', 'sparkles-outline', t('stickerPacks.sort.newest', 'Newest')],
                      ['downloads', 'download-outline', t('stickerPacks.sort.downloads', 'Most downloaded')],
                      ['likes', 'heart-outline', t('stickerPacks.sort.likes', 'Most loved')],
                    ] as const).map(([value, icon, label]) => {
                      const active = sort === value;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSort(value)}
                          style={[
                            styles.sortChip,
                            {
                              backgroundColor: active ? colors.primarySoft : colors.surface,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={icon}
                            size={15}
                            color={active ? colors.primary : colors.secondaryText}
                          />
                          <Text
                            style={[
                              styles.sortChipText,
                              { color: active ? colors.primary : colors.secondaryText },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {!isOnline ? (
                    <OfflineNotice
                      title={t('stickerPacks.offlineTitle', 'Sticker packs need a connection')}
                      body={t('stickerPacks.offlineCatalogBody', 'Reconnect to browse.')}
                    />
                  ) : null}
                </View>
              }
            />
          )
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: 4, paddingBottom: insets.bottom + 28 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <PressableRow
                icon="add-circle-outline"
                label={t('stickerPacks.create', 'Create pack')}
                onPress={() => router.push('/sticker-packs/create' as never)}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <PressableRow
                icon="download-outline"
                label={t('stickerPacks.installed', 'My packs')}
                onPress={() => router.push('/sticker-packs/installed' as never)}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <PressableRow
                icon="brush-outline"
                label={t('stickerPacks.creatorPacks', 'Created by me')}
                onPress={() => router.push('/sticker-packs/mine' as never)}
              />
              {isModerator ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <PressableRow
                    icon="shield-checkmark-outline"
                    label={t('stickerPacks.moderation.open', 'Moderator queue')}
                    onPress={() => router.push('/sticker-packs/moderation' as never)}
                  />
                </>
              ) : null}
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

export function StickerPackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { install, installedPacks, isModerator, pendingPackIds, remove } = useStickerPacks();
  const [pack, setPack] = useState<StickerPackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const installed = installedPacks.some((item) => item.id === id);
  const [liking, setLiking] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user || !isOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPack(await getStickerPackDetail(id));
    } catch (nextError) {
      setError(getStickerPackErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [id, isOnline, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return <PackScreen><AuthRequired /></PackScreen>;
  }
  if (loading) {
    return (
      <PackScreen scroll={false}>
        <CenteredLoader />
      </PackScreen>
    );
  }
  if (!pack) {
    return (
      <PackScreen>
        <StateMessage
          iconType="ionicons"
          icon="alert-circle-outline"
          title={t('stickerPacks.unavailableTitle', 'Pack unavailable')}
          body={error ?? t('stickerPacks.unavailableBody', 'This pack may have been unpublished.')}
          actionLabel={isOnline ? t('stickerPacks.retry', 'Try again') : undefined}
          onAction={isOnline ? load : undefined}
        />
      </PackScreen>
    );
  }

  const handleInstall = async () => {
    try {
      if (installed) {
        await remove(pack.id);
      } else {
        await install(pack.id);
      }
    } catch (nextError) {
      showAppAlert(t('common.error', 'Something went wrong'), getStickerPackErrorMessage(nextError));
    }
  };

  const handleLike = async () => {
    if (liking) {
      return;
    }
    const nextLiked = !pack.liked;
    setLiking(true);
    setPack((current) =>
      current
        ? {
            ...current,
            liked: nextLiked,
            likeCount: Math.max(0, current.likeCount + (nextLiked ? 1 : -1)),
          }
        : current
    );
    try {
      const result = await setStickerPackLiked(pack.id, nextLiked);
      setPack((current) =>
        current
          ? { ...current, liked: result.liked, likeCount: result.like_count }
          : current
      );
    } catch (nextError) {
      setPack((current) =>
        current
          ? {
              ...current,
              liked: !nextLiked,
              likeCount: Math.max(0, current.likeCount + (nextLiked ? -1 : 1)),
            }
          : current
      );
      showAppAlert(t('common.error', 'Something went wrong'), getStickerPackErrorMessage(nextError));
    } finally {
      setLiking(false);
    }
  };

  return (
    <PackScreen>
      <Stack.Screen options={{ title: pack.name }} />
      {!isOnline ? (
        <OfflineNotice
          title={t('stickerPacks.offlineTitle', 'Sticker packs need a connection')}
          body={t('stickerPacks.offlineInstallBody', 'Reconnect to install or remove a pack.')}
        />
      ) : null}
      <View
        style={[
          styles.detailHero,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.detailArtworkHalo, { backgroundColor: colors.primarySoft }]}>
          <PackArtwork pack={pack} size={136} />
        </View>
        <Text style={[styles.detailTitle, { color: colors.text }]}>{pack.name}</Text>
        <Text style={[styles.detailCreator, { color: colors.secondaryText }]}>
          {t('stickerPacks.byCreator', 'By {{creator}}', { creator: pack.creatorName })}
        </Text>
        {pack.description ? (
          <Text style={[styles.detailDescription, { color: colors.secondaryText }]}>
            {pack.description}
          </Text>
        ) : null}
        <View style={styles.detailStats}>
          <View style={[styles.detailStat, { backgroundColor: colors.background }]}>
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={[styles.detailStatValue, { color: colors.text }]}>
              {pack.downloadCount}
            </Text>
            <Text style={[styles.detailStatLabel, { color: colors.secondaryText }]}>
              {t('stickerPacks.downloads', 'downloads')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: pack.liked, busy: liking }}
            onPress={() => void handleLike()}
            disabled={!isOnline || liking}
            style={[
              styles.detailStat,
              {
                backgroundColor: pack.liked ? colors.dangerSoft : colors.background,
                opacity: !isOnline ? 0.55 : 1,
              },
            ]}
          >
            <Ionicons
              name={pack.liked ? 'heart' : 'heart-outline'}
              size={18}
              color={pack.liked ? colors.danger : colors.primary}
            />
            <Text style={[styles.detailStatValue, { color: colors.text }]}>{pack.likeCount}</Text>
            <Text style={[styles.detailStatLabel, { color: colors.secondaryText }]}>
              {t('stickerPacks.loves', 'loves')}
            </Text>
          </Pressable>
        </View>
      </View>
      <PrimaryButton
        label={
          installed
            ? t('stickerPacks.remove', 'Remove pack')
            : t('stickerPacks.install', 'Install pack')
        }
        variant={installed ? 'secondary' : 'primary'}
        disabled={!isOnline}
        loading={pendingPackIds.has(pack.id)}
        onPress={() => void handleInstall()}
      />
      {isModerator ? (
        <PrimaryButton
          label={t('stickerPacks.moderation.unpublish', 'Unpublish')}
          variant="destructive"
          disabled={!isOnline}
          onPress={() => {
            void unpublishStickerPack(pack.id)
              .then(() => setPack(null))
              .catch((nextError) => {
                showAppAlert(
                  t('common.error', 'Something went wrong'),
                  getStickerPackErrorMessage(nextError)
                );
              });
          }}
        />
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('stickerPacks.fullPreview', 'Full pack preview')}
      </Text>
      <View style={styles.stickerGrid}>
        {pack.items.map((item) => (
          <View
            key={item.asset.id}
            style={[styles.stickerCell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Image source={{ uri: item.asset.localUri }} style={styles.stickerImage} />
          </View>
        ))}
      </View>
    </PackScreen>
  );
}

export function InstalledStickerPacksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { installedPacks, isLoading, pendingPackIds, refresh, remove } = useStickerPacks();

  if (!user) {
    return <PackScreen><AuthRequired /></PackScreen>;
  }

  return (
    <FixedActionScreen
      footer={
        isLoading ? null : installedPacks.length === 0 ? (
          <PrimaryButton
            label={t('stickerPacks.browse', 'Browse packs')}
            onPress={() => router.push('/sticker-packs' as never)}
          />
        ) : (
          <PrimaryButton
            label={t('stickerPacks.refreshInstalled', 'Check for updates')}
            variant="secondary"
            disabled={!isOnline}
            onPress={() => void refresh()}
          />
        )
      }
    >
      <Stack.Screen options={{ title: t('stickerPacks.installed', 'My packs') }} />
      {isLoading ? (
        <CenteredLoader />
      ) : installedPacks.length === 0 ? (
        <View style={styles.centeredContent}>
          <StateMessage
            iconType="cat"
            title={t('stickerPacks.emptyInstalledTitle', 'No installed packs')}
            body={t('stickerPacks.emptyInstalledBody', 'Find one in Discover.')}
          />
        </View>
      ) : (
        <FlashList
          style={styles.flex}
          data={installedPacks}
          keyExtractor={(pack) => pack.id}
          renderItem={({ item: pack }) => (
            <PackCard
              pack={pack}
              onPress={() => router.push(`/sticker-packs/${pack.id}` as never)}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  disabled={!isOnline || pendingPackIds.has(pack.id)}
                  onPress={() => void remove(pack.id)}
                  style={styles.iconButton}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              }
            />
          )}
          ListHeaderComponent={
            !isOnline ? (
              <View style={styles.packListHeader}>
                <OfflineNotice
                  title={t('stickerPacks.offlineInstalledTitle', 'Offline')}
                  body={t('stickerPacks.offlineInstalledBody', 'Downloaded stickers still work.')}
                />
              </View>
            ) : null
          }
          contentContainerStyle={styles.packListContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </FixedActionScreen>
  );
}

export function MyStickerPacksScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const loader = useCallback(() => listMyStickerPacks(), []);
  const { items, loading, error, reload } = useRemoteList(loader, Boolean(user && isOnline));

  if (!user) {
    return <PackScreen><AuthRequired /></PackScreen>;
  }

  return (
    <FixedActionScreen
      footer={
        <PrimaryButton
          label={t('stickerPacks.create', 'Create pack')}
          disabled={!isOnline}
          leadingIcon={<Ionicons name="add" size={20} color={colors.onPrimary} />}
          onPress={() => router.push('/sticker-packs/create' as never)}
        />
      }
    >
      <Stack.Screen options={{ title: t('stickerPacks.creatorPacks', 'Created by me') }} />
      {loading ? (
        <CenteredLoader />
      ) : error ? (
        <View style={styles.centeredContent}>
          <StateMessage
            iconType="ionicons"
            icon="alert-circle-outline"
            title={t('stickerPacks.loadErrorTitle', 'Could not load packs')}
            body={error}
            actionLabel={t('stickerPacks.retry', 'Try again')}
            onAction={reload}
          />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centeredContent}>
          <StateMessage
            iconType="box"
            title={t('stickerPacks.emptyCreatorTitle', 'Create your first pack')}
            body={t('stickerPacks.emptyCreatorBody', 'Choose 3–30 stickers.')}
          />
        </View>
      ) : (
        <FlashList
          style={styles.flex}
          data={items}
          keyExtractor={(pack) => pack.revisionId}
          renderItem={({ item: pack }) => (
            <View style={styles.creatorCard}>
              <PackCard pack={pack} trailing={<StatusBadge status={pack.status} />} />
              {pack.status === 'rejected' && pack.moderatorFeedback ? (
                <View style={[styles.feedback, { backgroundColor: colors.dangerSoft }]}>
                  <Text style={[styles.feedbackTitle, { color: colors.text }]}>
                    {t('stickerPacks.feedbackTitle', 'Moderator feedback')}
                  </Text>
                  <Text style={[styles.feedbackBody, { color: colors.secondaryText }]}>
                    {pack.moderatorFeedback}
                  </Text>
                </View>
              ) : null}
              {pack.status === 'draft' ||
              pack.status === 'rejected' ||
              pack.status === 'approved' ? (
                <PrimaryButton
                  label={
                    pack.status === 'approved'
                      ? t('stickerPacks.createRevision', 'Create new revision')
                      : t('stickerPacks.edit', 'Edit pack')
                  }
                  variant="secondary"
                  onPress={() =>
                    router.push(
                      `/sticker-packs/create?packId=${pack.id}&revisionId=${pack.revisionId}` as never
                    )
                  }
                />
              ) : null}
            </View>
          )}
          contentContainerStyle={styles.packListContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </FixedActionScreen>
  );
}

export function CreateStickerPackScreen() {
  const { packId, revisionId } = useLocalSearchParams<{
    packId?: string;
    revisionId?: string;
  }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { notes } = useNotesStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [thumbnailId, setThumbnailId] = useState('');
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [editingAssets, setEditingAssets] = useState<StickerAsset[]>([]);
  const [creatingCutout, setCreatingCutout] = useState(false);

  const localAvailable = useMemo(() => {
    const byId = new Map<string, StickerAsset>();
    for (const item of buildCreatedStickerLibrary(notes)) {
      if (item.renderMode !== 'stamp' && item.asset.localUri) {
        byId.set(item.asset.id, item.asset);
      }
    }
    return Array.from(byId.values());
  }, [notes]);
  const available = useMemo(() => {
    const byId = new Map<string, StickerAsset>();
    for (const asset of [...localAvailable, ...editingAssets]) {
      byId.set(asset.remoteAssetId ?? asset.id, asset);
    }
    return Array.from(byId.values());
  }, [editingAssets, localAvailable]);

  useEffect(() => {
    if (!revisionId || !user || !isOnline) {
      return;
    }
    void listMyStickerPacks().then((packs) => {
      const existing = packs.find((pack) => pack.revisionId === revisionId);
      if (!existing) {
        return;
      }
      setName(existing.name);
      setDescription(existing.description ?? '');
      setEditingAssets(existing.items.map((item) => item.asset));
      const existingIds = existing.items.map((item) => item.asset.remoteAssetId ?? item.asset.id);
      setSelectedIds(existingIds);
      setThumbnailId(existing.thumbnailAssetId);
    }).catch(() => undefined);
  }, [isOnline, revisionId, user]);

  if (!user) {
    return <PackScreen><AuthRequired /></PackScreen>;
  }

  const toggleAsset = (assetId: string) => {
    setSelectedIds((current) => {
      if (current.includes(assetId)) {
        const next = current.filter((id) => id !== assetId);
        if (thumbnailId === assetId) {
          setThumbnailId(next[0] ?? '');
        }
        return next;
      }
      if (current.length >= STICKER_PACK_MAX_ITEMS) {
        return current;
      }
      const next = [...current, assetId];
      if (!thumbnailId) {
        setThumbnailId(assetId);
      }
      return next;
    });
  };

  const createCutout = async () => {
    if (creatingCutout || selectedIds.length >= STICKER_PACK_MAX_ITEMS) {
      return;
    }

    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted' && permission.canAskAgain !== false) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      const blocked = permission.canAskAgain === false;
      showAppAlert(
        t('stickerPacks.photoPermissionTitle', 'Photo access needed'),
        t(
          'stickerPacks.photoPermissionBody',
          'Allow photo access to turn a picture into a cutout sticker.'
        ),
        blocked
          ? [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              {
                text: t('common.openSettings', 'Open Settings'),
                onPress: () => void Linking.openSettings(),
              },
            ]
          : undefined
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
    });
    const picked = result.canceled ? null : result.assets?.[0];
    if (!picked?.uri) {
      return;
    }

    setCreatingCutout(true);
    let cleanupUri: string | null = null;
    try {
      let cutout;
      try {
        cutout = await createStickerImportSourceFromSubjectCutout({
          uri: picked.uri,
          mimeType: picked.mimeType,
          name: picked.fileName,
        });
      } catch (error) {
        if (error instanceof SubjectCutoutError && error.code === 'model-unavailable') {
          await prepareStickerSubjectCutout();
          cutout = await createStickerImportSourceFromSubjectCutout({
            uri: picked.uri,
            mimeType: picked.mimeType,
            name: picked.fileName,
          });
        } else {
          throw error;
        }
      }

      cleanupUri = cutout.cleanupUri;
      const asset = await importStickerAsset(cutout.source, { requiresTransparency: true });
      const selectionId = asset.remoteAssetId ?? asset.id;
      setEditingAssets((current) => [
        asset,
        ...current.filter((item) => (item.remoteAssetId ?? item.id) !== selectionId),
      ]);
      setSelectedIds((current) =>
        current.includes(selectionId) ? current : [...current, selectionId]
      );
      setThumbnailId((current) => current || selectionId);
    } catch (error) {
      showAppAlert(
        t('stickerPacks.cutoutErrorTitle', 'Could not make that sticker'),
        error instanceof Error
          ? error.message
          : t('stickerPacks.cutoutErrorBody', 'Try a photo with one clear subject.')
      );
    } finally {
      await cleanupSubjectCutoutImportSource(cleanupUri);
      setCreatingCutout(false);
    }
  };

  const persist = async (submit: boolean) => {
    const validation = validateStickerPackDraft({
      name,
      description,
      thumbnailAssetId: thumbnailId,
      assetIds: selectedIds,
    });
    if (!validation.valid) {
      showAppAlert(
        t('stickerPacks.validationTitle', 'Check this pack'),
        t(`stickerPacks.validation.${validation.errors[0]}`, 'Complete the required pack details.')
      );
      return;
    }

    setSaving(submit ? 'submit' : 'draft');
    try {
      const selectedAssets = selectedIds
        .map((id) =>
          available.find((asset) => asset.id === id || asset.remoteAssetId === id)
        )
        .filter((asset): asset is StickerAsset => Boolean(asset));
      const registered = await Promise.all(
        selectedAssets.map((asset) =>
          asset.remoteAssetId && asset.remotePath
            ? Promise.resolve(asset)
            : ensureStickerAssetRegistered(user.uid, asset)
        )
      );
      const remoteIds = registered.map((asset) => asset.remoteAssetId ?? asset.id);
      const thumbnailIndex = selectedIds.indexOf(thumbnailId);
      const result = await saveStickerPackDraft({
        packId: packId ?? null,
        revisionId: revisionId ?? null,
        name,
        description,
        assetIds: remoteIds,
        thumbnailAssetId: remoteIds[thumbnailIndex],
      });
      if (submit) {
        await submitStickerPackRevision(result.revision_id);
      }
      showAppAlert(
        submit
          ? t('stickerPacks.submittedTitle', 'Submitted for review')
          : t('stickerPacks.savedTitle', 'Draft saved'),
        submit
          ? t('stickerPacks.submittedBody', 'A moderator will review the complete pack.')
          : t('stickerPacks.savedBody', 'You can return and finish this pack later.')
      );
      router.replace('/sticker-packs/mine' as never);
    } catch (error) {
      showAppAlert(t('common.error', 'Something went wrong'), getStickerPackErrorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  return (
    <FixedActionScreen
      footer={
        <View style={styles.actionButtons}>
          <PrimaryButton
            label={t('stickerPacks.saveDraft', 'Save draft')}
            variant="secondary"
            disabled={!isOnline || saving !== null}
            loading={saving === 'draft'}
            onPress={() => void persist(false)}
            style={styles.actionButton}
          />
          <PrimaryButton
            label={t('stickerPacks.submit', 'Submit')}
            disabled={!isOnline || saving !== null}
            loading={saving === 'submit'}
            onPress={() => void persist(true)}
            style={styles.actionButton}
          />
        </View>
      }
    >
      <Stack.Screen options={{ title: t('stickerPacks.create', 'Create pack') }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.createContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!isOnline ? (
        <OfflineNotice
          title={t('stickerPacks.offlineTitle', 'Sticker packs need a connection')}
          body={t('stickerPacks.offlineCreateBody', 'Reconnect to save or submit a public pack.')}
        />
      ) : null}
      <Text style={[styles.fieldLabel, { color: colors.text }]}>
        {t('stickerPacks.nameLabel', 'Pack name')}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={STICKER_PACK_NAME_MAX_LENGTH}
        placeholder={t('stickerPacks.namePlaceholder', 'Weekend favorites')}
        placeholderTextColor={colors.secondaryText}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.counter, { color: colors.secondaryText }]}>
        {name.length}/{STICKER_PACK_NAME_MAX_LENGTH}
      </Text>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>
        {t('stickerPacks.descriptionLabel', 'Description (optional)')}
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        maxLength={STICKER_PACK_DESCRIPTION_MAX_LENGTH}
        multiline
        placeholder={t('stickerPacks.descriptionPlaceholder', 'A little context for people browsing.')}
        placeholderTextColor={colors.secondaryText}
        style={[
          styles.input,
          styles.multilineInput,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <Text style={[styles.counter, { color: colors.secondaryText }]}>
        {description.length}/{STICKER_PACK_DESCRIPTION_MAX_LENGTH}
      </Text>
      </View>
      <View
        style={[
          styles.selectionCard,
          styles.createSelectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('stickerPacks.chooseStickers', 'Choose cutout stickers')}
      </Text>
      <Text style={[styles.selectionCount, { color: colors.text }]}>
        {t('stickerPacks.selectedProgress', '{{count}}/{{max}} selected', {
          count: selectedIds.length,
          max: STICKER_PACK_MAX_ITEMS,
        })}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={creatingCutout || selectedIds.length >= STICKER_PACK_MAX_ITEMS}
        onPress={() => void createCutout()}
        style={({ pressed }) => [
          styles.cutoutAction,
          {
            backgroundColor: colors.primarySoft,
            borderColor: colors.primary,
            opacity:
              creatingCutout || selectedIds.length >= STICKER_PACK_MAX_ITEMS
                ? 0.55
                : pressed
                  ? 0.8
                  : 1,
          },
        ]}
      >
        <View style={[styles.cutoutActionIcon, { backgroundColor: colors.surface }]}>
          {creatingCutout ? (
            <NotoLoader size="small" variant="inline" />
          ) : (
            <Ionicons name="cut-outline" size={21} color={colors.primary} />
          )}
        </View>
        <View style={styles.cutoutActionCopy}>
          <Text style={[styles.cutoutActionTitle, { color: colors.text }]}>
            {creatingCutout
              ? t('stickerPacks.creatingCutout', 'Cutting out your sticker...')
              : t('stickerPacks.createCutout', 'Create sticker from photo')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </Pressable>
      {available.length === 0 ? (
        <StateMessage
          iconType="cat"
          title={t('stickerPacks.noCutoutsTitle', 'No cutout stickers yet')}
          body={t('stickerPacks.noCutoutsBody', 'Create one from a photo here, or use a cutout from your notes.')}
        />
      ) : (
        <View style={styles.stickerGrid}>
          {available.map((asset) => {
            const selectionId = asset.remoteAssetId ?? asset.id;
            const selected = selectedIds.includes(selectionId);
            const selectedIndex = selectedIds.indexOf(selectionId);
            const thumbnail = thumbnailId === selectionId;
            return (
              <View key={selectionId} style={styles.selectCellWrap}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleAsset(selectionId)}
                  style={[
                    styles.stickerCell,
                    styles.selectionStickerCell,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 3 : 1,
                    },
                  ]}
                >
                  <Image source={{ uri: asset.localUri }} style={styles.stickerImage} />
                  {selected ? (
                    <View style={[styles.selectionOrderBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.selectionOrderText, { color: colors.onPrimary }]}>
                        {selectedIndex + 1}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                {selected ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('stickerPacks.setThumbnail', 'Use as thumbnail')}
                    onPress={() => setThumbnailId(selectionId)}
                    style={[styles.thumbnailButton, { backgroundColor: colors.surface }]}
                  >
                    <Ionicons
                      name={thumbnail ? 'star' : 'star-outline'}
                      size={18}
                      color={thumbnail ? colors.primary : colors.text}
                    />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      </View>
      </ScrollView>
    </FixedActionScreen>
  );
}

export function StickerPackModerationQueueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { isModerator } = useStickerPacks();
  const loader = useCallback(() => listModerationQueue(), []);
  const { items, loading, error, reload } = useRemoteList(
    loader,
    Boolean(user && isOnline && isModerator)
  );

  if (!user) {
    return <PackScreen><AuthRequired /></PackScreen>;
  }
  if (!isModerator) {
    return (
      <PackScreen>
        <StateMessage
          icon="lock-closed-outline"
          title={t('stickerPacks.moderation.deniedTitle', 'Moderator access required')}
          body={t('stickerPacks.moderation.deniedBody', 'This queue is protected by server authorization.')}
        />
      </PackScreen>
    );
  }

  return (
    <PackScreen scroll={false}>
      <Stack.Screen options={{ title: t('stickerPacks.moderation.open', 'Moderator queue') }} />
      {loading ? (
        <CenteredLoader />
      ) : error ? (
        <View style={styles.centeredContent}>
          <StateMessage
            icon="alert-circle-outline"
            title={t('stickerPacks.loadErrorTitle', 'Could not load packs')}
            body={error}
            actionLabel={t('stickerPacks.retry', 'Try again')}
            onAction={reload}
          />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centeredContent}>
          <StateMessage
            icon="checkmark-done-circle-outline"
            title={t('stickerPacks.moderation.emptyTitle', 'Queue is clear')}
            body={t('stickerPacks.moderation.emptyBody', 'Nothing to review.')}
          />
        </View>
      ) : (
        <FlashList
          style={styles.flex}
          data={items}
          keyExtractor={(pack) => pack.revisionId}
          renderItem={({ item: pack }) => (
            <PackCard
              pack={pack}
              onPress={() =>
                router.push(`/sticker-packs/moderation/${pack.revisionId}` as never)
              }
            />
          )}
          ListHeaderComponent={
            <View style={styles.packListHeader}>
              <Text style={styles.pendingCount}>
                {t('stickerPacks.moderation.pendingCount', '{{count}} pending', {
                  count: items.length,
                })}
              </Text>
            </View>
          }
          contentContainerStyle={styles.packListContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </PackScreen>
  );
}

export function StickerPackModerationDetailScreen() {
  const { revisionId } = useLocalSearchParams<{ revisionId: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { isModerator } = useStickerPacks();
  const [pack, setPack] = useState<StickerPackDetail | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'unpublish' | null>(null);

  useEffect(() => {
    if (!isModerator) {
      return;
    }
    void listModerationQueue()
      .then((items) => setPack(items.find((item) => item.revisionId === revisionId) ?? null))
      .catch(() => setPack(null));
  }, [isModerator, revisionId]);

  if (!isModerator) {
    return (
      <PackScreen>
        <StateMessage
          icon="lock-closed-outline"
          title={t('stickerPacks.moderation.deniedTitle', 'Moderator access required')}
          body={t('stickerPacks.moderation.deniedBody', 'This queue is protected by server authorization.')}
        />
      </PackScreen>
    );
  }
  if (!pack) {
    return (
      <PackScreen scroll={false}>
        <CenteredLoader />
      </PackScreen>
    );
  }

  const decide = async (decision: 'approve' | 'reject' | 'unpublish') => {
    if (decision === 'reject' && !feedback.trim()) {
      showAppAlert(
        t('stickerPacks.moderation.feedbackRequiredTitle', 'Feedback required'),
        t('stickerPacks.moderation.feedbackRequiredBody', 'Explain what the creator must change.')
      );
      return;
    }
    setBusy(decision);
    try {
      if (decision === 'approve') {
        await approveStickerPackRevision(pack.revisionId);
      } else if (decision === 'reject') {
        await rejectStickerPackRevision(pack.revisionId, feedback);
      } else {
        await unpublishStickerPack(pack.id);
      }
      router.replace('/sticker-packs/moderation' as never);
    } catch (error) {
      showAppAlert(t('common.error', 'Something went wrong'), getStickerPackErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PackScreen>
      <View style={styles.detailHero}>
        <PackArtwork pack={pack} size={112} />
        <Text style={[styles.detailTitle, { color: colors.text }]}>{pack.name}</Text>
        <Text style={[styles.detailCreator, { color: colors.secondaryText }]}>
          {pack.creatorName}
        </Text>
        <Text style={[styles.packMeta, { color: colors.secondaryText }]}>
          {pack.submittedAt ?? pack.updatedAt}
        </Text>
      </View>
      <View style={styles.stickerGrid}>
        {pack.items.map((item) => (
          <View
            key={item.asset.id}
            style={[styles.stickerCell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Image source={{ uri: item.asset.localUri }} style={styles.stickerImage} />
          </View>
        ))}
      </View>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>
        {t('stickerPacks.moderation.feedbackLabel', 'Rejection feedback')}
      </Text>
      <TextInput
        value={feedback}
        onChangeText={setFeedback}
        multiline
        placeholder={t('stickerPacks.moderation.feedbackPlaceholder', 'Tell the creator what must change.')}
        placeholderTextColor={colors.secondaryText}
        style={[
          styles.input,
          styles.multilineInput,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <View style={styles.actionButtons}>
        <PrimaryButton
          label={t('stickerPacks.moderation.reject', 'Reject')}
          variant="destructive"
          loading={busy === 'reject'}
          disabled={busy !== null}
          onPress={() => void decide('reject')}
          style={styles.actionButton}
        />
        <PrimaryButton
          label={t('stickerPacks.moderation.approve', 'Approve')}
          loading={busy === 'approve'}
          disabled={busy !== null}
          onPress={() => void decide('approve')}
          style={styles.actionButton}
        />
      </View>
    </PackScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  fixedActionContent: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 12,
  },
  fixedActionFooter: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 12,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  createContent: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 16,
  },
  screenContent: {
    paddingHorizontal: Layout.screenPadding,
    gap: 16,
  },
  listContent: {
    paddingHorizontal: Layout.screenPadding,
    gap: 12,
    flexGrow: 1,
  },
  packListContent: {
    paddingTop: 4,
    paddingBottom: 28,
  },
  packListHeader: {
    marginBottom: 14,
  },
  catalogActions: {
    gap: 14,
    marginBottom: 18,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: Layout.screenPadding,
  },
  sortChip: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortChipText: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
    fontWeight: '800',
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 8,
  },
  rowPressable: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: 'Noto Sans',
    fontSize: 15,
    fontWeight: '600',
  },
  rowDetail: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
    marginRight: 16,
  },
  catalogRow: {
    gap: 12,
  },
  catalogPackCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 22,
    padding: 10,
    marginBottom: 12,
  },
  catalogPackCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  catalogArtwork: {
    height: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  catalogArtworkImage: {
    width: '76%',
    height: '76%',
    resizeMode: 'contain',
  },
  installedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogCardInfo: {
    paddingHorizontal: 4,
    gap: 2,
  },
  catalogPackName: {
    fontFamily: 'Noto Sans',
    fontSize: 14,
    fontWeight: '700',
  },
  catalogCreator: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
  },
  catalogPackFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  catalogCount: {
    fontFamily: 'Noto Sans',
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: { flex: 1 },
  state: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  stateIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stateTitle: {
    ...Typography.screenTitle,
    textAlign: 'center',
  },
  stateBody: {
    ...Typography.body,
    textAlign: 'center',
  },
  stateButton: { marginTop: 8, alignSelf: 'stretch' },
  packCard: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  artwork: {
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artworkImage: {
    width: '84%',
    height: '84%',
    resizeMode: 'contain',
  },
  packCardText: { flex: 1, gap: 3 },
  packName: {
    fontFamily: 'Noto Sans',
    fontSize: 17,
    fontWeight: '800',
  },
  packMeta: {
    fontFamily: 'Noto Sans',
    fontSize: 13,
    lineHeight: 18,
  },
  packStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 3,
  },
  packStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packStatText: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontFamily: 'Noto Sans',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  detailHero: {
    alignItems: 'center',
    gap: 7,
    padding: 22,
    borderWidth: 1,
    borderRadius: 30,
  },
  detailArtworkHalo: {
    width: 172,
    height: 172,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  detailTitle: {
    fontFamily: 'Noto Sans',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  detailCreator: {
    ...Typography.body,
  },
  detailDescription: {
    ...Typography.body,
    textAlign: 'center',
    maxWidth: 420,
  },
  detailStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  detailStat: {
    minWidth: 112,
    minHeight: 70,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailStatValue: {
    fontFamily: 'Noto Sans',
    fontSize: 17,
    fontWeight: '900',
  },
  detailStatLabel: {
    fontFamily: 'Noto Sans',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontFamily: 'Noto Sans',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 8,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stickerCell: {
    width: '30.5%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stickerImage: {
    width: '82%',
    height: '82%',
    resizeMode: 'contain',
  },
  creatorCard: { gap: 8 },
  feedback: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    marginTop: -6,
  },
  feedbackTitle: {
    fontFamily: 'Noto Sans',
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackBody: { ...Typography.body },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: 'Noto Sans',
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    fontFamily: 'Noto Sans',
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 108,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: 'Noto Sans',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: -12,
  },
  selectionCount: {
    ...Typography.pill,
  },
  cutoutAction: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cutoutActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoutActionCopy: {
    flex: 1,
    gap: 2,
  },
  cutoutActionTitle: {
    fontFamily: 'Noto Sans',
    fontSize: 14,
    fontWeight: '900',
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  selectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    minHeight: 240,
  },
  createSelectionCard: {
    flexGrow: 1,
  },
  selectCellWrap: {
    width: '30.5%',
    position: 'relative',
  },
  selectionStickerCell: {
    width: '100%',
  },
  thumbnailButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionOrderBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    minWidth: 25,
    height: 25,
    paddingHorizontal: 6,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionOrderText: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
    fontWeight: '900',
  },
  pendingCount: {
    ...Typography.pill,
    textAlign: 'center',
  },
  segmentedControlContainer: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 10,
    paddingBottom: 8,
  },
  segmentedWrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  segmentedButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentedLabel: {
    ...Typography.button,
    fontSize: 14,
  },
  storeActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
