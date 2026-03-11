// This must be the Web OAuth client ID from your Firebase/Google Cloud project.
export const GOOGLE_WEB_CLIENT_ID =
  '109971343259-8p53qceictfcdsvajerujvjdhmjjai2n.apps.googleusercontent.com';


export const isGoogleSigninConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID &&
  !GOOGLE_WEB_CLIENT_ID.includes('Replace') &&
  !GOOGLE_WEB_CLIENT_ID.includes('replace')
);
