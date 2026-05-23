import { useTranslation } from 'react-i18next';
import AppSheetAlert from '../sheets/AppSheetAlert';

type AppUpdatePromptSheetProps = {
  visible: boolean;
  isRestarting: boolean;
  onDismiss: () => void;
  onRestart: () => void;
};

export default function AppUpdatePromptSheet({
  visible,
  isRestarting,
  onDismiss,
  onRestart,
}: AppUpdatePromptSheetProps) {
  const { t } = useTranslation();

  return (
    <AppSheetAlert
      visible={visible}
      variant="success"
      title={t('updates.readyTitle', 'Update ready')}
      message={t(
        'updates.readyBody',
        'A fresh version of Noto has downloaded. Restart now to use the latest fixes and polish.'
      )}
      actions={[
        {
          label: isRestarting
            ? t('updates.restartingAction', 'Restarting...')
            : t('updates.restartAction', 'Restart now'),
          onPress: onRestart,
          variant: 'primary',
          closeOnPress: false,
        },
        {
          label: t('updates.laterAction', 'Later'),
          onPress: onDismiss,
          variant: 'secondary',
        },
      ]}
      closeOnAction={false}
      dismissible={!isRestarting}
      onClose={onDismiss}
    />
  );
}
