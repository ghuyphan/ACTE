import { createClient } from 'jsr:@supabase/supabase-js@2';

type DeleteAccountResponse =
  | { success: true }
  | { success: false; error: string };

type MediaRow = {
  photo_path?: string | null;
  paired_video_path?: string | null;
  sticker_placements_json?: string | null;
};

type StickerAssetRow = {
  storage_bucket?: string | null;
  storage_path?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECENT_SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000;

function hasRecentSignIn(lastSignInAt: string | null | undefined) {
  const timestamp = new Date(lastSignInAt ?? '').getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= RECENT_SIGN_IN_MAX_AGE_MS;
}

function addStoragePath(target: Set<string>, value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized) {
    target.add(normalized);
  }
}

function collectStickerRemotePaths(rawValue: string | null | undefined) {
  if (!rawValue?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as Array<{
      asset?: {
        remotePath?: string | null;
      };
    }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((placement) => placement?.asset?.remotePath?.trim() ?? '')
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

async function removeStorageObjects(
  adminClient: ReturnType<typeof createClient>,
  bucket: string,
  paths: Iterable<string>
) {
  const uniquePaths = [...new Set(Array.from(paths).filter(Boolean))];
  if (uniquePaths.length === 0) {
    return;
  }

  for (let index = 0; index < uniquePaths.length; index += 100) {
    const chunk = uniquePaths.slice(index, index + 100);
    const { error } = await adminClient.storage.from(bucket).remove(chunk);
    if (error) {
      throw error;
    }
  }
}

async function cleanupOwnedMedia(
  adminClient: ReturnType<typeof createClient>,
  userId: string
) {
  const notePaths = new Set<string>();
  const sharedPostPaths = new Set<string>();
  const roomPostPaths = new Set<string>();
  const stickerAssetPathsByBucket = new Map<string, Set<string>>();

  const [
    { data: notes, error: notesError },
    { data: sharedPosts, error: sharedPostsError },
    { data: roomPosts, error: roomPostsError },
    { data: stickerAssets, error: stickerAssetsError },
  ] = await Promise.all([
    adminClient
      .from('notes')
      .select('photo_path, paired_video_path, sticker_placements_json')
      .eq('user_id', userId),
    adminClient
      .from('shared_posts')
      .select('photo_path, paired_video_path, sticker_placements_json')
      .eq('author_user_id', userId),
    adminClient.from('room_posts').select('photo_path').eq('author_user_id', userId),
    adminClient
      .from('sticker_assets')
      .select('storage_bucket, storage_path')
      .eq('owner_user_id', userId),
  ]);

  if (notesError) {
    throw notesError;
  }

  if (sharedPostsError) {
    throw sharedPostsError;
  }

  if (roomPostsError) {
    throw roomPostsError;
  }
  if (stickerAssetsError) {
    throw stickerAssetsError;
  }

  for (const row of (notes ?? []) as MediaRow[]) {
    addStoragePath(notePaths, row.photo_path);
    addStoragePath(notePaths, row.paired_video_path);
    for (const stickerPath of collectStickerRemotePaths(row.sticker_placements_json)) {
      notePaths.add(stickerPath);
    }
  }

  for (const row of (sharedPosts ?? []) as MediaRow[]) {
    addStoragePath(sharedPostPaths, row.photo_path);
    addStoragePath(sharedPostPaths, row.paired_video_path);
    for (const stickerPath of collectStickerRemotePaths(row.sticker_placements_json)) {
      sharedPostPaths.add(stickerPath);
    }
  }

  for (const row of (roomPosts ?? []) as MediaRow[]) {
    addStoragePath(roomPostPaths, row.photo_path);
  }

  for (const row of (stickerAssets ?? []) as StickerAssetRow[]) {
    const bucket = typeof row.storage_bucket === 'string' ? row.storage_bucket.trim() : '';
    const path = typeof row.storage_path === 'string' ? row.storage_path.trim() : '';
    if (!bucket || !path) {
      continue;
    }

    const bucketPaths = stickerAssetPathsByBucket.get(bucket) ?? new Set<string>();
    bucketPaths.add(path);
    stickerAssetPathsByBucket.set(bucket, bucketPaths);
  }

  await Promise.all([
    removeStorageObjects(adminClient, 'note-media', notePaths),
    removeStorageObjects(adminClient, 'shared-post-media', sharedPostPaths),
    removeStorageObjects(adminClient, 'room-post-media', roomPostPaths),
    ...Array.from(stickerAssetPathsByBucket.entries()).map(([bucket, paths]) =>
      removeStorageObjects(adminClient, bucket, paths)
    ),
  ]);

  await adminClient.from('sticker_asset_refs').delete().eq('owner_user_id', userId);
  await adminClient.from('sticker_assets').delete().eq('owner_user_id', userId);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authorization = request.headers.get('Authorization') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: 'Delete account function is not configured on the server.',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: 'Authentication required.',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!hasRecentSignIn(user.last_sign_in_at)) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: 'Recent sign-in required. Sign in again before deleting your account.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    await cleanupOwnedMedia(adminClient, user.id);
    await adminClient.from('device_push_tokens').delete().eq('user_id', user.id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: deleteError.message || 'Could not delete this account right now.',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json<DeleteAccountResponse>({ success: true }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected delete-account failure.';
    return Response.json<DeleteAccountResponse>(
      {
        success: false,
        error: message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
});
