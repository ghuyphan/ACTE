import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Layout, Shadows, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { isOlderIOS } from '../utils/platform';
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
    <View
      style={[
        styles.sheetCard,
        {
          backgroundColor: isOlderIOS ? colors.card : 'transparent',
        },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: `${meta.tint}18` }]}>
        <Ionicons name={meta.icon} size={24} color={meta.tint} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.secondaryText }]}>{message}</Text>
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
    </View>
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
  const { colors, isDark } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <View pointerEvents={visible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
        <Host style={StyleSheet.absoluteFill} colorScheme={isDark ? 'dark' : 'light'}>
          <BottomSheet isPresented={visible} onIsPresentedChange={(next) => (!next ? onClose() : null)} fitToContents>
            <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
              <RNHostView matchContents>
                <View
                  style={[
                    styles.iosContainer,
                    isOlderIOS
                      ? {
                          backgroundColor: colors.card,
                          borderTopLeftRadius: 10,
                          borderTopRightRadius: 10,
                        }
                      : null,
                  ]}
                >
                  <AlertSheetBody
                    variant={variant}
                    title={title}
                    message={message}
                    primaryAction={primaryAction}
                    secondaryAction={secondaryAction}
                    onClose={onClose}
                  />
                </View>
              </RNHostView>
            </Group>
          </BottomSheet>
        </Host>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismissible ? onClose : undefined} />
        <View style={[styles.androidSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AlertSheetBody
            variant={variant}
            title={title}
            message={message}
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
            onClose={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iosContainer: {
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: Layout.screenPadding,
  },
  androidSheet: {
    borderRadius: 24,
    borderWidth: 1,
    paddingBottom: 8,
    ...Shadows.floating,
  },
  sheetCard: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    borderRadius: 24,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    ...Typography.screenTitle,
    marginBottom: 10,
  },
  message: {
    ...Typography.body,
    marginBottom: 24,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    width: '100%',
  },
});
