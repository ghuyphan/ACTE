import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Linking } from 'react-native';

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '';
}

export const PRIVACY_POLICY_URL = normalizeUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
export const SUPPORT_URL = normalizeUrl(process.env.EXPO_PUBLIC_SUPPORT_URL);
export const ACCOUNT_DELETION_URL = normalizeUrl(process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL);
export const SUPPORT_EMAIL = normalizeUrl(process.env.EXPO_PUBLIC_SUPPORT_EMAIL);

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
