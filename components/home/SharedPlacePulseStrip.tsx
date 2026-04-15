import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';

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
  const reduceMotionEnabled = useReducedMotion();
  const pressScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  if (avatars.length === 0) {
    return null;
  }

  return (
    <Reanimated.View
      entering={reduceMotionEnabled ? undefined : FadeInDown.duration(200)}
      exiting={reduceMotionEnabled ? undefined : FadeOutUp.duration(120)}
      style={styles.container}
    >
      <Reanimated.View style={[styles.buttonShell, animatedButtonStyle]}>
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={accessibilityLabel}
          disabled={!onPress}
          hitSlop={10}
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
          style={styles.button}
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
      </Reanimated.View>
    </Reanimated.View>
  );
}

export default memo(SharedPlacePulseStrip);

const AVATAR_SIZE = 28;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 22,
  },
  buttonShell: {
    maxWidth: '88%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
