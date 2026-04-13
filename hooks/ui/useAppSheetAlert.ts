import { useCallback, useRef, useState } from 'react';
import { AppSheetAlertAction, AppSheetAlertProps, AppSheetAlertVariant } from '../../components/sheets/AppSheetAlert';

export interface ShowSheetAlertInput {
  variant?: AppSheetAlertVariant;
  title: string;
  message: string;
  primaryAction: AppSheetAlertAction;
  secondaryAction?: AppSheetAlertAction;
  dismissible?: boolean;
  onClose?: () => void;
}

type AlertState = ShowSheetAlertInput & { visible: boolean };

const DEFAULT_STATE: AlertState = {
  visible: false,
  variant: 'info',
  title: '',
  message: '',
  primaryAction: { label: '' },
  dismissible: true,
  onClose: undefined,
};

export function useAppSheetAlert() {
  const [alertState, setAlertState] = useState<AlertState>(DEFAULT_STATE);
  const onCloseRef = useRef<ShowSheetAlertInput['onClose']>(undefined);

  const hideAlert = useCallback(() => {
    const onClose = onCloseRef.current;
    onCloseRef.current = undefined;
    setAlertState((current) => ({
      ...current,
      visible: false,
      onClose: undefined,
    }));
    onClose?.();
  }, []);

  const showAlert = useCallback((nextAlert: ShowSheetAlertInput) => {
    onCloseRef.current = nextAlert.onClose;
    setAlertState({
      visible: true,
      dismissible: true,
      variant: 'info',
      ...nextAlert,
    });
  }, []);

  const { onClose: _onClose, ...restAlertState } = alertState;

  const alertProps: AppSheetAlertProps = {
    ...restAlertState,
    onClose: hideAlert,
  };

  return {
    alertProps,
    showAlert,
    hideAlert,
  };
}
