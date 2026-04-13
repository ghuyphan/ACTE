import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ThemeColors } from '../../hooks/useTheme';
import PrimaryButton from '../ui/PrimaryButton';

interface StartupErrorViewProps {
  colors: ThemeColors;
  isRecovering: boolean;
  onRetry: () => void;
  onResetLocalData: () => void;
  startupError: string;
}

export default function StartupErrorView({
  colors,
  isRecovering,
  onRetry,
  onResetLocalData,
  startupError,
}: StartupErrorViewProps) {
  const { t } = useTranslation();
  const startupErrorMessage =
    startupError === 'database-reset-failed'
      ? t(
          'startup.databaseResetFailed',
          'Noto could not reset its local database. Please restart the app and try again.'
        )
      : t(
          'startup.databaseInitFailed',
          'Noto could not open its local database. Please restart the app and try again.'
        );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
        {t('common.error', 'Something went wrong')}
      </Text>
      <Text style={{ color: colors.secondaryText, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
        {startupErrorMessage}
      </Text>
      <Text style={{ color: colors.secondaryText, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
        {t(
          'startup.resetLocalDataHint',
          'Reset local data only if retrying does not help. Synced content can come back after sign-in.'
        )}
      </Text>
      <View style={{ width: '100%', maxWidth: 320, gap: 12, marginTop: 24 }}>
        <PrimaryButton
          label={t('startup.retryAction', 'Try again')}
          onPress={onRetry}
          loading={isRecovering}
          disabled={isRecovering}
          testID="startup-retry-button"
        />
        <PrimaryButton
          label={t('startup.resetLocalDataAction', 'Reset local data')}
          onPress={onResetLocalData}
          disabled={isRecovering}
          variant="secondary"
          testID="startup-reset-data-button"
        />
      </View>
      {isRecovering ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.secondaryText, fontSize: 13, textAlign: 'center' }}>
            {t('startup.recoveryInProgress', 'Trying to recover your local data...')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
