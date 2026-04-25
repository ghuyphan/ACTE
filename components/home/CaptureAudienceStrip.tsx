import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { TFunction } from 'i18next';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { FriendConnection } from '../../services/sharedFeedService';
import CaptureFooterFrame from './CaptureFooterFrame';

interface CaptureAudienceStripProps {
  friends: FriendConnection[];
  selectedFriendUid: string | null;
  onSelectFriendUid: (friendUid: string | null) => void;
  t: TFunction;
}

type AudienceItem = {
  id: string;
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  isAllChip: boolean;
  avatarPhotoUrl?: string | null;
  avatarLabel?: string;
};

interface AudienceChipProps {
  id: string;
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  avatarPhotoUrl?: string | null;
  avatarLabel?: string;
  isAllChip?: boolean;
  onSelectFriendUid: (friendUid: string | null) => void;
}

function getFriendLabel(friend: FriendConnection, fallback: string) {
  const username = friend.username?.trim();
  if (username) {
    return `@${username.replace(/^@+/, '')}`;
  }

  const displayName = friend.displayNameSnapshot?.trim();
  if (displayName) {
    return displayName.split(/\s+/)[0] ?? displayName;
  }

  return fallback;
}

const AudienceChip = memo(function AudienceChip({
  id,
  label,
  selected,
  accessibilityLabel,
  avatarPhotoUrl = null,
  avatarLabel = '',
  isAllChip = false,
  onSelectFriendUid,
}: AudienceChipProps) {
  const { colors, isDark } = useTheme();
  const inactiveAvatarBackground = isDark ? colors.chromeSurface : colors.glassBackdrop;
  const inactiveAvatarBorder = isDark ? colors.chromeBorder : colors.border;
  const handlePress = useCallback(() => {
    onSelectFriendUid(isAllChip ? null : id);
  }, [id, isAllChip, onSelectFriendUid]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        {
          opacity: pressed ? 0.72 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.avatarWrap,
          {
            backgroundColor: selected ? `${colors.primary}1A` : inactiveAvatarBackground,
            borderColor: selected ? colors.primary : inactiveAvatarBorder,
          },
        ]}
      >
        {isAllChip ? (
          <View
            style={[
              styles.allChipAvatar,
              {
                backgroundColor: selected ? colors.primary : 'transparent',
                borderColor: selected ? `${colors.primary}66` : 'transparent',
              },
            ]}
          >
            <Ionicons
              name="people"
              size={14}
              color={selected ? '#1C1C1E' : colors.captureGlassText}
            />
          </View>
        ) : avatarPhotoUrl ? (
          <Image source={{ uri: avatarPhotoUrl }} style={styles.friendAvatar} contentFit="cover" />
        ) : (
          <View
            style={[
              styles.friendAvatar,
              {
                backgroundColor: selected ? colors.primarySoft : 'rgba(255,255,255,0.08)',
              },
            ]}
          >
            <Text
              style={[
                styles.friendAvatarLabel,
                {
                  color: selected ? colors.primary : colors.captureGlassText,
                },
              ]}
            >
              {avatarLabel}
            </Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.chipLabel,
          {
            color: selected ? colors.primary : colors.captureGlassText,
            opacity: selected ? 1 : 0.82,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

function CaptureAudienceStrip({
  friends,
  selectedFriendUid,
  onSelectFriendUid,
  t,
}: CaptureAudienceStripProps) {
  const friendFallback = t('shared.friendFallback', 'Friend');
  const audienceItems = useMemo<AudienceItem[]>(
    () => [
      {
        id: 'all',
        label: t('capture.shareAudienceAll', 'All'),
        accessibilityLabel: t('capture.shareAudienceAllA11y', 'Share with all friends'),
        selected: selectedFriendUid == null,
        isAllChip: true,
      },
      ...friends.map((friend) => {
        const label = getFriendLabel(friend, friendFallback);
        return {
          id: friend.userId,
          label,
          accessibilityLabel: t('capture.shareAudienceFriendA11y', 'Share with {{name}}', {
            name: label,
          }),
          selected: selectedFriendUid === friend.userId,
          isAllChip: false,
          avatarPhotoUrl: friend.photoURLSnapshot,
          avatarLabel: label.charAt(0).toUpperCase(),
        };
      }),
    ],
    [friendFallback, friends, selectedFriendUid, t]
  );

  return (
    <CaptureFooterFrame>
      <View style={styles.container}>
        <ScrollView
          horizontal
          style={styles.audienceScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="handled"
        >
          {audienceItems.map((item) => (
            <AudienceChip
              id={item.id}
              key={item.id}
              label={item.label}
              selected={item.selected}
              accessibilityLabel={item.accessibilityLabel}
              avatarPhotoUrl={item.isAllChip ? null : item.avatarPhotoUrl}
              avatarLabel={item.isAllChip ? undefined : item.avatarLabel}
              isAllChip={item.isAllChip}
              onSelectFriendUid={onSelectFriendUid}
            />
          ))}
        </ScrollView>
      </View>
    </CaptureFooterFrame>
  );
}

export default memo(CaptureAudienceStrip);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: '88%',
  },
  row: {
    alignItems: 'center',
    paddingRight: 12,
    gap: 10,
  },
  chip: {
    width: 58,
    alignItems: 'center',
    gap: 5,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  allChipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  chipLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
    width: '100%',
  },
});
