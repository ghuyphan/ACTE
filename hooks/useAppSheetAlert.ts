import { useCallback, useState } from 'react';
import { AppSheetAlertAction, AppSheetAlertProps, AppSheetAlertVariant } from '../components/AppSheetAlert';

export interface ShowSheetAlertInput {
  variant?: AppSheetAlertVariant;
  title: string;
  message: string;
  primaryAction: AppSheetAlertAction;
  secondaryAction?: AppSheetAlertAction;
  dismissible?: boolean;
}

type AlertState = ShowSheetAlertInput & { visible: boolean };

const DEFAULT_STATE: AlertState = {
  visible: false,
  variant: 'info',
  title: '',
  message: '',
  primaryAction: { label: '' },
  dismissible: true,
};

export function useAppSheetAlert() {
  const [alertState, setAlertState] = useState<AlertState>(DEFAULT_STATE);

  const hideAlert = useCallback(() => {
    setAlertState((current) => ({ ...current, visible: false }));
  }, []);

  const showAlert = useCallback((nextAlert: ShowSheetAlertInput) => {
    setAlertState({
      visible: true,
      dismissible: true,
      variant: 'info',
      ...nextAlert,
    });
  }, []);

  const alertProps: AppSheetAlertProps = {
    ...alertState,
    onClose: hideAlert,
  };

  return {
    alertProps,
    showAlert,
    hideAlert,
  };
}
