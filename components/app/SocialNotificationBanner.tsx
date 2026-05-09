import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  buildSharedChatRoute,
  extractSocialNotificationPayloadFromNotification,
  isSocialNotificationType,
  shouldSuppressSocialNotificationPresentation,
  type SocialNotificationPayload,
} from '../../utils/socialNotificationPresentation';

type BannerState = {
  body: string;
  payload: SocialNotificationPayload;
  title: string;
};

const AUTO_DISMISS_MS = 4500;

function getBannerRoute(payload: SocialNotificationPayload) {
  if (payload.notificationType === 'shared-response' && payload.sharedPostId) {
    return buildSharedChatRoute(payload.sharedPostId, payload.responseId);
  }

  if (payload.route) {
    return payload.route;
  }

  if (payload.sharedPostId) {
    return `/shared/${encodeURIComponent(payload.sharedPostId)}`;
  }

  return '';
}

function getIconName(notificationType: string | undefined) {
  if (notificationType === 'shared-response') {
    return 'chatbubble-ellipses-outline';
  }

  if (notificationType === 'friend-accepted') {
    return 'person-add-outline';
  }

  return 'sparkles-outline';
}

export default function SocialNotificationBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setBanner(null);
      }
    });
  }, [clearDismissTimer, progress]);

  const showBanner = useCallback(
    (nextBanner: BannerState) => {
      clearDismissTimer();
      setBanner(nextBanner);
      progress.stopAnimation();
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        damping: 18,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [clearDismissTimer, dismiss, progress]
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const payload = extractSocialNotificationPayloadFromNotification(notification);
      if (
        !isSocialNotificationType(payload.notificationType) ||
        shouldSuppressSocialNotificationPresentation(payload)
      ) {
        return;
      }

      const title = payload.notificationTitle.trim();
      const body = payload.notificationBody.trim();
      if (!title && !body) {
        return;
      }

      showBanner({
        body,
        payload,
        title,
      });
    });

    return () => {
      subscription.remove();
      clearDismissTimer();
    };
  }, [clearDismissTimer, showBanner]);

  if (!banner) {
    return null;
  }

  const route = getBannerRoute(banner.payload);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingTop: Math.max(insets.top, 12) + 8,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={banner.title || banner.body}
        disabled={!route}
        onPress={() => {
          dismiss();
          if (route) {
            router.push(route as any);
          }
        }}
        style={({ pressed }) => [
          styles.banner,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons
            name={getIconName(banner.payload.notificationType)}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={styles.copy}>
          {banner.title ? (
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
              {banner.title}
            </Text>
          ) : null}
          {banner.body ? (
            <Text numberOfLines={2} style={[styles.body, { color: colors.secondaryText }]}>
              {banner.body}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Close')}
          hitSlop={8}
          onPress={dismiss}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={16} color={colors.secondaryText} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 100,
    paddingHorizontal: Layout.screenPadding,
  },
  banner: {
    ...Shadows.floating,
    minHeight: 66,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Noto Sans',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
