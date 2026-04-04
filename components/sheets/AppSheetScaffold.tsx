import { Ionicons } from '@expo/vector-icons';
import { useContext, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import AppIconButton from '../ui/AppIconButton';

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
  useHorizontalPadding?: boolean;
  contentBottomPaddingWhenFooter?: number;
  footerTopSpacing?: number;
}

function HeaderActionButton({ action }: { action?: AppSheetHeaderAction }) {
  if (!action) {
    return Platform.OS === 'android' ? null : <View style={styles.actionButtonSpacer} />;
  }

  if (Platform.OS === 'android') {
    return (
      <View style={styles.actionButtonAndroidWrap}>
        <AppIconButton
          icon={action.icon}
          accessibilityLabel={action.accessibilityLabel}
          disabled={action.disabled}
          onPress={action.onPress}
          style={[styles.actionButtonAndroid, { borderColor: 'transparent', backgroundColor: 'transparent' }]}
          testID={action.testID}
        />
      </View>
    );
  }

  return (
    <AppIconButton
      icon={action.icon}
      accessibilityLabel={action.accessibilityLabel}
      disabled={action.disabled}
      onPress={action.onPress}
      style={styles.actionButton}
      testID={action.testID}
    />
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
  useHorizontalPadding = true,
  contentBottomPaddingWhenFooter = 12,
  footerTopSpacing = 8,
}: AppSheetScaffoldProps) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const isAndroid = Platform.OS === 'android';
  const horizontalPadding =
    Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;
  const headerTopPadding =
    Platform.OS === 'ios' ? Sheet.ios.headerTopPadding : Sheet.android.headerTopPadding;
  const headerBottomSpacing =
    Platform.OS === 'ios' ? Sheet.ios.headerBottomSpacing : Sheet.android.headerBottomSpacing;
  const bottomPadding =
    Platform.OS === 'ios' ? Sheet.ios.bottomPadding : Sheet.android.bottomPadding;
  const resolvedBottomPadding =
    bottomPadding +
    (insets.bottom > 0
      ? insets.bottom
      : Platform.OS === 'android'
        ? Sheet.android.comfortBottomPadding
        : 0);
  const hasHeader =
    headerVariant !== 'none' && (Boolean(title) || Boolean(subtitle) || Boolean(headerTop));

  const content = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingHorizontal: useHorizontalPadding ? horizontalPadding : 0,
          paddingBottom: footer ? contentBottomPaddingWhenFooter : resolvedBottomPadding,
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
          paddingHorizontal: useHorizontalPadding ? horizontalPadding : 0,
          paddingBottom: footer ? contentBottomPaddingWhenFooter : resolvedBottomPadding,
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
            isAndroid ? styles.headerAndroid : null,
            {
              paddingHorizontal: horizontalPadding,
              paddingTop: headerTopPadding,
              paddingBottom: headerBottomSpacing,
            },
          ]}
        >
          {headerVariant === 'action' ? (
            <View
              style={[
                styles.actionRow,
                isAndroid && !leadingAction ? styles.actionRowAndroidTrailing : null,
              ]}
            >
              <HeaderActionButton action={leadingAction} />
              <HeaderActionButton action={trailingAction} />
            </View>
          ) : null}

          {headerTop ? <View style={styles.headerTop}>{headerTop}</View> : null}

          {title ? (
            <Text style={[styles.title, isAndroid ? styles.titleAndroid : null, { color: colors.text }]}>
              {title}
            </Text>
          ) : null}

          {subtitle ? (
            <Text style={[styles.subtitle, isAndroid ? styles.subtitleAndroid : null, { color: colors.secondaryText }]}>
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
              paddingTop: footerTopSpacing,
              paddingHorizontal: horizontalPadding,
              paddingBottom: resolvedBottomPadding,
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
  headerAndroid: {
    alignItems: 'stretch',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  actionRowAndroidTrailing: {
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexShrink: 0,
  },
  actionButtonAndroidWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonAndroid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: 'transparent',
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
  titleAndroid: {
    textAlign: 'left',
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  subtitleAndroid: {
    textAlign: 'left',
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
