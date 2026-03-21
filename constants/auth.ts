function readPublicEnv(name: string) {
  const value = process.env[name]?.trim();
  return value && !value.includes('Replace') && !value.includes('replace') ? value : '';
}

export const GOOGLE_WEB_CLIENT_ID = readPublicEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
export const GOOGLE_IOS_CLIENT_ID = readPublicEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
export const GOOGLE_ANDROID_CLIENT_ID = readPublicEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');

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
