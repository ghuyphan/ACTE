import {
  BottomSheet,
  Button,
  Group,
  Host,
  HStack,
  Image as SwiftUIImage,
  List,
  Section,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  cornerRadius,
  environment,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  presentationDragIndicator,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import { Href, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppSheetAlert from '../../components/AppSheetAlert';
import SettingsLanguageSheet from '../../components/SettingsLanguageSheet';
import SettingsSyncSheet from '../../components/SettingsSyncSheet';
import SettingsThemeSheet from '../../components/SettingsThemeSheet';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useAuth } from '../../hooks/useAuth';
import { useNotes } from '../../hooks/useNotes';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useSubscription } from '../../hooks/useSubscription';
import { useTheme } from '../../hooks/useTheme';

function AndroidSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.androidSection}>
      <Text style={[styles.androidSectionTitle, { color: colors.secondaryText }]}>{title}</Text>
      <View style={[styles.androidSectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function AndroidRow({
  label,
  value,
  onPress,
  destructive = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.androidRow, pressed && onPress ? { opacity: 0.75 } : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.androidRowLabel, { color: destructive ? colors.danger : colors.text }]}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.androidRowValue, { color: destructive ? colors.danger : colors.primary }]}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, colors, isDark } = useTheme();
  const { notes, deleteAllNotes } = useNotes();
  const { user, isAuthAvailable } = useAuth();
  const { status: syncStatus, lastSyncedAt, lastMessage, isEnabled: syncEnabled } = useSyncStatus();
  const {
    tier,
    isPurchaseAvailable,
    plusPriceLabel,
    photoNoteLimit,
  } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alertProps, showAlert } = useAppSheetAlert();

  const [showTheme, setShowTheme] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showSync, setShowSync] = useState(false);

  const openAccountScreen = () => {
    if (!isAuthAvailable) {
      return;
    }

    router.push((user ? '/auth/profile' : '/auth') as Href);
  };

  const themeLabel =
    theme === 'system'
      ? t('settings.system', 'System')
      : theme === 'dark'
        ? t('settings.dark', 'Dark')
        : t('settings.light', 'Light');

  const accountValue = useMemo(() => {
    if (user) {
      return user.displayName || user.email || t('settings.signedIn', 'Signed in');
    }
    if (!isAuthAvailable) {
      return t('settings.unavailableShort', 'Unavailable');
    }
    return t('settings.notSignedIn', 'Not signed in');
  }, [isAuthAvailable, t, user]);

  const syncValue = useMemo(() => {
    if (!user) {
      return t('settings.autoSyncOff', 'Off');
    }

    if (!syncEnabled) {
      return t('settings.autoSyncOff', 'Off');
    }

    if (syncStatus === 'syncing') {
      return t('settings.autoSyncingShort', 'Syncing');
    }

    return t('settings.autoSyncOnShort', 'On');
  }, [syncEnabled, syncStatus, t, user]);

  const plusValue = useMemo(() => {
    if (tier === 'plus') {
      return t('settings.plusActive', 'Active');
    }

    return plusPriceLabel ?? t('settings.plusInactive', 'Free');
  }, [plusPriceLabel, t, tier]);

  const plusHint = useMemo(() => {
    if (tier === 'plus') {
      return t(
        'settings.plusActiveHint',
        'Noto Plus is active. Photo notes are expanded and library import is unlocked.'
      );
    }

    if (photoNoteLimit === null) {
      return t(
        'settings.plusHint',
        'Upgrade to Noto Plus to save more photo notes and create notes from your photo library.'
      );
    }

    return t(
      'settings.plusHintWithLimit',
      'Free plan includes up to {{count}} photo notes. Upgrade to Noto Plus for more image notes and library import.',
      { count: photoNoteLimit }
    );
  }, [photoNoteLimit, t, tier]);

  const accountHint = useMemo(() => {
    if (!isAuthAvailable) {
      return t(
        'settings.accountUnavailableMsg',
        'Account sign-in is unavailable right now. Your notes stay safely on this device.'
      );
    }

    if (!user || !syncEnabled) {
      return null;
    }

    if (syncStatus === 'syncing') {
      return t('settings.autoSyncing', 'Syncing your notes now.');
    }

    if (syncStatus === 'success' && lastSyncedAt) {
      return t('settings.lastSynced', 'Last synced {{date}}', {
        date: new Date(lastSyncedAt).toLocaleString(i18n.language, {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
    }

    if (syncStatus === 'error') {
      return (
        lastMessage ??
        t('settings.autoSyncRetry', 'We could not sync right now. We will try again when the app is active.')
      );
    }

    return t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.');
  }, [i18n.language, isAuthAvailable, lastMessage, lastSyncedAt, syncEnabled, syncStatus, t, user]);

  const promptClearAll = () => {
    showAlert({
      variant: 'error',
      title: t('settings.clearAllTitle', 'Clear All Notes'),
      message: t(
        'settings.clearAllMsg',
        'All your food notes will be permanently deleted. This action cannot be undone.'
      ),
      primaryAction: {
        label: t('common.delete', 'Delete'),
        variant: 'destructive',
        onPress: async () => {
          await deleteAllNotes();
        },
      },
      secondaryAction: {
        label: t('common.cancel', 'Cancel'),
        variant: 'secondary',
      },
    });
  };

  if (Platform.OS !== 'ios') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.androidContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', 'Settings')}</Text>

          <AndroidSection title={t('settings.preferences', 'PREFERENCES')}>
            <AndroidRow
              label={t('settings.language', 'Language')}
              value={i18n.language === 'en' ? 'English' : 'Tiếng Việt'}
            />
            <View style={styles.optionRow}>
              <PrimaryButton
                label="English"
                variant={i18n.language === 'en' ? 'neutral' : 'secondary'}
                onPress={() => {
                  void i18n.changeLanguage('en');
                }}
                style={styles.optionButton}
              />
              <PrimaryButton
                label="Tiếng Việt"
                variant={i18n.language === 'vi' ? 'neutral' : 'secondary'}
                onPress={() => {
                  void i18n.changeLanguage('vi');
                }}
                style={styles.optionButton}
              />
            </View>

            <AndroidRow label={t('settings.theme', 'Theme')} value={themeLabel} />
            <View style={styles.optionRow}>
              <PrimaryButton
                label={t('settings.system', 'System')}
                variant={theme === 'system' ? 'neutral' : 'secondary'}
                onPress={() => {
                  void setTheme('system');
                }}
                style={styles.optionButton}
              />
              <PrimaryButton
                label={t('settings.light', 'Light')}
                variant={theme === 'light' ? 'neutral' : 'secondary'}
                onPress={() => {
                  void setTheme('light');
                }}
                style={styles.optionButton}
              />
              <PrimaryButton
                label={t('settings.dark', 'Dark')}
                variant={theme === 'dark' ? 'neutral' : 'secondary'}
                onPress={() => {
                  void setTheme('dark');
                }}
                style={styles.optionButton}
              />
            </View>
          </AndroidSection>

          <AndroidSection title={t('settings.data', 'DATA')}>
            <AndroidRow label={t('settings.noteCount', 'Saved Notes')} value={`${notes.length}`} />
            <AndroidRow
              label={t('settings.clearAll', 'Clear All Notes')}
              onPress={promptClearAll}
              destructive
            />
          </AndroidSection>

          <AndroidSection title={t('settings.plusTitle', 'NOTO PLUS')}>
            <AndroidRow label={t('settings.plusPlan', 'Plan')} value={plusValue} />
            <Text style={[styles.sectionHint, { color: colors.secondaryText }]}>{plusHint}</Text>
          </AndroidSection>

          <AndroidSection title={t('settings.account', 'ACCOUNT')}>
            <AndroidRow
              label={t('settings.accountEntry', 'Account')}
              value={accountValue}
              onPress={isAuthAvailable ? openAccountScreen : undefined}
            />
            <AndroidRow
              label={t('settings.autoSync', 'Auto sync')}
              value={syncValue}
              onPress={user ? () => setShowSync(true) : undefined}
            />
            {accountHint ? (
              <Text style={[styles.sectionHint, { color: colors.secondaryText }]}>{accountHint}</Text>
            ) : null}
            {isAuthAvailable ? (
              <PrimaryButton
                label={user ? t('settings.manageAccount', 'Manage account') : t('settings.login', 'Sign In')}
                variant={user ? 'secondary' : 'neutral'}
                onPress={openAccountScreen}
              />
            ) : null}
          </AndroidSection>
        </ScrollView>
        <AppSheetAlert {...alertProps} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top + 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', 'Settings')}</Text>
      </View>
      <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          <Section title={t('settings.preferences', 'Style & Language')}>
            <Button onPress={() => setShowLanguage(true)}>
              <HStack>
                  <HStack
                    modifiers={[
                      frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                      backgroundOverlay({ color: colors.primary + '18' }),
                      cornerRadius(7),
                      padding({ trailing: 12 }),
                    ]}
                  >
                    <SwiftUIImage systemName="globe" color={colors.primary} size={18} />
                  </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.language', 'Language')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>
                  {i18n.language === 'en' ? 'English' : 'Tiếng Việt'}
                </SwiftUIText>
              </HStack>
            </Button>
            <Button onPress={() => setShowTheme(true)}>
              <HStack>
                  <HStack
                    modifiers={[
                      frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                      backgroundOverlay({ color: colors.primary + '18' }),
                      cornerRadius(7),
                      padding({ trailing: 12 }),
                    ]}
                  >
                    <SwiftUIImage systemName={isDark ? 'moon' : 'sun.max'} color={colors.primary} size={18} />
                  </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.theme', 'Theme')}</SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{themeLabel}</SwiftUIText>
              </HStack>
            </Button>
          </Section>

          <Section title={t('settings.data', 'Memory Data')}>
            <HStack>
              <HStack
                modifiers={[
                  frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                  backgroundOverlay({ color: colors.primary + '18' }),
                  cornerRadius(7),
                  padding({ trailing: 12 }),
                ]}
              >
                <SwiftUIImage systemName="doc.text" color={colors.primary} size={18} />
              </HStack>
              <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                {t('settings.noteCount', 'Saved Notes')}
              </SwiftUIText>
              <Spacer />
              <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{`${notes.length}`}</SwiftUIText>
            </HStack>
            <Button onPress={promptClearAll}>
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.danger + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage systemName="trash" color={colors.danger} size={18} />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.danger)]}>
                  {t('settings.clearAll', 'Clear All Notes')}
                </SwiftUIText>
              </HStack>
            </Button>
          </Section>

          <Section
            title={t('settings.plusTitle', 'Noto Plus')}
            footer={
              <SwiftUIText
                modifiers={[
                  foregroundStyle(colors.secondaryText),
                  font({ size: 13 }),
                  multilineTextAlignment('leading'),
                  padding({ top: 8 }),
                ]}
              >
                {plusHint} {!isPurchaseAvailable && `\n${t('settings.plusUnavailable', 'Plus is coming soon.')}`}
              </SwiftUIText>
            }
          >
            <Button onPress={() => router.push('/plus')}>
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.primary + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage systemName="sparkles" color={colors.primary} size={18} />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.plusPlan', 'Edition')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary), padding({ trailing: 4 })]}>{plusValue}</SwiftUIText>
                <SwiftUIImage systemName="chevron.right" color={colors.secondaryText} size={14} />
              </HStack>
            </Button>
          </Section>

          <Section
            title={t('settings.account', 'Backup & Sync')}
            footer={
              <HStack>
                <Spacer />
                <VStack alignment="center" modifiers={[padding({ top: 44, bottom: 44 })]}>
                  <SwiftUIText
                    modifiers={[
                      foregroundStyle(colors.text),
                      font({ size: 14, weight: 'medium' }),
                      multilineTextAlignment('center'),
                      padding({ bottom: 10 }),
                    ]}
                  >
                    {t('settings.about', 'So you never forget what she likes 💛')}
                  </SwiftUIText>
                  <HStack modifiers={[padding({ top: 4 })]}>
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.secondaryText + '99'),
                        font({ size: 11, weight: 'semibold' }),
                        multilineTextAlignment('center'),
                      ]}
                    >
                      Noto v1.0.0 · ノート
                    </SwiftUIText>
                  </HStack>
                  {accountHint ? (
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.secondaryText + '88'),
                        font({ size: 11 }),
                        multilineTextAlignment('center'),
                        padding({ top: 12 }),
                      ]}
                    >
                      {accountHint}
                    </SwiftUIText>
                  ) : null}
                </VStack>
                <Spacer />
              </HStack>
            }
          >
            {isAuthAvailable ? (
              <>
                <Button onPress={openAccountScreen}>
                  <HStack>
                    <HStack
                      modifiers={[
                        frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                        backgroundOverlay({ color: colors.primary + '18' }),
                        cornerRadius(7),
                        padding({ trailing: 12 }),
                      ]}
                    >
                      <SwiftUIImage systemName="person" color={colors.primary} size={18} />
                    </HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.accountEntry', 'Account')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{accountValue}</SwiftUIText>
                  </HStack>
                </Button>
                <Button onPress={() => setShowSync(true)}>
                  <HStack>
                    <HStack
                      modifiers={[
                        frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                        backgroundOverlay({ color: colors.primary + '18' }),
                        cornerRadius(7),
                        padding({ trailing: 12 }),
                      ]}
                    >
                      <SwiftUIImage systemName="arrow.triangle.2.circlepath" color={colors.primary} size={18} />
                    </HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.autoSync', 'Auto sync')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{syncValue}</SwiftUIText>
                  </HStack>
                </Button>
              </>
            ) : (
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.primary + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage systemName="person.crop.circle.badge.exclamationmark" color={colors.primary} size={18} />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.accountEntry', 'Account')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>
                  {accountValue}
                </SwiftUIText>
              </HStack>
            )}
          </Section>
        </List>

        <BottomSheet isPresented={showTheme} onIsPresentedChange={setShowTheme} fitToContents>
          <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
            <SettingsThemeSheet onClose={() => setShowTheme(false)} />
          </Group>
        </BottomSheet>

        <BottomSheet isPresented={showLanguage} onIsPresentedChange={setShowLanguage} fitToContents>
          <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
            <SettingsLanguageSheet onClose={() => setShowLanguage(false)} />
          </Group>
        </BottomSheet>

        <BottomSheet isPresented={showSync} onIsPresentedChange={setShowSync} fitToContents>
          <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
            <SettingsSyncSheet accountHint={accountHint} />
          </Group>
        </BottomSheet>
      </Host>
      <AppSheetAlert {...alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    ...Typography.screenTitle,
    paddingHorizontal: Layout.screenPadding,
    marginBottom: 20,
  },
  androidContent: {
    paddingHorizontal: Layout.screenPadding,
  },
  androidSection: {
    marginBottom: 24,
  },
  androidSectionTitle: {
    ...Typography.pill,
    marginBottom: 10,
  },
  androidSectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  androidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  androidRowLabel: {
    ...Typography.body,
    flex: 1,
  },
  androidRowValue: {
    ...Typography.pill,
    marginLeft: 12,
    textAlign: 'right',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    minHeight: 48,
  },
  sectionHint: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
