import React, { useEffect, useState } from 'react';
import { Platform, processColor, type ColorValue } from 'react-native';
import { AlertDialog, Host } from '@expo/ui/jetpack-compose';
import { appAlertManager, AppAlertOptions } from '../../utils/alert';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

type AppAlertButton = NonNullable<AppAlertOptions['buttons']>[number];

function toComposeColor(color: string): ColorValue {
  return (processColor(color) ?? color) as unknown as ColorValue;
}

export function AppAlertProvider() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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

  const dismissButton = buttons.find((button) => button.style === 'cancel');
  const nonCancelButtons = buttons.filter((button) => button.style !== 'cancel');
  const confirmButton = nonCancelButtons[nonCancelButtons.length - 1] ?? buttons[buttons.length - 1];
  const secondaryButton = dismissButton && dismissButton !== confirmButton ? dismissButton : undefined;

  const handlePress = (button?: AppAlertButton) => {
    setAlertState(null);
    button?.onPress?.();
  };

  const handleDismiss = () => {
    if (secondaryButton) {
      handlePress(secondaryButton);
      return;
    }

    setAlertState(null);
  };

  const dismissButtonColors = {
    containerColor: toComposeColor(colors.primarySoft),
    contentColor: toComposeColor(colors.primary),
  };
  const confirmButtonTextColor = isDark ? colors.background : '#2B2621';
  const confirmButtonBackgroundColor = confirmButton?.style === 'destructive' ? colors.danger : colors.primary;
  const confirmButtonColors = {
    containerColor: toComposeColor(confirmButtonBackgroundColor),
    contentColor: toComposeColor(confirmButtonTextColor),
  };

  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} matchContents>
      <AlertDialog
        visible
        title={alertState.title || ''}
        text={alertState.message}
        confirmButtonText={confirmButton?.text || defaultOkText}
        dismissButtonText={secondaryButton?.text}
        confirmButtonColors={confirmButtonColors}
        dismissButtonColors={secondaryButton ? dismissButtonColors : undefined}
        onConfirmPressed={() => handlePress(confirmButton)}
        onDismissPressed={handleDismiss}
      />
    </Host>
  );
}
