function sanitizePublicEnv(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue && !trimmedValue.includes('Replace') && !trimmedValue.includes('replace')
    ? trimmedValue
    : '';
}

function readGoogleWebClientId() {
  const value = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  return sanitizePublicEnv(value);
}

function readGoogleIosClientId() {
  const value = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  return sanitizePublicEnv(value);
}

function readGoogleAndroidClientId() {
  const value = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  return sanitizePublicEnv(value);
}

export const GOOGLE_WEB_CLIENT_ID = readGoogleWebClientId();
export const GOOGLE_IOS_CLIENT_ID = readGoogleIosClientId();
export const GOOGLE_ANDROID_CLIENT_ID = readGoogleAndroidClientId();

export const isGoogleSigninConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID && GOOGLE_IOS_CLIENT_ID && GOOGLE_ANDROID_CLIENT_ID
);

export function getGoogleIosUrlScheme() {
  if (!GOOGLE_IOS_CLIENT_ID) {
    return '';
  }

  const suffix = GOOGLE_IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/i, '');
  return suffix ? `com.googleusercontent.apps.${suffix}` : '';
}
