import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface OfflineNoticeProps {
  title: string;
  body?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  trailing?: ReactNode;
  compact?: boolean;
}

export default function OfflineNotice({
  title,
  body,
  icon = 'cloud-offline-outline',
  trailing,
  compact = false,
}: OfflineNoticeProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.noticeSurface,
          borderColor: colors.noticeBorder,
          paddingVertical: compact ? 12 : 14,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {body ? <Text style={[styles.body, { color: colors.secondaryText }]}>{body}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  trailing: {
    marginLeft: 4,
  },
});
