import Constants from 'expo-constants';
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

function getExpoExtra() {
  return (Constants.expoConfig?.extra as
    | {
        publicSiteBaseUrl?: string;
        supportUrl?: string;
        privacyPolicyUrl?: string;
        accountDeletionUrl?: string;
        supportEmail?: string;
      }
    | undefined) ?? undefined;
}

export const PRIVACY_POLICY_URL = resolveLegalValue(
  getExpoExtra()?.privacyPolicyUrl ?? process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  DEV_PRIVACY_POLICY_URL
);
export const SUPPORT_URL = resolveLegalValue(
  getExpoExtra()?.supportUrl ?? process.env.EXPO_PUBLIC_SUPPORT_URL,
  DEV_SUPPORT_URL
);
export const ACCOUNT_DELETION_URL = resolveLegalValue(
  getExpoExtra()?.accountDeletionUrl ?? process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  DEV_ACCOUNT_DELETION_URL
);
export const SUPPORT_EMAIL = resolveLegalValue(
  getExpoExtra()?.supportEmail ?? process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  DEV_SUPPORT_EMAIL
);

function getPublicSiteReferenceUrl() {
  return [SUPPORT_URL, PRIVACY_POLICY_URL, ACCOUNT_DELETION_URL].find(Boolean) ?? '';
}

function getPublicSiteBaseUrl() {
  const extraBaseUrl = normalizeUrl(getExpoExtra()?.publicSiteBaseUrl);
  if (extraBaseUrl) {
    return extraBaseUrl;
  }

  const referenceUrl = getPublicSiteReferenceUrl();
  if (!referenceUrl) {
    return '';
  }

  try {
    const parsed = new URL(referenceUrl);
    const normalizedPath = parsed.pathname.endsWith('/')
      ? parsed.pathname
      : parsed.pathname.replace(/[^/]*$/, '');

    parsed.pathname = normalizedPath || '/';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return '';
  }
}

export function buildPublicSiteUrl(
  pathname: string,
  queryParams?: Record<string, string | null | undefined>
) {
  const baseUrl = getPublicSiteBaseUrl();
  if (!baseUrl) {
    return '';
  }

  try {
    const nextUrl = new URL(pathname.replace(/^\//, ''), baseUrl);

    Object.entries(queryParams ?? {}).forEach(([key, value]) => {
      const normalizedValue = value?.trim();
      if (!normalizedValue) {
        return;
      }
      nextUrl.searchParams.set(key, normalizedValue);
    });

    return nextUrl.toString();
  } catch {
    return '';
  }
}

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
