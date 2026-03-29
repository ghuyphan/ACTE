import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import PrimaryButton from './ui/PrimaryButton';

type FriendInviteJoinBodyProps = {
  user: { id?: string } | null;
  isAuthAvailable: boolean;
  inviteValue: string;
  joining: boolean;
  onChangeInvite: (value: string) => void;
  onSubmit: () => void;
  onGoToAuth: () => void;
  bottomPadding?: number;
  contentStyle?: StyleProp<ViewStyle>;
  primaryActionStyle?: StyleProp<ViewStyle>;
};

export default function FriendInviteJoinBody({
  user,
  isAuthAvailable,
  inviteValue,
  joining,
  onChangeInvite,
  onSubmit,
  onGoToAuth,
  bottomPadding = 0,
  contentStyle,
  primaryActionStyle,
}: FriendInviteJoinBodyProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.content, { paddingBottom: bottomPadding }, contentStyle]}>
      {user ? (
        <View style={styles.formBlock}>
          <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>
            {t('shared.joinCardTitle', 'Invite link')}
          </Text>
          <TextInput
            value={inviteValue}
            onChangeText={onChangeInvite}
            placeholder={t('shared.joinPlaceholder', 'Paste the full invite link')}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      ) : null}

      <PrimaryButton
        label={user ? t('shared.joinButton', 'Continue') : t('shared.signInButton', 'Sign in')}
        onPress={() => {
          if (user) {
            onSubmit();
            return;
          }

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onGoToAuth();
        }}
        loading={user ? joining : false}
        disabled={user ? !inviteValue.trim() : !isAuthAvailable}
        leadingIcon={(
          <Ionicons
            name={user ? 'enter-outline' : 'person-circle-outline'}
            size={18}
            color="#1C1C1E"
          />
        )}
        style={[styles.primaryAction, primaryActionStyle]}
      />

      {user && inviteValue.trim() ? (
        <View
          style={[
            styles.helperCard,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary + '22',
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={[styles.helperText, { color: colors.text }]}>
            {t('shared.joinFooterBody', 'We’ll connect you as soon as this invite checks out.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  formBlock: {
    gap: 8,
  },
  fieldLabel: {
    ...Typography.pill,
    fontSize: 13,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Typography.body,
  },
  primaryAction: {
    width: '100%',
    marginTop: 22,
  },
  helperCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  helperText: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
