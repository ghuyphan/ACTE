import { Ionicons } from '@expo/vector-icons';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import * as Haptics from '../../hooks/useHaptics';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Typography } from '../../constants/theme';
import { useAndroidKeyboardBlurOnHide } from '../../hooks/ui/useAndroidKeyboardBlurOnHide';
import { useTheme } from '../../hooks/useTheme';
import { FriendSearchResult } from '../../services/sharedFeedService';
import PrimaryButton from '../ui/PrimaryButton';

const SheetTextInput = Platform.OS === 'android' ? BottomSheetTextInput : TextInput;

export type FriendJoinMode = 'username' | 'invite';

type FriendInviteJoinBodyProps = {
  user: { id?: string } | null;
  isAuthAvailable: boolean;
  mode: FriendJoinMode;
  inviteValue: string;
  usernameValue: string;
  joining: boolean;
  searching: boolean;
  addingFriend: boolean;
  searchResult: FriendSearchResult | null;
  onChangeMode: (mode: FriendJoinMode) => void;
  onChangeInvite: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onSubmitInvite: () => void;
  onSearchByUsername: () => void;
  onAddFriend: () => void;
  onGoToAuth: () => void;
  bottomPadding?: number;
  contentStyle?: StyleProp<ViewStyle>;
  primaryActionStyle?: StyleProp<ViewStyle>;
};

function SearchResultCard({
  result,
  addingFriend,
  onAddFriend,
}: {
  result: FriendSearchResult;
  addingFriend: boolean;
  onAddFriend: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const statusCopy = result.isSelf
    ? t('shared.searchResultSelf', 'This is your Noto ID.')
    : result.alreadyFriends
      ? t('shared.searchResultAlreadyFriends', 'You are already friends.')
      : t('shared.searchResultExactMatch', 'Match found.');
  const buttonLabel = result.isSelf
    ? t('shared.searchResultSelfButton', 'This is you')
    : result.alreadyFriends
      ? t('shared.searchResultAlreadyFriendsButton', 'Already friends')
      : t('shared.searchResultAddButton', 'Add friend');
  const avatarLabel = (result.displayName || result.username || 'N').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.resultHeader}>
        {result.photoURL ? (
          <Image source={{ uri: result.photoURL }} style={styles.resultAvatarImage} contentFit="cover" />
        ) : (
          <View style={[styles.resultAvatarFallback, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.resultAvatarLabel, { color: colors.primary }]}>{avatarLabel}</Text>
          </View>
        )}
        <View style={styles.resultCopy}>
          <Text numberOfLines={1} style={[styles.resultTitle, { color: colors.text }]}>
            {result.displayName || `@${result.username}`}
          </Text>
          <Text numberOfLines={1} style={[styles.resultSubtitle, { color: colors.secondaryText }]}>
            @{result.username}
          </Text>
        </View>
      </View>
      <Text style={[styles.resultStatus, { color: colors.secondaryText }]}>{statusCopy}</Text>
      <PrimaryButton
        label={buttonLabel}
        onPress={onAddFriend}
        loading={addingFriend}
        disabled={result.isSelf || result.alreadyFriends}
        style={styles.resultAction}
        testID="friend-search-add-button"
      />
    </View>
  );
}

