import React, { useEffect, useMemo, useState } from 'react';
import { Platform, processColor, type ColorValue } from 'react-native';
import { AlertDialog, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
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
  const dialogColors = useMemo(() => {
    return {
      containerColor: toComposeColor(colors.background),
      iconContentColor: toComposeColor(colors.primary),
      titleContentColor: toComposeColor(colors.text),
      textContentColor: toComposeColor(colors.secondaryText),
    };
  }, [colors.background, colors.primary, colors.secondaryText, colors.text]);

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

  const dismissButtonColors = {
    containerColor: toComposeColor(colors.primarySoft),
    contentColor: toComposeColor(colors.primary),
  };
  const confirmButtonTextColor = isDark ? colors.background : '#2B2621';
  const confirmButtonColors = {
    containerColor: toComposeColor(colors.primary),
    contentColor: toComposeColor(confirmButtonTextColor),
  };

  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} matchContents>
      <AlertDialog
        colors={dialogColors}
        onDismissRequest={dismissButton ? () => handlePress(dismissButton) : handleDismiss}
        tonalElevation={0}
      >
        <AlertDialog.Title>
          <Text color={colors.text}>{alertState.title || ''}</Text>
        </AlertDialog.Title>
        {alertState.message ? (
          <AlertDialog.Text>
            <Text color={colors.secondaryText}>{alertState.message}</Text>
          </AlertDialog.Text>
        ) : null}
        {dismissButton ? (
          <AlertDialog.DismissButton>
            <TextButton colors={dismissButtonColors} onClick={() => handlePress(dismissButton)}>
              <Text color={colors.primary}>{dismissButton.text || t('common.cancel', 'Cancel')}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        ) : null}
        <AlertDialog.ConfirmButton>
          <TextButton colors={confirmButtonColors} onClick={() => handlePress(confirmButton)}>
            <Text color={confirmButtonTextColor}>{confirmButton?.text || defaultOkText}</Text>
          </TextButton>
        </AlertDialog.ConfirmButton>
      </AlertDialog>
    </Host>
  );
}
