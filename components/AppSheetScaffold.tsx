import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export type AppSheetHeaderVariant = 'standard' | 'action' | 'none';

export interface AppSheetHeaderAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}

export interface AppSheetScaffoldProps {
  children: ReactNode;
  headerVariant?: AppSheetHeaderVariant;
  title?: string;
  subtitle?: string;
  leadingAction?: AppSheetHeaderAction;
  trailingAction?: AppSheetHeaderAction;
  scrollable?: boolean;
  footer?: ReactNode;
  headerTop?: ReactNode;
  contentContainerStyle?: React.ComponentProps<typeof View>['style'];
  style?: React.ComponentProps<typeof View>['style'];
}

function HeaderActionButton({ action }: { action?: AppSheetHeaderAction }) {
  const { colors } = useTheme();

  if (!action) {
    return <View style={styles.actionButtonSpacer} />;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      disabled={action.disabled}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: action.disabled ? 0.45 : pressed ? 0.82 : 1,
        },
      ]}
      testID={action.testID}
    >
      <Ionicons name={action.icon} size={18} color={colors.text} />
    </Pressable>
  );
}

export default function AppSheetScaffold({
  children,
  headerVariant = 'none',
  title,
  subtitle,
  leadingAction,
  trailingAction,
  scrollable = false,
  footer,
  headerTop,
  contentContainerStyle,
  style,
}: AppSheetScaffoldProps) {
  const { colors } = useTheme();
  const horizontalPadding =
    Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;
  const headerTopPadding =
    Platform.OS === 'ios' ? Sheet.ios.headerTopPadding : Sheet.android.headerTopPadding;
  const headerBottomSpacing =
    Platform.OS === 'ios' ? Sheet.ios.headerBottomSpacing : Sheet.android.headerBottomSpacing;
  const bottomPadding =
    Platform.OS === 'ios' ? Sheet.ios.bottomPadding : Sheet.android.bottomPadding;
  const hasHeader =
    headerVariant !== 'none' && (Boolean(title) || Boolean(subtitle) || Boolean(headerTop));

  const content = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: footer ? 12 : bottomPadding,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.body,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: footer ? 12 : bottomPadding,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.container, { maxHeight: Sheet.maxHeight }, style]}>
      {hasHeader ? (
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: horizontalPadding,
              paddingTop: headerTopPadding,
              paddingBottom: headerBottomSpacing,
            },
          ]}
        >
          {headerVariant === 'action' ? (
            <View style={styles.actionRow}>
              <HeaderActionButton action={leadingAction} />
              <HeaderActionButton action={trailingAction} />
            </View>
          ) : null}

          {headerTop ? <View style={styles.headerTop}>{headerTop}</View> : null}

          {title ? (
            <Text style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>
          ) : null}

          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      {content}

      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: bottomPadding,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSpacer: {
    width: 44,
    height: 44,
  },
  headerTop: {
    marginBottom: 14,
  },
  title: {
    ...Typography.screenTitle,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  body: {
    width: '100%',
  },
  scrollContent: {
    width: '100%',
  },
  footer: {
    width: '100%',
    paddingTop: 8,
  },
});