export default function FriendInviteJoinBody({
  user,
  isAuthAvailable,
  mode,
  inviteValue,
  usernameValue,
  joining,
  searching,
  addingFriend,
  searchResult,
  onChangeMode,
  onChangeInvite,
  onChangeUsername,
  onSubmitInvite,
  onSearchByUsername,
  onAddFriend,
  onGoToAuth,
  bottomPadding = 0,
  contentStyle,
  primaryActionStyle,
}: FriendInviteJoinBodyProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const usernameInputRef = useRef<{ blur: () => void; isFocused?: () => boolean } | null>(null);
  const inviteInputRef = useRef<{ blur: () => void; isFocused?: () => boolean } | null>(null);
  const isUsernameMode = mode === 'username';
  const primaryLabel = user
    ? isUsernameMode
      ? t('shared.searchByUsernamePrimary', 'Search Noto ID')
      : t('shared.joinButton', 'Continue')
    : t('shared.signInButton', 'Sign in');
  const primaryLoading = user ? (isUsernameMode ? searching : joining) : false;
  const primaryDisabled = user
    ? isUsernameMode
      ? !usernameValue.trim()
      : !inviteValue.trim()
    : !isAuthAvailable;

  useAndroidKeyboardBlurOnHide({
    refs: [usernameInputRef, inviteInputRef],
  });

  return (
    <View style={[styles.content, { paddingBottom: bottomPadding }, contentStyle]}>
      <View style={[styles.segmentedWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['username', 'invite'] as const).map((option) => {
          const selected = option === mode;
          return (
            <Pressable
              key={option}
              onPress={() => onChangeMode(option)}
              style={({ pressed }) => [
                styles.segmentedButton,
                {
                  backgroundColor: selected ? colors.primary : 'transparent',
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              testID={`friend-join-mode-${option}`}
            >
              <Text
                style={[
                  styles.segmentedLabel,
                  { color: selected ? '#1C1C1E' : colors.secondaryText },
                ]}
              >
                {option === 'username'
                  ? t('shared.searchByUsernameTab', 'Noto ID')
                  : t('shared.searchByInviteTab', 'Invite link')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {user ? (
        isUsernameMode ? (
          <>
            <View style={styles.formBlock}>
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>
                {t('shared.searchByUsernameLabel', 'Noto ID')}
              </Text>
              <SheetTextInput
                ref={(node) => {
                  usernameInputRef.current = node ?? null;
                }}
                value={usernameValue}
                onChangeText={onChangeUsername}
                onSubmitEditing={onSearchByUsername}
                placeholder={t('shared.searchByUsernamePlaceholder', 'Enter @username')}
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
                autoComplete="username"
                returnKeyType="search"
                testID="friend-search-username-input"
              />
            </View>
            {searchResult ? (
              <SearchResultCard
                result={searchResult}
                addingFriend={addingFriend}
                onAddFriend={onAddFriend}
              />
            ) : null}
          </>
        ) : (
          <View style={styles.formBlock}>
            <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>
              {t('shared.joinCardTitle', 'Invite link')}
            </Text>
            <SheetTextInput
              ref={(node) => {
                inviteInputRef.current = node ?? null;
              }}
              value={inviteValue}
              onChangeText={onChangeInvite}
              onSubmitEditing={onSubmitInvite}
              placeholder={t('shared.joinPlaceholder', 'Paste invite link')}
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
              returnKeyType="done"
              testID="friend-search-invite-input"
            />
          </View>
        )
      ) : null}

      <PrimaryButton
        label={primaryLabel}
        onPress={() => {
          if (user) {
            if (isUsernameMode) {
              onSearchByUsername();
            } else {
              onSubmitInvite();
            }
            return;
          }

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onGoToAuth();
        }}
        loading={primaryLoading}
        disabled={primaryDisabled}
        leadingIcon={(
          <Ionicons
            name={
              user
                ? isUsernameMode
                  ? 'search-outline'
                  : 'enter-outline'
                : 'person-circle-outline'
            }
            size={18}
            color="#1C1C1E"
          />
        )}
        style={[styles.primaryAction, primaryActionStyle]}
        testID="friend-join-primary-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  segmentedWrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  segmentedButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentedLabel: {
    ...Typography.button,
    fontSize: 14,
  },
  formBlock: {
    gap: 6,
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
  resultCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  resultAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarLabel: {
    ...Typography.body,
    fontSize: 18,
    fontWeight: '700',
  },
  resultCopy: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
  },
  resultSubtitle: {
    ...Typography.body,
    fontSize: 13,
  },
  resultStatus: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  resultAction: {
    width: '100%',
  },
  primaryAction: {
    width: '100%',
    marginTop: 10,
  },
});
