import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { TFunction } from 'i18next';
import { memo, useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';
import type { FriendConnection } from '../../services/sharedFeedService';

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
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  avatarPhotoUrl?: string | null;
  avatarLabel?: string;
  isAllChip?: boolean;
  onPress: () => void;
}

const AnimatedText = Reanimated.createAnimatedComponent(Text);

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
  label,
  selected,
  accessibilityLabel,
  avatarPhotoUrl = null,
  avatarLabel = '',
  isAllChip = false,
  onPress,
}: AudienceChipProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const activeProgress = useSharedValue(selected ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    activeProgress.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotionEnabled ? 0 : 180,
    });
  }, [activeProgress, reduceMotionEnabled, selected]);

  const animatedChipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const animatedAvatarWrapStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [
        isDark ? 'rgba(255,247,232,0.07)' : 'rgba(255,255,255,0.56)',
        `${colors.primary}1A`,
      ]
    ),
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [
        isDark ? 'rgba(255,255,255,0.12)' : 'rgba(113,86,26,0.12)',
        colors.primary,
      ]
    ),
    transform: [
      {
        scale: reduceMotionEnabled
          ? 1
          : activeProgress.value > 0.5
            ? 1.04
            : 1,
      },
    ],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      [colors.captureGlassText, colors.primary]
    ),
    opacity: withTiming(activeProgress.value > 0 ? 1 : 0.82, {
      duration: reduceMotionEnabled ? 0 : 140,
    }),
  }));

  return (
    <View style={styles.chipShell}>
      <Reanimated.View style={[styles.chip, animatedChipStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          onPressIn={() => {
            pressScale.value = withSpring(0.95, {
              damping: 20,
              stiffness: 320,
              mass: 0.5,
            });
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, {
              damping: 20,
              stiffness: 320,
              mass: 0.5,
            });
          }}
          style={styles.pressable}
        >
          <Reanimated.View style={[styles.avatarWrap, animatedAvatarWrapStyle]}>
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
          </Reanimated.View>
          <AnimatedText numberOfLines={1} style={[styles.chipLabel, animatedLabelStyle]}>
            {label}
          </AnimatedText>
        </Pressable>
      </Reanimated.View>
    </View>
  );
});

function CaptureAudienceStrip({
  friends,
  selectedFriendUid,
  onSelectFriendUid,
  t,
}: CaptureAudienceStripProps) {
  const { colors } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
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
    <Reanimated.View
      entering={reduceMotionEnabled ? undefined : FadeInDown.duration(200)}
      exiting={reduceMotionEnabled ? undefined : FadeOutUp.duration(120)}
      style={styles.container}
    >
      <Text style={[styles.label, { color: colors.captureGlassPlaceholder }]}>
        {t('capture.shareAudienceLabel', 'Share with')}
      </Text>
      <FlatList
        horizontal
        data={audienceItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AudienceChip
            label={item.label}
            selected={item.selected}
            accessibilityLabel={item.accessibilityLabel}
            avatarPhotoUrl={item.isAllChip ? null : item.avatarPhotoUrl}
            avatarLabel={item.isAllChip ? undefined : item.avatarLabel}
            isAllChip={item.isAllChip}
            onPress={() => onSelectFriendUid(item.isAllChip ? null : item.id)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      />
    </Reanimated.View>
  );
}

export default memo(CaptureAudienceStrip);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  row: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 8,
  },
  chipShell: {
    width: 52,
  },
  chip: {
    width: 52,
  },
  pressable: {
    alignItems: 'center',
    gap: 4,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  allChipAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarLabel: {
    fontSize: 14,
    lineHeight: 16,
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
