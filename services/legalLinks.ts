import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Linking } from 'react-native';

const DEV_PRIVACY_POLICY_URL = 'https://example.com/privacy';
const DEV_SUPPORT_URL = 'https://example.com/support';
const DEV_ACCOUNT_DELETION_URL = 'https://example.com/account-deletion';
const DEV_SUPPORT_EMAIL = 'support@example.com';

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '';
}

function resolveLegalValue(value: string | undefined, fallback: string) {
  const normalizedValue = normalizeUrl(value);
  if (normalizedValue) {
    return normalizedValue;
  }

  return __DEV__ ? fallback : '';
}

export const PRIVACY_POLICY_URL = resolveLegalValue(
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  DEV_PRIVACY_POLICY_URL
);
export const SUPPORT_URL = resolveLegalValue(process.env.EXPO_PUBLIC_SUPPORT_URL, DEV_SUPPORT_URL);
export const ACCOUNT_DELETION_URL = resolveLegalValue(
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  DEV_ACCOUNT_DELETION_URL
);
export const SUPPORT_EMAIL = resolveLegalValue(process.env.EXPO_PUBLIC_SUPPORT_EMAIL, DEV_SUPPORT_EMAIL);

function buildMailtoUrl(address: string, subject: string) {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

async function openUrl(url: string) {
  if (!url) {
    return false;
  }

  if (url.startsWith('mailto:')) {
    await Linking.openURL(url);
    return true;
  }

  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
  return true;
}

export function hasPrivacyPolicyLink() {
  return Boolean(PRIVACY_POLICY_URL);
}

export function hasSupportLink() {
  return Boolean(SUPPORT_URL || SUPPORT_EMAIL);
}

export function hasAccountDeletionLink() {
  return Boolean(ACCOUNT_DELETION_URL || SUPPORT_EMAIL);
}

export async function openPrivacyPolicy() {
  return openUrl(PRIVACY_POLICY_URL);
}

export async function openSupport() {
  if (SUPPORT_URL) {
    return openUrl(SUPPORT_URL);
  }

  if (SUPPORT_EMAIL) {
    return openUrl(buildMailtoUrl(SUPPORT_EMAIL, 'Noto support request'));
  }

  return false;
}

export async function openAccountDeletionHelp() {
  if (ACCOUNT_DELETION_URL) {
    return openUrl(ACCOUNT_DELETION_URL);
  }

  if (SUPPORT_EMAIL) {
    return openUrl(buildMailtoUrl(SUPPORT_EMAIL, 'Noto account deletion request'));
  }

  return false;
}
