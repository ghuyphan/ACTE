import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Host, AlertDialog } from '@expo/ui/jetpack-compose';
import { appAlertManager, AppAlertOptions } from '../../utils/alert';
import { useTranslation } from 'react-i18next';

export function AppAlertProvider() {
  const { t } = useTranslation();
  const [alertState, setAlertState] = useState<AppAlertOptions | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
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

  const handleDismiss = () => {
    setAlertState(null);
    const cancelBtn = alertState.buttons?.find(b => b.style === 'cancel');
    if (cancelBtn?.onPress) {
      cancelBtn.onPress();
    }
  };

  const handlePress = (onPress?: () => void) => {
    setAlertState(null);
    if (onPress) onPress();
  };

  const defaultOkText = t('common.ok', 'OK');
  const defaultCancelText = t('common.cancel', 'Cancel');
  
  const buttons = alertState.buttons && alertState.buttons.length > 0 
    ? alertState.buttons 
    : [{ text: defaultOkText }];

  const isCancel = (btn: any) => btn?.style === 'cancel';

  let confirmBtn = buttons.find(b => !isCancel(b));
  let dismissBtn = buttons.find(b => isCancel(b)); 

  // If no explicit cancel, and we have > 1 button, assume the last is confirm, first is dismiss or vice-versa
  // RN Alert conventions: 
  // [cancel, ok] is common.
  if (!confirmBtn && buttons.length > 0) confirmBtn = buttons[0];
  if (!dismissBtn && buttons.length > 1) {
      // Find the first button that isn't the confirm button
      dismissBtn = buttons.find(b => b !== confirmBtn);
  }

  // To prevent null ref errors during animation/dismount
  const title = alertState.title || '';
  const message = alertState.message;

  return (
    <Host matchContents>
      <AlertDialog
        visible={true}
        onDismissPressed={handleDismiss}
        onConfirmPressed={() => handlePress(confirmBtn?.onPress)}
        title={title}
        text={message}
        confirmButtonText={confirmBtn?.text || defaultOkText}
        dismissButtonText={dismissBtn?.text || defaultCancelText}
      />
    </Host>
  );
}
