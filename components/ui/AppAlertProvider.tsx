import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { AlertDialog, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
import { appAlertManager, AppAlertOptions } from '../../utils/alert';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

type AppAlertButton = NonNullable<AppAlertOptions['buttons']>[number];

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
  const defaultCancelText = t('common.cancel', 'Cancel');
  const buttons = alertState.buttons && alertState.buttons.length > 0
    ? alertState.buttons
    : [{ text: defaultOkText }];

  const dismissButton = buttons.find((button) => button.style === 'cancel');
  const nonCancelButtons = buttons.filter((button) => button.style !== 'cancel');
  const confirmButton = nonCancelButtons[nonCancelButtons.length - 1] ?? buttons[buttons.length - 1];

  const handleDismiss = () => {
    setAlertState(null);
    dismissButton?.onPress?.();
  };

  const handlePress = (button?: AppAlertButton) => {
    setAlertState(null);
    button?.onPress?.();
  };

  const dialogColors = useMemo(() => {
    return {
      containerColor: colors.card,
      titleContentColor: colors.text,
      textContentColor: colors.secondaryText,
    };
  }, [colors.card, colors.secondaryText, colors.text]);

  const dismissColor = isDark ? colors.secondaryText : colors.accent;
  const confirmColor = confirmButton?.style === 'destructive' ? colors.danger : colors.primary;

  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} matchContents>
      <AlertDialog
        colors={dialogColors}
        onDismissRequest={handleDismiss}
        tonalElevation={isDark ? 0 : 3}>
        <AlertDialog.Title>
          <Text>{alertState.title || ''}</Text>
        </AlertDialog.Title>

        {alertState.message ? (
          <AlertDialog.Text>
            <Text>{alertState.message}</Text>
          </AlertDialog.Text>
        ) : null}

        <AlertDialog.ConfirmButton>
          <TextButton
            colors={{ contentColor: confirmColor }}
            onClick={() => handlePress(confirmButton)}>
            <Text>{confirmButton?.text || defaultOkText}</Text>
          </TextButton>
        </AlertDialog.ConfirmButton>

        {dismissButton ? (
          <AlertDialog.DismissButton>
            <TextButton
              colors={{ contentColor: dismissColor }}
              onClick={() => handlePress(dismissButton)}>
              <Text>{dismissButton.text || defaultCancelText}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        ) : null}
      </AlertDialog>
    </Host>
  );
}
