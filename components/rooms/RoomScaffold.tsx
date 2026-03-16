import { ReactNode } from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Radii, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface RoomScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

interface RoomHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  footer?: ReactNode;
}

interface RoomCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface RoomSectionProps {
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function RoomScreen({
  children,
  scroll = false,
  contentContainerStyle,
  style,
}: RoomScreenProps) {
  const { colors } = useTheme();

  const content = <View style={[styles.content, contentContainerStyle]}>{children}</View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, style]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

export function RoomHeader({ title, subtitle, trailing, footer }: RoomHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.headerTrailing}>{trailing}</View> : null}
      </View>
      {footer ? <View style={styles.headerFooter}>{footer}</View> : null}
    </View>
  );
}

export function RoomCard({ children, style }: RoomCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function RoomSection({ title, children, style }: RoomSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={style}>
      {title ? <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  header: {
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  headerTrailing: {
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    ...Typography.body,
    marginTop: 6,
  },
  headerFooter: {
    marginTop: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
});
