import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

type SupabaseAdminClient = ReturnType<typeof createClient<any, 'public', any>>;

type DeleteAccountResponse =
  | { success: true }
  | { success: false; error: string };

type MediaRow = {
  photo_path?: string | null;
  dual_primary_photo_path?: string | null;
  dual_secondary_photo_path?: string | null;
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

function normalizeStoragePath(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const isSafePath =
    normalized &&
    !normalized.startsWith('/') &&
    !normalized.includes('//') &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(normalized) &&
    !normalized.split('/').some((segment) => segment === '.' || segment === '..');
  return isSafePath ? normalized : '';
}

function isUserOwnedStoragePath(userId: string, value: string | null | undefined) {
  const normalized = normalizeStoragePath(value);
  return Boolean(normalized && normalized.startsWith(`${userId}/`));
}

function addStoragePath(
  target: Set<string>,
  value: string | null | undefined,
  isAllowed: (path: string) => boolean
) {
  const normalized = normalizeStoragePath(value);
  if (normalized && isAllowed(normalized)) {
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

function throwIfMutationFailed(error: { message?: string | null } | null, context: string) {
  if (!error) {
    return;
  }

  const suffix = typeof error.message === 'string' && error.message.trim().length > 0
    ? `: ${error.message}`
    : '.';
  throw new Error(`${context}${suffix}`);
}

async function removeStorageObjects(
  adminClient: SupabaseAdminClient,
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
  adminClient: SupabaseAdminClient,
  userId: string
) {
  const notePaths = new Set<string>();
  const sharedPostPaths = new Set<string>();
  const stickerAssetPathsByBucket = new Map<string, Set<string>>();

  const [
    { data: notes, error: notesError },
    { data: sharedPosts, error: sharedPostsError },
    { data: stickerAssets, error: stickerAssetsError },
  ] = await Promise.all([
    adminClient
      .from('notes')
      .select('photo_path, dual_primary_photo_path, dual_secondary_photo_path, paired_video_path, sticker_placements_json')
      .eq('user_id', userId),
    adminClient
      .from('shared_posts')
      .select('photo_path, dual_primary_photo_path, dual_secondary_photo_path, paired_video_path, sticker_placements_json')
      .eq('author_user_id', userId),
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

  if (stickerAssetsError) {
    throw stickerAssetsError;
  }

  for (const row of (notes ?? []) as MediaRow[]) {
    const addOwnedNotePath = (path: string | null | undefined) =>
      addStoragePath(notePaths, path, (normalizedPath) => isUserOwnedStoragePath(userId, normalizedPath));
    addOwnedNotePath(row.photo_path);
    addOwnedNotePath(row.dual_primary_photo_path);
    addOwnedNotePath(row.dual_secondary_photo_path);
    addOwnedNotePath(row.paired_video_path);
    for (const stickerPath of collectStickerRemotePaths(row.sticker_placements_json)) {
      addOwnedNotePath(stickerPath);
    }
  }

  for (const row of (sharedPosts ?? []) as MediaRow[]) {
    const addOwnedSharedPostPath = (path: string | null | undefined) =>
      addStoragePath(sharedPostPaths, path, (normalizedPath) => isUserOwnedStoragePath(userId, normalizedPath));
    addOwnedSharedPostPath(row.photo_path);
    addOwnedSharedPostPath(row.dual_primary_photo_path);
    addOwnedSharedPostPath(row.dual_secondary_photo_path);
    addOwnedSharedPostPath(row.paired_video_path);
    for (const stickerPath of collectStickerRemotePaths(row.sticker_placements_json)) {
      addOwnedSharedPostPath(stickerPath);
    }
  }

  for (const row of (stickerAssets ?? []) as StickerAssetRow[]) {
    const bucket = typeof row.storage_bucket === 'string' ? row.storage_bucket.trim() : '';
    const path = typeof row.storage_path === 'string' ? row.storage_path.trim() : '';
    if (!bucket || !path) {
      continue;
    }

    const isAllowedStickerPath =
      (bucket === 'note-media' || bucket === 'shared-post-media') &&
      isUserOwnedStoragePath(userId, path);
    if (!isAllowedStickerPath) {
      continue;
    }

    const bucketPaths = stickerAssetPathsByBucket.get(bucket) ?? new Set<string>();
    bucketPaths.add(path);
    stickerAssetPathsByBucket.set(bucket, bucketPaths);
  }

  await Promise.all([
    removeStorageObjects(adminClient, 'note-media', notePaths),
    removeStorageObjects(adminClient, 'shared-post-media', sharedPostPaths),
    ...Array.from(stickerAssetPathsByBucket.entries()).map(([bucket, paths]) =>
      removeStorageObjects(adminClient, bucket, paths)
    ),
  ]);

  const { error: stickerAssetRefsDeleteError } = await adminClient
    .from('sticker_asset_refs')
    .delete()
    .eq('owner_user_id', userId);
  throwIfMutationFailed(
    stickerAssetRefsDeleteError,
    'Failed to delete sticker asset refs during account cleanup'
  );

  const { error: stickerAssetsDeleteError } = await adminClient
    .from('sticker_assets')
    .delete()
    .eq('owner_user_id', userId);
  throwIfMutationFailed(
    stickerAssetsDeleteError,
    'Failed to delete sticker assets during account cleanup'
  );
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
      return Response.json(
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
      return Response.json(
        {
          success: false,
          error: 'Authentication required.',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!hasRecentSignIn(user.last_sign_in_at)) {
      return Response.json(
        {
          success: false,
          error: 'Recent sign-in required. Sign in again before deleting your account.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    await cleanupOwnedMedia(adminClient, user.id);
    const { error: devicePushTokensDeleteError } = await adminClient
      .from('device_push_tokens')
      .delete()
      .eq('user_id', user.id);
    throwIfMutationFailed(
      devicePushTokensDeleteError,
      'Failed to delete device push tokens during account cleanup'
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('delete-account auth deletion failed:', deleteError);
      return Response.json(
        {
          success: false,
          error: 'Could not delete this account right now.',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json({ success: true } satisfies DeleteAccountResponse, { headers: corsHeaders });
  } catch (error) {
    console.error('delete-account failed:', error);
    return Response.json(
      {
        success: false,
        error: 'Could not delete this account right now.',
      },
      { status: 500, headers: corsHeaders }
    );
  }
});
