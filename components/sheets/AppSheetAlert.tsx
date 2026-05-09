import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';
import PrimaryButton from '../ui/PrimaryButton';

export type AppSheetAlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AppSheetAlertAction {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'neutral' | 'destructive';
  closeOnPress?: boolean;
}

export interface AppSheetAlertProps {
  visible: boolean;
  variant?: AppSheetAlertVariant;
  title: string;
  message: string;
  primaryAction?: AppSheetAlertAction;
  secondaryAction?: AppSheetAlertAction;
  actions?: AppSheetAlertAction[];
  dismissible?: boolean;
  closeOnAction?: boolean;
  onClose: () => void;
}

function getVariantMeta(variant: AppSheetAlertVariant, accent: string) {
  if (variant === 'success') {
    return { icon: 'checkmark-circle' as const, tint: accent };
  }
  if (variant === 'warning') {
    return { icon: 'notifications-off' as const, tint: accent };
  }
  if (variant === 'error') {
    return { icon: 'alert-circle' as const, tint: accent };
  }
  return { icon: 'information-circle' as const, tint: accent };
}

function AlertSheetBody({
  variant = 'info',
  title,
  message,
  actions,
  primaryAction,
  secondaryAction,
  closeOnAction = true,
  onClose,
}: Omit<AppSheetAlertProps, 'visible'>) {
  const { colors } = useTheme();
  const actionInFlightRef = useRef(false);
  const [busyActionIndex, setBusyActionIndex] = useState<number | null>(null);
  const meta = getVariantMeta(
    variant,
    variant === 'error' ? colors.danger : variant === 'success' ? colors.success : colors.primary
  );

  const runAction = async (action?: AppSheetAlertAction, index?: number) => {
    if (actionInFlightRef.current) {
      return;
    }

    actionInFlightRef.current = true;
    const shouldClose = action?.closeOnPress ?? closeOnAction;
    const shouldShowBusy = !shouldClose;
    if (shouldShowBusy) {
      setBusyActionIndex(index ?? null);
    }
    if (shouldClose) {
      onClose();
    }

    try {
      if (action?.onPress) {
        await action.onPress();
      }
    } finally {
      actionInFlightRef.current = false;
      if (shouldShowBusy) {
        setBusyActionIndex(null);
      }
    }
  };
  const resolvedActions =
    actions && actions.length > 0
      ? actions
      : ([primaryAction, secondaryAction].filter(Boolean) as AppSheetAlertAction[]);

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={title}
      subtitle={message}
      headerTop={
        <View style={[styles.iconBadge, { backgroundColor: `${meta.tint}18` }]}>
          <Ionicons name={meta.icon} size={24} color={meta.tint} />
        </View>
      }
    >
      <View style={styles.actions}>
        {resolvedActions.map((action, index) => (
          <PrimaryButton
            key={`${action.label}-${action.variant ?? 'primary'}-${index}`}
            label={action.label}
            variant={action.variant ?? 'primary'}
            onPress={() => {
              void runAction(action, index);
            }}
            loading={busyActionIndex === index}
            disabled={busyActionIndex !== null}
            style={styles.actionButton}
          />
        ))}
      </View>
    </AppSheetScaffold>
  );
}

export default function AppSheetAlert({
  visible,
  variant = 'info',
  title,
  message,
  actions,
  primaryAction,
  secondaryAction,
  dismissible = true,
  closeOnAction = true,
  onClose,
}: AppSheetAlertProps) {
  return (
    <AppSheet visible={visible} onClose={onClose} dismissible={dismissible}>
      <AlertSheetBody
        variant={variant}
        title={title}
        message={message}
        actions={actions}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        closeOnAction={closeOnAction}
        onClose={onClose}
      />
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    width: '100%',
  },
});
