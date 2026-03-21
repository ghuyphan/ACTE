import { getSupabase, isSupabaseNoRowsError } from '../utils/supabase';

export interface PublicUserProfile {
  displayName: string | null;
  photoURL: string | null;
  updatedAt: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  updated_at: string;
}

export interface PublicProfileSnapshot {
  displayNameSnapshot: string | null;
  photoURLSnapshot: string | null;
}

export function buildPublicProfileSnapshot(input: {
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
}): PublicProfileSnapshot {
  return {
    displayNameSnapshot: input.displayName?.trim() || null,
    photoURLSnapshot: input.photoURL ?? null,
  };
}

export async function upsertPublicUserProfile(input: {
  userUid: string;
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
}) {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  const now = new Date().toISOString();
  const { displayNameSnapshot, photoURLSnapshot } = buildPublicProfileSnapshot(input);
  const { error } = await supabase.from('profiles').upsert(
    {
      id: input.userUid,
      display_name: displayNameSnapshot,
      photo_url: photoURLSnapshot,
      updated_at: now,
    },
    {
      onConflict: 'id',
    }
  );

  if (error) {
    throw error;
  }
}

export async function getPublicUserProfile(userUid: string): Promise<PublicProfileSnapshot> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      displayNameSnapshot: null,
      photoURLSnapshot: null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, photo_url, updated_at')
    .eq('id', userUid)
    .single<ProfileRow>();

  if (error) {
    if (isSupabaseNoRowsError(error)) {
      return {
        displayNameSnapshot: null,
        photoURLSnapshot: null,
      };
    }

    throw error;
  }

  return buildPublicProfileSnapshot({
    displayName: data.display_name ?? null,
    photoURL: data.photo_url ?? null,
  });
}
