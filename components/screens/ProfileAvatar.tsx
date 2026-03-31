import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../hooks/useTheme';

interface ProfileAvatarProps {
  avatarLabel: string;
  avatarUrl: string | null;
  colors: ThemeColors;
  size: number;
  labelFontSize: number;
}

export default function ProfileAvatar({
  avatarLabel,
  avatarUrl,
  colors,
  size,
  labelFontSize,
}: ProfileAvatarProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasLoaded(false);
    setHasFailed(false);
  }, [avatarUrl]);

  const borderRadius = size / 2;
  const shouldRenderImage = Boolean(avatarUrl) && !hasFailed;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
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
  );
}

const styles = StyleSheet.create({
  container: {
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
});
