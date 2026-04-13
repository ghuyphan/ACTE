import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../hooks/useTheme';

interface ProfileAvatarProps {
  avatarLabel: string;
  avatarUrl: string | null;
  colors: ThemeColors;
  size: number;
  labelFontSize: number;
  onPress?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  accessibilityLabel?: string;
}

export default function ProfileAvatar({
  avatarLabel,
  avatarUrl,
  colors,
  size,
  labelFontSize,
  onPress,
  disabled = false,
  isLoading = false,
  accessibilityLabel,
}: ProfileAvatarProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasLoaded(false);
    setHasFailed(false);
  }, [avatarUrl]);

  const borderRadius = size / 2;
  const shouldRenderImage = Boolean(avatarUrl) && !hasFailed;
  const iconShellSize = Math.max(22, Math.round(size * 0.34));
  const iconSize = Math.max(12, Math.round(size * 0.16));
  const content = (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.surface, { borderRadius }]}>
        <View style={[styles.fallback, { backgroundColor: colors.primarySoft, borderRadius }]}>
          <Text style={[styles.label, { color: colors.primary, fontSize: labelFontSize }]}>
            {avatarLabel}
          </Text>
        </View>
        {shouldRenderImage ? (
          <Image
            source={{ uri: avatarUrl! }}
            style={[
              styles.image,
              {
                borderRadius,
                opacity: hasLoaded ? 1 : 0,
              },
            ]}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={140}
            onLoad={() => {
              setHasLoaded(true);
              setHasFailed(false);
            }}
            onError={() => {
              setHasLoaded(false);
              setHasFailed(true);
            }}
          />
        ) : null}
      </View>
      {onPress ? (
        <View
          pointerEvents="none"
          style={[
            styles.editBadge,
            {
              width: iconShellSize,
              height: iconShellSize,
              borderRadius: iconShellSize / 2,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="camera" size={iconSize} color={colors.primary} />
          )}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  surface: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  label: {
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.92,
  },
});
