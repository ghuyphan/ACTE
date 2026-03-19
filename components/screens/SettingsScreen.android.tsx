import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppSheetAlert from '../AppSheetAlert';
import SettingsLanguageSheet from '../SettingsLanguageSheet';
import SettingsSyncSheet from '../SettingsSyncSheet';
import SettingsThemeSheet from '../SettingsThemeSheet';
import PrimaryButton from '../ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import type { ThemeColors } from '../../hooks/useTheme';
import { useSettingsScreenModel } from './useSettingsScreenModel';

function AndroidSection({
  children,
  colors,
  title,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function AndroidRow({
  colors,
  destructive = false,
  label,
  onPress,
  value,
}: {
  colors: ThemeColors;
  destructive?: boolean;
  label: string;
  onPress?: () => void;
  value?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { opacity: 0.75 } : null,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.rowLabel, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {value ? (
          <Text
            style={[
              styles.rowValue,
              { color: destructive ? colors.danger : colors.primary },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} /> : null}
      </View>
    </Pressable>
  );
}

function AndroidModalSheet({
  children,
  colors,
  onClose,
  visible,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  onClose: () => void;
  visible: boolean;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['45%'], []);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      return;
    }

    modalRef.current?.dismiss();
  }, [visible]);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enableDynamicSizing
      enablePanDownToClose
      android_keyboardInputMode="adjustResize"
      onDismiss={onClose}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.32} />
      )}
      handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: colors.secondaryText + '55' }]}
      backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.surface }]}
    >
      <BottomSheetView style={[styles.sheetContent, { borderTopColor: colors.border }]}>
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

export default function SettingsScreenAndroid() {
  const {
    accountHint,
    accountValue,
    alertProps,
    colors,
    i18n,
    insets,
    isAuthAvailable,
    isPurchaseAvailable,
    notes,
    openAccountScreen,
    openPlusScreen,
    plusHint,
    plusValue,
    promptClearAll,
    setShowLanguage,
    setShowSync,
    setShowTheme,
    showLanguage,
    showSync,
    showTheme,
    syncValue,
    t,
    themeLabel,
    tier,
    user,
  } = useSettingsScreenModel();

  return (
    <BottomSheetModalProvider>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', 'Settings')}</Text>

          <AndroidSection colors={colors} title={t('settings.preferences', 'PREFERENCES')}>
            <AndroidRow
              colors={colors}
              label={t('settings.language', 'Language')}
              value={i18n.language === 'en' ? 'English' : 'Tiếng Việt'}
              onPress={() => setShowLanguage(true)}
            />
            <AndroidRow
              colors={colors}
              label={t('settings.theme', 'Theme')}
              value={themeLabel}
              onPress={() => setShowTheme(true)}
            />
          </AndroidSection>

          <AndroidSection colors={colors} title={t('settings.data', 'DATA')}>
            <AndroidRow colors={colors} label={t('settings.noteCount', 'Saved Notes')} value={`${notes.length}`} />
            <AndroidRow
              colors={colors}
              label={t('settings.clearAll', 'Clear All Notes')}
              onPress={promptClearAll}
              destructive
            />
          </AndroidSection>

          <AndroidSection colors={colors} title={t('settings.plusTitle', 'NOTO PLUS')}>
            <AndroidRow
              colors={colors}
              label={t('settings.plusPlan', 'Plan')}
              value={plusValue}
              onPress={openPlusScreen}
            />
            <Text style={[styles.sectionHint, { color: colors.secondaryText }]}>{plusHint}</Text>
            <PrimaryButton
              label={tier === 'plus' ? t('settings.plusTitle', 'Noto Plus') : t('plus.cta', 'Upgrade to Plus')}
              variant="secondary"
              onPress={openPlusScreen}
            />
            {!isPurchaseAvailable ? (
              <Text style={[styles.availabilityHint, { color: colors.secondaryText }]}>
                {t('settings.plusUnavailable', 'Plus is coming soon to this build.')}
              </Text>
            ) : null}
          </AndroidSection>

          <AndroidSection colors={colors} title={t('settings.account', 'ACCOUNT')}>
            <AndroidRow
              colors={colors}
              label={t('settings.accountEntry', 'Account')}
              value={accountValue}
              onPress={isAuthAvailable ? openAccountScreen : undefined}
            />
            <AndroidRow
              colors={colors}
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

        <AndroidModalSheet colors={colors} visible={showTheme} onClose={() => setShowTheme(false)}>
          <SettingsThemeSheet onClose={() => setShowTheme(false)} />
        </AndroidModalSheet>

        <AndroidModalSheet colors={colors} visible={showLanguage} onClose={() => setShowLanguage(false)}>
          <SettingsLanguageSheet onClose={() => setShowLanguage(false)} />
        </AndroidModalSheet>

        <AndroidModalSheet colors={colors} visible={showSync} onClose={() => setShowSync(false)}>
          <SettingsSyncSheet accountHint={accountHint} />
        </AndroidModalSheet>

        <AppSheetAlert {...alertProps} />
      </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
  },
  title: {
    ...Typography.screenTitle,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...Typography.pill,
    marginBottom: 10,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    ...Typography.body,
    flex: 1,
    paddingRight: 12,
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%',
  },
  rowValue: {
    ...Typography.pill,
    marginRight: 6,
    textAlign: 'right',
  },
  sectionHint: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  availabilityHint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'System',
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
