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
  const visibleRef = useRef(false);

  const runCurrentClose = useCallback(() => {
    const onClose = onCloseRef.current;
    onCloseRef.current = undefined;
    onClose?.();
  }, []);

  const hideAlert = useCallback(() => {
    if (!visibleRef.current && !onCloseRef.current) {
      return;
    }

    visibleRef.current = false;
    runCurrentClose();
    setAlertState((current) => ({
      ...current,
      visible: false,
      onClose: undefined,
    }));
  }, [runCurrentClose]);

  const showAlert = useCallback((nextAlert: ShowSheetAlertInput) => {
    if (visibleRef.current) {
      runCurrentClose();
    }

    visibleRef.current = true;
    onCloseRef.current = nextAlert.onClose;
    setAlertState({
      visible: true,
      dismissible: true,
      variant: 'info',
      ...nextAlert,
    });
  }, [runCurrentClose]);

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
