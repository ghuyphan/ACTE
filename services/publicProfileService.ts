import { deriveUsernameCandidate } from '../utils/appUser';
import { getSupabase, isSupabaseNoRowsError } from '../utils/supabase';

export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export interface PublicUserProfile {
  displayName: string | null;
  username: string | null;
  usernameSetAt: string | null;
  photoURL: string | null;
  updatedAt: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  username: string | null;
  username_set_at: string | null;
  photo_url: string | null;
  updated_at: string;
}

export interface PublicProfileSnapshot {
  username: string | null;
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
}

export function buildPublicProfileSnapshot(input: {
  displayName: string | null | undefined;
  username: string | null | undefined;
  photoURL: string | null | undefined;
}): PublicProfileSnapshot {
  const normalizedUsername = input.username?.trim().toLowerCase() || null;
  const normalizedDisplayName = input.displayName?.trim() || null;

  return {
    username: normalizedUsername,
    displayNameSnapshot: normalizedUsername || normalizedDisplayName,
    photoURLSnapshot: input.photoURL ?? null,
  };
}

function mapPublicUserProfile(row: ProfileRow): PublicUserProfile {
  return {
    displayName: row.display_name?.trim() || null,
    username: row.username?.trim().toLowerCase() || null,
    usernameSetAt: row.username_set_at ?? null,
    photoURL: row.photo_url ?? null,
    updatedAt: row.updated_at,
  };
}

export function normalizeUsernameInput(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function validateUsernameInput(value: string) {
  const normalizedValue = normalizeUsernameInput(value);

  if (!normalizedValue) {
    return 'required' as const;
  }

  if (normalizedValue.length > USERNAME_MAX_LENGTH) {
    return 'too_long' as const;
  }

  if (!USERNAME_PATTERN.test(normalizedValue)) {
    return 'invalid' as const;
  }

  return null;
}

export async function upsertPublicUserProfile(input: {
  userUid: string;
  displayName: string | null | undefined;
  username?: string | null | undefined;
  email?: string | null | undefined;
  photoURL: string | null | undefined;
}): Promise<PublicUserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedDisplayName = input.displayName?.trim() || null;
  const normalizedUsername = input.username?.trim().toLowerCase() || null;
  const usernameSeed = normalizedUsername || input.email?.trim() || normalizedDisplayName || input.userUid;

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id, display_name, username, username_set_at, photo_url, updated_at')
    .eq('id', input.userUid)
    .maybeSingle<ProfileRow>();

  if (existingProfileError && !isSupabaseNoRowsError(existingProfileError)) {
    throw existingProfileError;
  }

  if (existingProfile) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: normalizedDisplayName,
        photo_url: input.photoURL ?? null,
        updated_at: now,
      })
      .eq('id', input.userUid)
      .select('id, display_name, username, username_set_at, photo_url, updated_at')
      .single<ProfileRow>();

    if (error) {
      throw error;
    }

    return data ? mapPublicUserProfile(data) : null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: input.userUid,
      display_name: normalizedDisplayName,
      username: deriveUsernameCandidate(usernameSeed),
      photo_url: input.photoURL ?? null,
      updated_at: now,
    })
    .select('id, display_name, username, username_set_at, photo_url, updated_at')
    .single<ProfileRow>();

  if (error) {
    throw error;
  }

  return data ? mapPublicUserProfile(data) : null;
}

export async function getPublicUserProfile(userUid: string): Promise<PublicProfileSnapshot> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      username: null,
      displayNameSnapshot: null,
      photoURLSnapshot: null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, username_set_at, photo_url, updated_at')
    .eq('id', userUid)
    .single<ProfileRow>();

  if (error) {
    if (isSupabaseNoRowsError(error)) {
      return {
        username: null,
        displayNameSnapshot: null,
        photoURLSnapshot: null,
      };
    }

    throw error;
  }

  const profile = mapPublicUserProfile(data);

  return buildPublicProfileSnapshot(profile);
}

export async function updateOwnUsername(input: {
  userUid: string;
  username: string;
}): Promise<PublicUserProfile> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Shared feed is unavailable in this build.');
  }

  const normalizedUsername = normalizeUsernameInput(input.username);
  const validationError = validateUsernameInput(normalizedUsername);

  if (validationError === 'required') {
    throw new Error('Username required.');
  }

  if (validationError === 'too_long') {
    throw new Error('Username must be 20 characters or fewer.');
  }

  if (validationError === 'invalid') {
    throw new Error('Username must use only lowercase letters, numbers, periods, or underscores.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: normalizedUsername,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.userUid)
    .select('id, display_name, username, username_set_at, photo_url, updated_at')
    .single<ProfileRow>();

  if (error) {
    throw error;
  }

  return mapPublicUserProfile(data);
}
