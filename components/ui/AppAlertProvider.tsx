import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { appAlertManager, AppAlertOptions } from '../../utils/alert';
import { useTranslation } from 'react-i18next';
import AppSheetAlert, { type AppSheetAlertAction } from '../sheets/AppSheetAlert';

type AppAlertButton = NonNullable<AppAlertOptions['buttons']>[number];

export function AppAlertProvider() {
  const { t } = useTranslation();
  const [alertState, setAlertState] = useState<AppAlertOptions | null>(null);

  useEffect(() => {
    appAlertManager.listener = (state) => {
      setAlertState(state);
    };

    return () => {
      appAlertManager.listener = null;
    };
  }, []);

  if (Platform.OS !== 'android') {
    return null;
  }

  if (!alertState) {
    return null;
  }

  const defaultOkText = t('common.ok', 'OK');
  const buttons =
    alertState.buttons && alertState.buttons.length > 0 ? alertState.buttons : [{ text: defaultOkText }];

  const dismissButton = buttons.find((button) => button.style === 'cancel') ?? null;
  const nonCancelButtons = buttons.filter((button) => button.style !== 'cancel');
  const hasDestructiveAction = buttons.some((button) => button.style === 'destructive');

  const handlePress = (button?: AppAlertButton) => {
    button?.onPress?.();
    setAlertState((current) => (current === alertState ? null : current));
  };

  const handleDismiss = () => {
    setAlertState(null);
  };

  const mappedNonCancelActions: AppSheetAlertAction[] = nonCancelButtons.map((button, index) => {
    const variant: AppSheetAlertAction['variant'] =
      button.style === 'destructive'
        ? 'destructive'
        : index === nonCancelButtons.length - 1
          ? 'primary'
          : 'secondary';

    return {
      label: button.text || defaultOkText,
      variant,
      onPress: () => {
        handlePress(button);
      },
    };
  });

  const actions = dismissButton
    ? [
        ...mappedNonCancelActions,
        {
          label: dismissButton.text || t('common.cancel', 'Cancel'),
          variant: 'secondary' as const,
          onPress: () => {
            handlePress(dismissButton);
          },
        },
      ]
    : mappedNonCancelActions;

  return (
    <AppSheetAlert
      visible
      variant={hasDestructiveAction ? 'error' : 'info'}
      title={alertState.title || ''}
      message={alertState.message || ''}
      actions={actions}
      dismissible={Boolean(dismissButton) || buttons.length <= 1}
      closeOnAction={false}
      onClose={handleDismiss}
    />
  );
}
