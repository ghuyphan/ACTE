import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { usePreventRemove } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  CurvedTransition,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackButton from '../../components/ui/AppBackButton';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { EmailRegistrationInput, useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

type AuthScreenMode = 'landing' | 'signIn' | 'register' | 'resetPassword';
type AuthIntent = 'share-note';
const FORM_LAYOUT_TRANSITION = CurvedTransition.duration(220)
  .easingX(Easing.out(Easing.cubic))
  .easingY(Easing.out(Easing.cubic))
  .easingWidth(Easing.out(Easing.cubic))
  .easingHeight(Easing.out(Easing.cubic));

function AuthField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = 'none',
  keyboardType = 'default',
  textContentType,
  autoComplete,
  testID,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address';
  textContentType?:
    | 'emailAddress'
    | 'password'
    | 'newPassword'
    | 'name'
    | 'username'
    | 'none';
  autoComplete?: 'email' | 'password' | 'name' | 'off';
  testID: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryText}
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoComplete={autoComplete}
        testID={testID}
      />
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: AuthIntent }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const {
    user,
    isReady,
    isAuthAvailable,
    isGoogleAvailable,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const [screenMode, setScreenMode] = useState<AuthScreenMode>('landing');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'google' | 'signIn' | 'register' | 'reset' | null>(null);
  const [formContentHeight, setFormContentHeight] = useState(0);
  const [previousFormContentHeight, setPreviousFormContentHeight] = useState(0);
  const formProgress = useSharedValue(0);
  const isShareIntent = intent === 'share-note';

  const isFormVisible = screenMode !== 'landing';

  const resetMessages = useCallback(() => {
    setAuthMessage(null);
    setSuccessMessage(null);
  }, []);

  const openForm = useCallback(
    (mode: Exclude<AuthScreenMode, 'landing'>) => {
      resetMessages();
      setScreenMode(mode);
    },
    [resetMessages]
  );

  const goBackInFlow = useCallback(() => {
    resetMessages();
    setScreenMode((currentMode) => {
      if (currentMode === 'register' || currentMode === 'resetPassword') {
        return 'signIn';
      }

      return 'landing';
    });
  }, [resetMessages]);

  const dismissForm = useCallback(() => {
    resetMessages();
    setScreenMode('landing');
  }, [resetMessages]);

  usePreventRemove(isFormVisible, () => {
    goBackInFlow();
  });

  useEffect(() => {
    formProgress.value = withTiming(isFormVisible ? 1 : 0, {
      duration: isFormVisible ? 280 : 220,
      easing: isFormVisible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
    });
  }, [formProgress, isFormVisible]);

  useEffect(() => {
    if (!isFormVisible || !previousFormContentHeight || previousFormContentHeight === formContentHeight) {
      return;
    }

    const timer = setTimeout(() => {
      setPreviousFormContentHeight(formContentHeight);
    }, 280);

    return () => clearTimeout(timer);
  }, [formContentHeight, isFormVisible, previousFormContentHeight]);

  const landingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - formProgress.value * 0.1,
    transform: [{ translateY: formProgress.value * -28 }],
  }));

  const formPanelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formProgress.value,
    transform: [{ translateY: (1 - formProgress.value) * 360 }],
  }));

  const formBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formProgress.value * 0.08,
  }));

  const gradientColors: [string, string, string] = isDark
    ? [colors.background, colors.card, '#1A1A1A']
    : [colors.background, colors.surface, '#ECE2D7'];

  const nativeSheetDetents =
    previousFormContentHeight > 0 && previousFormContentHeight !== formContentHeight
      ? [{ height: previousFormContentHeight }, { height: formContentHeight }]
      : formContentHeight > 0
        ? [{ height: formContentHeight }]
        : [];

  const nativeSheetModifiers = [
    presentationDragIndicator('visible'),
    environment('colorScheme', isDark ? 'dark' : 'light'),
    ...(formContentHeight > 0
      ? [presentationDetents(nativeSheetDetents, { selection: { height: formContentHeight } })]
      : []),
  ];

  const continueToApp = () => {
    router.replace('/(tabs)' as Href);
  };

  const handleAuthSuccess = () => {
    resetMessages();
    router.replace('/(tabs)' as Href);
  };

  const handleGoogleSignIn = async () => {
    resetMessages();
    setActiveAction('google');
    const result = await signInWithGoogle();
    setActiveAction(null);

    if (result.status === 'success') {
      handleAuthSuccess();
      return;
    }

    if (result.status === 'cancelled') {
      return;
    }

    setAuthMessage(
      result.message ?? t('auth.signInFailed', 'Unable to sign in right now. Please try again later.')
    );
  };

  const handleEmailSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthMessage(t('auth.validationEmail', 'Enter your email address.'));
      return;
    }

    if (!password) {
      setAuthMessage(t('auth.validationPassword', 'Enter your password.'));
      return;
    }

    resetMessages();
    setActiveAction('signIn');
    const result = await signInWithEmail(trimmedEmail, password);
    setActiveAction(null);

    if (result.status === 'success') {
      handleAuthSuccess();
      return;
    }

    setAuthMessage(
      result.message ?? t('auth.signInFailed', 'Unable to sign in right now. Please try again later.')
    );
  };

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();
    if (!trimmedEmail) {
      setAuthMessage(t('auth.validationEmail', 'Enter your email address.'));
      return;
    }

    if (!password) {
      setAuthMessage(t('auth.validationPassword', 'Enter your password.'));
      return;
    }

    if (password.length < 6) {
      setAuthMessage(t('auth.validationPasswordLength', 'Use at least 6 characters for your password.'));
      return;
    }

    if (!confirmPassword) {
      setAuthMessage(t('auth.validationConfirmPassword', 'Confirm your password.'));
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage(t('auth.validationPasswordMatch', 'Your passwords do not match.'));
      return;
    }

    resetMessages();
    setActiveAction('register');
    const input: EmailRegistrationInput = {
      email: trimmedEmail,
      password,
      displayName: trimmedName || undefined,
    };
    const result = await registerWithEmail(input);
    setActiveAction(null);

    if (result.status === 'success') {
      handleAuthSuccess();
      return;
    }

    setAuthMessage(
      result.message ?? t('auth.signUpFailed', 'Unable to create your account right now. Please try again later.')
    );
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthMessage(t('auth.validationEmail', 'Enter your email address.'));
      return;
    }

    resetMessages();
    setActiveAction('reset');
    const result = await sendPasswordReset(trimmedEmail);
    setActiveAction(null);

    if (result.status === 'success') {
      setScreenMode('signIn');
      setSuccessMessage(
        t('auth.resetPasswordSent', 'We sent a password reset link to {{email}}.', {
          email: trimmedEmail,
        })
      );
      return;
    }

    setAuthMessage(
      result.message ?? t('auth.resetPasswordFailed', 'Unable to send a reset link right now.')
    );
  };

  const submitForm = async () => {
    if (screenMode === 'register') {
      await handleRegister();
      return;
    }

    if (screenMode === 'resetPassword') {
      await handlePasswordReset();
      return;
    }

    await handleEmailSignIn();
  };

  const primaryFormLabel =
    screenMode === 'register'
      ? t('auth.createAccount', 'Create account')
      : screenMode === 'resetPassword'
        ? t('auth.sendResetLink', 'Send reset link')
        : t('auth.signInEmail', 'Sign in');

  const formTitle =
    screenMode === 'register'
      ? t('auth.registerTitle', 'Create your account')
      : screenMode === 'resetPassword'
        ? t('auth.resetTitle', 'Reset your password')
        : t('auth.emailTitle', 'Continue with email');

  const formDescription =
    screenMode === 'register'
      ? t('auth.registerDescription', 'Save your notes, keep them backed up, and sync everywhere.')
      : screenMode === 'resetPassword'
        ? t('auth.resetDescription', 'Enter your email and we will send you a password reset link.')
        : isShareIntent
          ? t('auth.emailShareDescription', 'Sign in to share this note.')
          : t('auth.emailDescription', 'Sign in to keep your notes backed up and synced automatically.');

  const landingSubtitle = isShareIntent
    ? t('auth.shareSubtitle', 'Sign in to share this note')
    : t('auth.subtitle', 'So you never forget what she likes');
  const landingHint = isShareIntent
    ? null
    : t('auth.landingHint', 'Choose the easiest way to keep your notes backed up and ready everywhere.');

  const renderFormFields = () => (
    <>
      <Animated.View layout={FORM_LAYOUT_TRANSITION} style={styles.formHeaderRow}>
        <AppBackButton onPress={goBackInFlow} style={styles.formBackButton} testID="auth-form-close" />
        <View style={styles.formHeaderCopy}>
          <Text style={[styles.formTitle, { color: colors.text }]}>{formTitle}</Text>
          <Text style={[styles.formDescription, { color: colors.secondaryText }]}>{formDescription}</Text>
        </View>
      </Animated.View>

      {successMessage ? (
        <Animated.View
          layout={FORM_LAYOUT_TRANSITION}
          style={[
            styles.messageCard,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary + '22' },
          ]}
        >
          <Text style={[styles.messageText, { color: colors.text }]}>{successMessage}</Text>
        </Animated.View>
      ) : null}

      {authMessage ? (
        <Animated.View
          layout={FORM_LAYOUT_TRANSITION}
          style={[
            styles.messageCard,
            { backgroundColor: colors.danger + '14', borderColor: colors.danger + '24' },
          ]}
        >
          <Text style={[styles.messageText, { color: colors.danger }]}>{authMessage}</Text>
        </Animated.View>
      ) : null}

      {screenMode === 'register' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <AuthField
            label={t('auth.displayNameLabel', 'Name (optional)')}
            placeholder={t('auth.displayNamePlaceholder', 'How should we call you?')}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
            testID="auth-display-name-input"
          />
        </Animated.View>
      ) : null}

      <Animated.View layout={FORM_LAYOUT_TRANSITION}>
        <AuthField
          label={t('auth.emailLabel', 'Email')}
          placeholder={t('auth.emailPlaceholder', 'you@example.com')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          testID="auth-email-input"
        />
      </Animated.View>

      {screenMode !== 'resetPassword' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <AuthField
            label={t('auth.passwordLabel', 'Password')}
            placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={screenMode === 'register' ? 'newPassword' : 'password'}
            autoComplete="password"
            testID="auth-password-input"
          />
        </Animated.View>
      ) : null}

      {screenMode === 'register' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <AuthField
            label={t('auth.confirmPasswordLabel', 'Confirm password')}
            placeholder={t('auth.confirmPasswordPlaceholder', 'Type your password again')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password"
            testID="auth-confirm-password-input"
          />
        </Animated.View>
      ) : null}

      {screenMode === 'signIn' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <Pressable
            onPress={() => openForm('resetPassword')}
            style={({ pressed }) => [styles.secondaryLink, pressed ? styles.linkButtonPressed : null]}
            testID="auth-forgot-password"
          >
            <Text style={[styles.secondaryLinkLabel, { color: colors.primary }]}>
              {t('auth.forgotPassword', 'Forgot password?')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View layout={FORM_LAYOUT_TRANSITION}>
        <PrimaryButton
          label={primaryFormLabel}
          onPress={() => {
            void submitForm();
          }}
          loading={activeAction === 'signIn' || activeAction === 'register' || activeAction === 'reset'}
          variant="neutral"
          testID="auth-form-submit"
        />
      </Animated.View>

      {screenMode === 'register' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <Pressable
            onPress={() => openForm('signIn')}
            style={({ pressed }) => [styles.secondaryLink, pressed ? styles.linkButtonPressed : null]}
            testID="auth-switch-signin"
          >
            <Text style={[styles.secondaryLinkLabel, { color: colors.secondaryText }]}>
              {t('auth.alreadyHaveAccount', 'Already have an account? Sign in')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : screenMode === 'resetPassword' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <Pressable
            onPress={() => openForm('signIn')}
            style={({ pressed }) => [styles.secondaryLink, pressed ? styles.linkButtonPressed : null]}
            testID="auth-back-to-signin"
          >
            <Text style={[styles.secondaryLinkLabel, { color: colors.secondaryText }]}>
              {t('auth.backToSignIn', 'Back to sign in')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <Pressable
            onPress={() => openForm('register')}
            style={({ pressed }) => [styles.secondaryLink, pressed ? styles.linkButtonPressed : null]}
            testID="auth-switch-register"
          >
            <Text style={[styles.secondaryLinkLabel, { color: colors.secondaryText }]}>
              {t('auth.createAccountPrompt', 'Need an account? Create one')}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </>
  );

  const renderFormContent = (useScrollContainer: boolean) => {
    if (useScrollContainer) {
      return (
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {renderFormFields()}
        </ScrollView>
      );
    }

    return (
      <View
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          if (nextHeight <= 0 || nextHeight === formContentHeight) {
            return;
          }

          setPreviousFormContentHeight(formContentHeight || nextHeight);
          setFormContentHeight(nextHeight);
        }}
        style={[styles.formContent, styles.nativeFormContent, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
      >
        {renderFormFields()}
      </View>
    );
  };

  if (user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={[styles.content, { paddingTop: insets.top }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="heart" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('auth.title', 'Noto')}</Text>
          <Text style={[styles.brandAccent, { color: colors.secondaryText }]}>ノート</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {landingSubtitle}
          </Text>
          {landingHint ? (
            <Text style={[styles.landingHint, { color: colors.secondaryText }]}>{landingHint}</Text>
          ) : null}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              {t('auth.signedInAs', 'Signed in as')}
            </Text>
            <Text style={[styles.infoText, { color: colors.secondaryText }]}>
              {user.displayName || user.email || t('settings.signedIn', 'Signed in')}
            </Text>
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
          <PrimaryButton
            label={t('settings.manageAccount', 'Manage account')}
            onPress={() => router.replace('/auth/profile' as Href)}
            variant="neutral"
          />
          <PrimaryButton
            label={t('auth.continueApp', 'Continue to Noto')}
            onPress={continueToApp}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top,
          },
          landingAnimatedStyle,
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="heart" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t('auth.title', 'Noto')}</Text>
        <Text style={[styles.brandAccent, { color: colors.secondaryText }]}>ノート</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          {landingSubtitle}
        </Text>
        {landingHint ? (
          <Text style={[styles.landingHint, { color: colors.secondaryText }]}>{landingHint}</Text>
        ) : null}

        {!isAuthAvailable ? (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              {t('auth.localModeTitle', 'Local mode is ready')}
            </Text>
            <Text style={[styles.infoText, { color: colors.secondaryText }]}>
              {t(
                'auth.localModeMsg',
                'This build is using local-first mode. You can keep capturing notes without signing in.'
              )}
            </Text>
          </View>
        ) : null}

        {authMessage && !isFormVisible ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{authMessage}</Text>
        ) : null}
      </Animated.View>

      <Animated.View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 24,
          },
          landingAnimatedStyle,
        ]}
      >
        {isGoogleAvailable ? (
          <PrimaryButton
            label={
              !isReady || activeAction === 'google'
                ? t('auth.signingIn', 'Signing in...')
                : t('auth.signInGoogle', 'Sign in with Google')
            }
            leadingIcon={
              !isReady || activeAction === 'google' ? null : (
                <Ionicons name="logo-google" size={18} color={colors.background} />
              )
            }
            onPress={() => {
              void handleGoogleSignIn();
            }}
            loading={!isReady || activeAction === 'google'}
            variant="neutral"
            testID="auth-google-button"
          />
        ) : null}

        {isAuthAvailable ? (
          <PrimaryButton
            label={t('auth.continueWithEmail', 'Continue with email')}
            onPress={() => openForm('signIn')}
            variant={isGoogleAvailable ? 'secondary' : 'neutral'}
            testID="auth-continue-email"
          />
        ) : null}

        <Pressable
          onPress={continueToApp}
          style={({ pressed }) => [styles.linkButton, pressed ? styles.linkButtonPressed : null]}
          testID="auth-continue-local"
        >
          <Text style={[styles.linkButtonLabel, { color: colors.secondaryText }]}>
            {t('auth.continueLocal', 'Continue in local mode')}
          </Text>
        </Pressable>
      </Animated.View>

      {Platform.OS === 'ios' ? (
        <View pointerEvents={isFormVisible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
          <Host style={StyleSheet.absoluteFill} colorScheme={isDark ? 'dark' : 'light'}>
            <BottomSheet
              isPresented={isFormVisible}
              onIsPresentedChange={(next) => {
                if (!next) {
                  dismissForm();
                }
              }}
              fitToContents={formContentHeight === 0}
            >
              <Group modifiers={nativeSheetModifiers}>
                <RNHostView matchContents>
                  <KeyboardAvoidingView behavior="padding">
                    <View
                      testID="auth-form-panel"
                      style={[
                        styles.nativeFormSurface,
                        isOlderIOS
                          ? {
                              backgroundColor: colors.card,
                              borderTopLeftRadius: 10,
                              borderTopRightRadius: 10,
                            }
                          : null,
                      ]}
                    >
                      {renderFormContent(false)}
                    </View>
                  </KeyboardAvoidingView>
                </RNHostView>
              </Group>
            </BottomSheet>
          </Host>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFillObject}
          behavior="padding"
          pointerEvents="box-none"
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.formBackdrop,
              { backgroundColor: colors.text },
              formBackdropAnimatedStyle,
            ]}
          />
          <Animated.View
            pointerEvents={isFormVisible ? 'auto' : 'none'}
            layout={FORM_LAYOUT_TRANSITION}
            style={[
              styles.formPanel,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 24,
              },
              formPanelAnimatedStyle,
            ]}
            testID="auth-form-panel"
          >
            {renderFormContent(true)}
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPadding + 12,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: Layout.cardRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    ...Shadows.card,
  },
  title: {
    ...Typography.heroTitle,
    marginBottom: 6,
  },
  brandAccent: {
    ...Typography.pill,
    letterSpacing: 4,
    marginBottom: 12,
    opacity: 0.78,
  },
  subtitle: {
    ...Typography.heroSubtitle,
    textAlign: 'center',
  },
  landingHint: {
    ...Typography.body,
    marginTop: 14,
    textAlign: 'center',
    maxWidth: 320,
  },
  infoCard: {
    width: '100%',
    marginTop: 28,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  infoTitle: {
    ...Typography.button,
    marginBottom: 8,
  },
  infoText: {
    ...Typography.body,
  },
  errorText: {
    ...Typography.body,
    marginTop: 16,
    textAlign: 'center',
  },
  bottom: {
    width: '100%',
    paddingHorizontal: Layout.screenPadding + 4,
    gap: 12,
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  linkButtonPressed: {
    opacity: 0.72,
  },
  linkButtonLabel: {
    ...Typography.body,
    fontSize: 15,
  },
  formPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    borderBottomWidth: 0,
    minHeight: 380,
    ...Shadows.card,
  },
  nativeFormSurface: {
    backgroundColor: 'transparent',
  },
  formBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  formContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 18,
    gap: 16,
  },
  nativeFormContent: {
    paddingBottom: 24,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 8,
  },
  formBackButton: {
    width: 44,
    height: 44,
  },
  formHeaderCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  formTitle: {
    ...Typography.screenTitle,
    fontSize: 24,
  },
  formDescription: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  messageCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messageText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    ...Typography.pill,
    fontSize: 13,
  },
  fieldInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    ...Typography.body,
  },
  secondaryLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  secondaryLinkLabel: {
    ...Typography.body,
    fontSize: 14,
    textAlign: 'center',
  },
});
