import { environment, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { usePreventRemove } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
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
import AppSheet from '../../sheets/AppSheet';
import AppBackButton from '../../ui/AppBackButton';
import OfflineNotice from '../../ui/OfflineNotice';
import PrimaryButton from '../../ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../../../constants/theme';
import { EmailRegistrationInput, useAuth } from '../../../hooks/useAuth';
import { useConnectivity } from '../../../hooks/useConnectivity';
import { useTheme } from '../../../hooks/useTheme';
import { hasPrivacyPolicyLink, hasSupportLink, openPrivacyPolicy, openSupport } from '../../../services/legalLinks';
import { completeOnboardingAndEnterApp, markOnboardingComplete } from '../../../services/startupRouting';

type AuthScreenMode = 'landing' | 'signIn' | 'register' | 'resetPassword';
type AuthIntent = 'share-note';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME_LENGTH = 40;
const APP_ICON_LIGHT_SOURCE = require('../../../assets/images/icon/icon-default.png');
const APP_ICON_DARK_SOURCE = require('../../../assets/images/icon/icon-dark.png');
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
  returnKeyType,
  onSubmitEditing,
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
  autoComplete?: 'email' | 'password' | 'name' | 'off' | 'new-password';
  returnKeyType?: 'done' | 'go' | 'next' | 'send';
  onSubmitEditing?: () => void;
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
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        testID={testID}
      />
    </View>
  );
}

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value);
}

