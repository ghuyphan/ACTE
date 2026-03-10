export const GOOGLE_WEB_CLIENT_ID =
  '380816810604-jcr2hrg0ofnh9iblp1vd67nq294qad60.apps.googleusercontent.com';

export const isGoogleSigninConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID &&
  !GOOGLE_WEB_CLIENT_ID.includes('Replace') &&
  !GOOGLE_WEB_CLIENT_ID.includes('replace')
);
