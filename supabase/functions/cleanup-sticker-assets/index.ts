import { createClient } from 'jsr:@supabase/supabase-js@2';

type CleanupStickerAssetsRequest = {
  dryRun?: boolean;
  maxAgeDays?: number;
  limit?: number;
};

type CleanupStickerAssetsResponse =
  | {
      success: true;
      dryRun: boolean;
      cutoff: string;
      scanned: number;
      deleted: number;
      deletedAssetIds: string[];
    }
  | {
      success: false;
      error: string;
    };

type StickerAssetRow = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  last_seen_at: string | null;
};

type StickerAssetRefRow = {
  asset_id: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MAX_AGE_DAYS = 7;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const STORAGE_DELETE_BATCH_SIZE = 100;

function jsonResponse(body: CleanupStickerAssetsResponse, status = 200) {
  return Response.json<CleanupStickerAssetsResponse>(body, {
    status,
    headers: corsHeaders,
  });
}

function clampLimit(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(numericValue), MAX_LIMIT);
}

function clampMaxAgeDays(value: unknown) {
  const numericValue =
    typeof value === 'number' ? value : Number(value ?? DEFAULT_MAX_AGE_DAYS);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return DEFAULT_MAX_AGE_DAYS;
  }

  return Math.max(1, Math.floor(numericValue));
}

function getCutoffIso(maxAgeDays: number) {
  return new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
}

async function removeStorageObjects(
  adminClient: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[]
) {
  if (paths.length === 0) {
    return;
  }

  for (let index = 0; index < paths.length; index += STORAGE_DELETE_BATCH_SIZE) {
    const chunk = paths.slice(index, index + STORAGE_DELETE_BATCH_SIZE);
    const { error } = await adminClient.storage.from(bucket).remove(chunk);
    if (error) {
      throw error;
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const cleanupSecret = Deno.env.get('STICKER_GC_SECRET') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          success: false,
          error: 'Cleanup function is not configured on the server.',
        },
        500
      );
    }

    if (cleanupSecret) {
      const authorization = request.headers.get('Authorization') ?? '';
      if (authorization !== `Bearer ${cleanupSecret}`) {
        return jsonResponse(
          {
            success: false,
            error: 'Unauthorized.',
          },
          401
        );
      }
    }

    const requestBody =
      request.method === 'POST'
        ? (((await request.json().catch(() => ({}))) as CleanupStickerAssetsRequest) ?? {})
        : {};
    const dryRun = requestBody.dryRun === true;
    const limit = clampLimit(requestBody.limit);
    const maxAgeDays = clampMaxAgeDays(requestBody.maxAgeDays);
    const cutoff = getCutoffIso(maxAgeDays);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: candidateAssets, error: candidateError } = await adminClient
      .from('sticker_assets')
      .select('id, storage_bucket, storage_path, last_seen_at')
      .lte('last_seen_at', cutoff)
      .order('last_seen_at', { ascending: true })
      .limit(limit);

    if (candidateError) {
      throw candidateError;
    }

    const candidates = (candidateAssets ?? []) as StickerAssetRow[];
    if (candidates.length === 0) {
      return jsonResponse({
        success: true,
        dryRun,
        cutoff,
        scanned: 0,
        deleted: 0,
        deletedAssetIds: [],
      });
    }

    const candidateAssetIds = candidates
      .map((asset) => (typeof asset.id === 'string' ? asset.id.trim() : ''))
      .filter(Boolean);
    const { data: refs, error: refsError } = await adminClient
      .from('sticker_asset_refs')
      .select('asset_id')
      .in('asset_id', candidateAssetIds);

    if (refsError) {
      throw refsError;
    }

    const referencedAssetIds = new Set(
      ((refs ?? []) as StickerAssetRefRow[])
        .map((row) => (typeof row.asset_id === 'string' ? row.asset_id.trim() : ''))
        .filter(Boolean)
    );
    const staleAssets = candidates.filter((asset) => !referencedAssetIds.has(asset.id));
    const deletedAssetIds = staleAssets.map((asset) => asset.id);

    if (!dryRun && staleAssets.length > 0) {
      const pathsByBucket = new Map<string, string[]>();
      for (const asset of staleAssets) {
        const bucket = typeof asset.storage_bucket === 'string' ? asset.storage_bucket.trim() : '';
        const path = typeof asset.storage_path === 'string' ? asset.storage_path.trim() : '';
        if (!bucket || !path) {
          continue;
        }

        const currentPaths = pathsByBucket.get(bucket) ?? [];
        currentPaths.push(path);
        pathsByBucket.set(bucket, currentPaths);
      }

      for (const [bucket, paths] of pathsByBucket.entries()) {
        await removeStorageObjects(adminClient, bucket, paths);
      }

      const { error: deleteError } = await adminClient
        .from('sticker_assets')
        .delete()
        .in('id', deletedAssetIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    return jsonResponse({
      success: true,
      dryRun,
      cutoff,
      scanned: candidates.length,
      deleted: deletedAssetIds.length,
      deletedAssetIds,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cleanup error',
      },
      500
    );
  }
});