function ConsentCheckbox({
  value,
  disabled,
  testID,
}: {
  value: boolean;
  disabled?: boolean;
  testID: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.checkboxBase,
        {
          backgroundColor: value ? colors.primary : colors.surface,
          borderColor: value ? colors.primary : colors.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      testID={testID}
    >
      {value ? <Ionicons color={colors.background} name="checkmark" size={14} /> : null}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { intent, returnTo } = useLocalSearchParams<{ intent?: AuthIntent; returnTo?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isOnline } = useConnectivity();
  const {
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
  const [hasAcceptedPrivacyPolicy, setHasAcceptedPrivacyPolicy] = useState(false);
  const [hasAcceptedLandingPolicy, setHasAcceptedLandingPolicy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'google' | 'signIn' | 'register' | 'reset' | null>(null);
  const [formContentHeight, setFormContentHeight] = useState(0);
  const [previousFormContentHeight, setPreviousFormContentHeight] = useState(0);
  const formProgress = useSharedValue(0);
  const isShareIntent = intent === 'share-note';
  const returnToRoute = typeof returnTo === 'string' && returnTo.trim() ? returnTo.trim() : null;
  const canOpenPrivacyPolicy = hasPrivacyPolicyLink();
  const canOpenSupport = hasSupportLink();

  const isFormVisible = screenMode !== 'landing';
  const showLandingToast = Platform.OS === 'android';

  const resetMessages = useCallback(() => {
    setAuthMessage(null);
    setSuccessMessage(null);
  }, []);

  const showLandingAuthMessage = useCallback(
    (message: string) => {
      if (showLandingToast) {
        ToastAndroid.show(message, ToastAndroid.SHORT);
        setAuthMessage(null);
        return;
      }

      setAuthMessage(message);
    },
    [showLandingToast]
  );

  const openForm = useCallback(
    (mode: Exclude<AuthScreenMode, 'landing'>) => {
      resetMessages();
      setHasAcceptedPrivacyPolicy(false);
      setScreenMode(mode);
    },
    [resetMessages]
  );

  const goBackInFlow = useCallback(() => {
    resetMessages();
    setHasAcceptedPrivacyPolicy(false);
    setScreenMode((currentMode) => {
      if (currentMode === 'register' || currentMode === 'resetPassword') {
        return 'signIn';
      }

      return 'landing';
    });
  }, [resetMessages]);

  const dismissForm = useCallback(() => {
    resetMessages();
    setHasAcceptedPrivacyPolicy(false);
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
  const appIconSource = isDark ? APP_ICON_DARK_SOURCE : APP_ICON_LIGHT_SOURCE;

  const continueToApp = () => {
    if (!hasAcceptedLandingPolicy && (canOpenPrivacyPolicy || canOpenSupport)) {
      showLandingAuthMessage(
        t('auth.validationLocalPolicy', 'Review and accept the privacy policy before continuing in local mode.')
      );
      return;
    }

    router.replace('/' as Href);
  };

  const handleAuthSuccess = async () => {
    resetMessages();
    try {
      if (returnToRoute) {
        await markOnboardingComplete();
        router.replace(returnToRoute as Href);
        return true;
      }

      await completeOnboardingAndEnterApp((route) => {
        router.replace(route as Href);
      });
      return true;
    } catch (error) {
      console.warn('Failed to persist onboarding state after auth:', error);
      setAuthMessage(
        t('auth.continueFailed', 'We could not finish setup right now. Please try again.')
      );
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    if (!hasAcceptedLandingPolicy && (canOpenPrivacyPolicy || canOpenSupport)) {
      showLandingAuthMessage(
        t('auth.validationLandingPolicy', 'Accept the privacy policy before continuing.')
      );
      return;
    }

    resetMessages();
    setActiveAction('google');
    const result = await signInWithGoogle();

    if (result.status === 'success') {
      const completed = await handleAuthSuccess();
      if (!completed) {
        setActiveAction(null);
      }
      return;
    }

    setActiveAction(null);

    if (result.status === 'cancelled') {
      return;
    }

    showLandingAuthMessage(
      result.message ?? t('auth.signInFailed', 'Unable to sign in right now. Please try again later.')
    );
  };

  const handleEmailSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthMessage(t('auth.validationEmail', 'Enter your email address.'));
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setAuthMessage(t('auth.errorInvalidEmail', 'Enter a valid email address.'));
      return;
    }

    if (!password) {
      setAuthMessage(t('auth.validationPassword', 'Enter your password.'));
      return;
    }

    resetMessages();
    setActiveAction('signIn');
    const result = await signInWithEmail(trimmedEmail, password);

    if (result.status === 'success') {
      const completed = await handleAuthSuccess();
      if (!completed) {
        setActiveAction(null);
      }
      return;
    }

    setActiveAction(null);

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

    if (!isValidEmail(trimmedEmail)) {
      setAuthMessage(t('auth.errorInvalidEmail', 'Enter a valid email address.'));
      return;
    }

    if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
      setAuthMessage(
        t('auth.validationDisplayNameLength', 'Use 40 characters or fewer for your name.')
      );
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

    if (!hasAcceptedPrivacyPolicy) {
      setAuthMessage(
        t('auth.validationPrivacyConsent', 'Accept the privacy policy before creating your account.')
      );
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

    if (result.status === 'success') {
      const completed = await handleAuthSuccess();
      if (!completed) {
        setActiveAction(null);
      }
      return;
    }

    setActiveAction(null);

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

    if (!isValidEmail(trimmedEmail)) {
      setAuthMessage(t('auth.errorInvalidEmail', 'Enter a valid email address.'));
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

  const handleOpenPrivacyPolicy = () => {
    void openPrivacyPolicy();
  };

  const handleOpenSupport = () => {
    void openSupport();
  };

  const renderFormFields = () => (
    <>
      <Animated.View layout={FORM_LAYOUT_TRANSITION} style={styles.formHeader}>
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
            returnKeyType="next"
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
          returnKeyType={screenMode === 'resetPassword' ? 'send' : 'next'}
          onSubmitEditing={screenMode === 'resetPassword' ? () => void submitForm() : undefined}
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
            autoComplete={screenMode === 'register' ? 'new-password' : 'password'}
            returnKeyType={screenMode === 'register' ? 'next' : 'go'}
            onSubmitEditing={screenMode === 'register' ? undefined : () => void submitForm()}
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
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={() => void submitForm()}
            testID="auth-confirm-password-input"
          />
        </Animated.View>
      ) : null}

      {screenMode === 'register' ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hasAcceptedPrivacyPolicy, disabled: activeAction === 'register' }}
            onPress={() => setHasAcceptedPrivacyPolicy((currentValue) => !currentValue)}
            style={[
              styles.legalConsentCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            testID="auth-privacy-consent"
          >
            <View style={styles.legalConsentControl}>
              <ConsentCheckbox
                value={hasAcceptedPrivacyPolicy}
                disabled={activeAction === 'register'}
                testID="auth-privacy-checkbox"
              />
            </View>
            <Text style={[styles.legalConsentText, { color: colors.text }]}>
              {t('auth.privacyConsentPrefix', 'I agree to the ')}
              {canOpenPrivacyPolicy ? (
                <Text
                  onPress={handleOpenPrivacyPolicy}
                  style={[styles.inlineLink, { color: colors.primary }]}
                  testID="auth-privacy-policy-link-inline"
                >
                  {t('settings.privacyPolicy', 'Privacy Policy')}
                </Text>
              ) : (
                <Text style={[styles.inlineLinkFallback, { color: colors.text }]}>
                  {t('settings.privacyPolicy', 'Privacy Policy')}
                </Text>
              )}
              <Text>{t('auth.privacyConsentSuffix', '.')}</Text>
            </Text>
          </Pressable>
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
        {!isOnline && isAuthAvailable ? (
          <View style={styles.formNoticeWrap}>
            <OfflineNotice
              title={t('auth.offlineTitle', 'You are offline')}
              body={t('auth.offlineBody', 'Sign-in and account recovery need a connection. You can still keep using local mode.')}
              compact
            />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View layout={FORM_LAYOUT_TRANSITION}>
        <PrimaryButton
          label={primaryFormLabel}
          onPress={() => {
            void submitForm();
          }}
          loading={activeAction === 'signIn' || activeAction === 'register' || activeAction === 'reset'}
          variant="neutral"
          disabled={!isOnline && isAuthAvailable}
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

      {canOpenPrivacyPolicy || canOpenSupport ? (
        <Animated.View layout={FORM_LAYOUT_TRANSITION} style={styles.legalLinksWrap}>
          {canOpenPrivacyPolicy ? (
            <Pressable
              onPress={handleOpenPrivacyPolicy}
              style={({ pressed }) => [styles.secondaryLink, pressed ? styles.linkButtonPressed : null]}
              testID="auth-privacy-policy-link"
            >
              <Text style={[styles.secondaryLinkLabel, { color: colors.primary }]}>
                {t('settings.privacyPolicy', 'Privacy Policy')}
              </Text>
            </Pressable>
          ) : null}
          {canOpenSupport ? (
            <Pressable
              onPress={handleOpenSupport}
              style={({ pressed }) => [styles.secondaryLink, pressed ? styles.linkButtonPressed : null]}
              testID="auth-support-link"
            >
              <Text style={[styles.secondaryLinkLabel, { color: colors.primary }]}>
                {t('settings.support', 'Support')}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
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
        <View style={styles.iconContainer}>
          <Image source={appIconSource} style={styles.appIcon} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t('auth.title', 'Noto')}</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          {landingSubtitle}
        </Text>
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

        {!isOnline && isAuthAvailable ? (
          <View style={styles.landingNoticeWrap}>
            <OfflineNotice
              title={t('auth.offlineTitle', 'You are offline')}
              body={t('auth.offlineBody', 'Sign-in and account recovery need a connection. You can still keep using local mode.')}
            />
          </View>
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
        <View style={styles.landingMessageSlot}>
          {authMessage && !isFormVisible ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{authMessage}</Text>
          ) : null}
        </View>

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
            disabled={!isOnline || activeAction !== null}
            testID="auth-google-button"
          />
        ) : null}

        {isAuthAvailable ? (
          <PrimaryButton
            label={t('auth.continueWithEmail', 'Continue with email')}
            onPress={() => openForm('signIn')}
            variant={isGoogleAvailable ? 'secondary' : 'neutral'}
            disabled={!isOnline || activeAction !== null}
            testID="auth-continue-email"
          />
        ) : null}

        <Pressable
          onPress={activeAction ? undefined : continueToApp}
          style={({ pressed }) => [styles.linkButton, pressed ? styles.linkButtonPressed : null]}
          disabled={activeAction !== null}
          testID="auth-continue-local"
        >
          <Text style={[styles.linkButtonLabel, { color: colors.secondaryText }]}>
            {t('auth.continueLocal', 'Continue in local mode')}
          </Text>
        </Pressable>

        {canOpenPrivacyPolicy || canOpenSupport ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hasAcceptedLandingPolicy }}
            onPress={() => setHasAcceptedLandingPolicy((currentValue) => !currentValue)}
            style={styles.landingConsentRow}
            testID="auth-landing-policy-consent"
          >
            <View style={styles.landingConsentControlSlot}>
              <ConsentCheckbox
                value={hasAcceptedLandingPolicy}
                testID="auth-landing-policy-checkbox"
              />
            </View>
            <Text style={[styles.landingConsentText, { color: colors.secondaryText }]}>
              {t('auth.landingPolicyConsentPrefix', 'I agree to the ')}
              {canOpenPrivacyPolicy ? (
                <Text
                  onPress={handleOpenPrivacyPolicy}
                  style={[styles.inlineLink, { color: colors.primary }]}
                  testID="auth-privacy-policy-link"
                >
                  {t('settings.privacyPolicy', 'Privacy Policy')}
                </Text>
              ) : null}
              {canOpenPrivacyPolicy && canOpenSupport ? (
                <Text>{t('auth.landingPolicyConsentJoiner', ' and ')}</Text>
              ) : null}
              {canOpenSupport ? (
                <Text
                  onPress={handleOpenSupport}
                  style={[styles.inlineLink, { color: colors.primary }]}
                  testID="auth-support-link"
                >
                  {t('settings.support', 'Support')}
                </Text>
              ) : null}
              <Text>{t('auth.landingPolicyConsentSuffix', '.')}</Text>
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>

      {Platform.OS === 'ios' ? (
        <AppSheet
          visible={isFormVisible}
          onClose={dismissForm}
          fitToContents={formContentHeight === 0}
          iosGroupModifiers={nativeSheetModifiers}
        >
          <KeyboardAvoidingView behavior="padding">
            <View testID="auth-form-panel" style={styles.nativeFormSurface}>
              {renderFormContent(false)}
            </View>
          </KeyboardAvoidingView>
        </AppSheet>
      ) : (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={undefined}
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
    overflow: 'hidden',
    marginBottom: 32,
  },
  appIcon: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...Typography.heroTitle,
    marginBottom: 12,
  },
  subtitle: {
    ...Typography.heroSubtitle,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  landingMessageSlot: {
    minHeight: 20,
    justifyContent: 'center',
  },
  formNoticeWrap: {
    marginTop: 6,
    marginBottom: 10,
  },
  landingNoticeWrap: {
    width: '100%',
    marginTop: 18,
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
    ...StyleSheet.absoluteFill,
  },
  formContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 18,
    gap: 16,
  },
  nativeFormContent: {
    paddingBottom: 24,
  },
  formHeader: {
    gap: 14,
    marginBottom: 8,
  },
  formBackButton: {
    width: 44,
    height: 44,
  },
  formHeaderCopy: {
    gap: 6,
  },
  formTitle: {
    ...Typography.screenTitle,
    fontSize: 24,
  },
  formDescription: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
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
  landingConsentRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 2,
    maxWidth: '100%',
  },
  landingConsentControlSlot: {
    width: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBase: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingConsentText: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
    flexShrink: 1,
  },
  legalConsentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  legalConsentControl: {
    paddingTop: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  legalConsentText: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineLink: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineLinkFallback: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  legalLinksWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  localConsentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
});
