import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import CaptureFooterFrame from './CaptureFooterFrame';

export interface SharedPlacePulseAvatar {
  id: string;
  photoUrl?: string | null;
  fallbackLabel: string;
}

interface SharedPlacePulseStripProps {
  avatars: SharedPlacePulseAvatar[];
  overflowCount?: number;
  accessibilityLabel: string;
  onPress?: () => void;
}

function SharedPlacePulseStrip({
  avatars,
  overflowCount = 0,
  accessibilityLabel,
  onPress,
}: SharedPlacePulseStripProps) {
  const { colors } = useTheme();

  if (avatars.length === 0) {
    return null;
  }

  return (
    <CaptureFooterFrame>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        disabled={!onPress}
        hitSlop={10}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            opacity: pressed ? 0.72 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={styles.avatarStack}>
          {avatars.map((avatar, index) => (
            <View
              key={avatar.id}
              style={[
                styles.avatarWrap,
                index > 0 ? styles.avatarOverlap : null,
                {
                  backgroundColor: colors.captureGlassFill,
                  borderColor: colors.card,
                },
              ]}
            >
              {avatar.photoUrl ? (
                <Image source={{ uri: avatar.photoUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={[styles.avatarFallback, { color: colors.captureGlassPlaceholder }]}>
                  {avatar.fallbackLabel}
                </Text>
              )}
            </View>
          ))}
        </View>
        {overflowCount > 0 ? (
          <Text style={[styles.overflowText, { color: colors.captureGlassPlaceholder }]}>
            +{overflowCount}
          </Text>
        ) : null}
        <Ionicons
          name="chevron-down"
          size={14}
          color={colors.captureGlassPlaceholder}
        />
      </Pressable>
    </CaptureFooterFrame>
  );
}

export default memo(SharedPlacePulseStrip);

const AVATAR_SIZE = 32;

const styles = StyleSheet.create({
  button: {
    maxWidth: '88%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  overflowText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
