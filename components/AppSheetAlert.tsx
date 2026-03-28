import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';
import PrimaryButton from './ui/PrimaryButton';

export type AppSheetAlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AppSheetAlertAction {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'neutral' | 'destructive';
}

export interface AppSheetAlertProps {
  visible: boolean;
  variant?: AppSheetAlertVariant;
  title: string;
  message: string;
  primaryAction: AppSheetAlertAction;
  secondaryAction?: AppSheetAlertAction;
  dismissible?: boolean;
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
  primaryAction,
  secondaryAction,
  onClose,
}: Omit<AppSheetAlertProps, 'visible'>) {
  const { colors } = useTheme();
  const meta = getVariantMeta(
    variant,
    variant === 'error' ? colors.danger : variant === 'success' ? colors.success : colors.primary
  );

  const runAction = async (action?: AppSheetAlertAction) => {
    onClose();
    if (action?.onPress) {
      await action.onPress();
    }
  };

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
        <PrimaryButton
          label={primaryAction.label}
          variant={primaryAction.variant ?? 'primary'}
          onPress={() => {
            void runAction(primaryAction);
          }}
          style={styles.actionButton}
        />
        {secondaryAction ? (
          <PrimaryButton
            label={secondaryAction.label}
            variant={secondaryAction.variant ?? 'secondary'}
            onPress={() => {
              void runAction(secondaryAction);
            }}
            style={styles.actionButton}
          />
        ) : null}
      </View>
    </AppSheetScaffold>
  );
}

export default function AppSheetAlert({
  visible,
  variant = 'info',
  title,
  message,
  primaryAction,
  secondaryAction,
  dismissible = true,
  onClose,
}: AppSheetAlertProps) {
  return (
    <AppSheet visible={visible} onClose={onClose} dismissible={dismissible}>
      <AlertSheetBody
        variant={variant}
        title={title}
        message={message}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
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
