import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';

type EdgeHandler = (request: Request) => Promise<Response>;

function loadCleanupStickerAssetsHandler(options: {
  createClient: (url: string, key: string, options?: unknown) => unknown;
  env: Record<string, string | undefined>;
}) {
  const source = readFileSync(
    resolve(__dirname, '../supabase/functions/cleanup-sticker-assets/index.ts'),
    'utf8'
  );
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  let handler: EdgeHandler | undefined;
  const context = {
    exports: {},
    module: { exports: {} },
    require: (specifier: string) => {
      if (specifier === 'jsr:@supabase/supabase-js@2') {
        return { createClient: options.createClient };
      }

      throw new Error(`Unexpected import: ${specifier}`);
    },
    Deno: {
      env: {
        get: (key: string) => options.env[key],
      },
      serve: (registeredHandler: EdgeHandler) => {
        handler = registeredHandler;
      },
    },
    Response,
    Request,
    Headers,
    console,
    setTimeout,
    clearTimeout,
  };

  Object.assign(context, { global: context, globalThis: context });
  runInNewContext(transpiled, context, {
    filename: 'supabase/functions/cleanup-sticker-assets/index.ts',
  });

  if (!handler) {
    throw new Error('Failed to capture cleanup-sticker-assets handler');
  }

  return handler;
}

function createCleanupFixtures() {
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    STICKER_GC_SECRET: 'gc-secret',
  };
  const storageRemovals: Array<{ bucket: string; paths: string[] }> = [];
  const deletedAssetIdBatches: string[][] = [];

  const candidateAssets = [
    {
      id: 'asset-stale',
      storage_bucket: ' sticker-bucket ',
      storage_path: ' stale/path.png ',
      last_seen_at: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'asset-referenced',
      storage_bucket: 'sticker-bucket',
      storage_path: 'referenced/path.png',
      last_seen_at: '2026-04-01T00:00:00.000Z',
    },
  ];
  const refs = [{ asset_id: 'asset-referenced' }];

  const adminClient = {
    storage: {
      from: (bucket: string) => ({
        remove: jest.fn(async (paths: string[]) => {
          storageRemovals.push({ bucket, paths });
          return { error: null };
        }),
      }),
    },
    from: (table: string) => {
      if (table === 'sticker_assets') {
        return {
          select: () => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(async () => ({
                  data: candidateAssets,
                  error: null,
                })),
              })),
            })),
          }),
          delete: () => ({
            in: jest.fn(async (_column: string, ids: string[]) => {
              deletedAssetIdBatches.push(ids);
              return { error: null };
            }),
          }),
        };
      }

      if (table === 'sticker_asset_refs') {
        return {
          select: () => ({
            in: jest.fn(async () => ({
              data: refs,
              error: null,
            })),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const createClient = jest.fn((url: string, key: string) => {
    if (url !== env.SUPABASE_URL || key !== env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(`Unexpected createClient args: ${url} ${key}`);
    }

    return adminClient;
  });

  return {
    createClient,
    deletedAssetIdBatches,
    env,
    storageRemovals,
  };
}

describe('cleanup-sticker-assets edge function', () => {
  it('requires STICKER_GC_SECRET to be configured before serving requests', async () => {
    const fixtures = createCleanupFixtures();
    const createClient = jest.fn();
    const handler = loadCleanupStickerAssetsHandler({
      createClient,
      env: {
        ...fixtures.env,
        STICKER_GC_SECRET: '',
      },
    });

    const response = await handler(
      new Request('https://example.com/cleanup-sticker-assets', {
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Cleanup secret is required for this function.',
    });
    expect(response.status).toBe(500);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('supports dry runs without deleting storage objects or registry rows', async () => {
    const fixtures = createCleanupFixtures();
    const handler = loadCleanupStickerAssetsHandler({
      createClient: fixtures.createClient,
      env: fixtures.env,
    });

    const response = await handler(
      new Request('https://example.com/cleanup-sticker-assets', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer gc-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: true,
          maxAgeDays: 14,
          limit: 20,
        }),
      })
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      dryRun: true,
      cutoff: expect.any(String),
      scanned: 2,
      deleted: 1,
      deletedAssetIds: ['asset-stale'],
    });
    expect(response.status).toBe(200);
    expect(fixtures.storageRemovals).toEqual([]);
    expect(fixtures.deletedAssetIdBatches).toEqual([]);
  });

  it('deletes only stale unreferenced sticker assets when authorized', async () => {
    const fixtures = createCleanupFixtures();
    const handler = loadCleanupStickerAssetsHandler({
      createClient: fixtures.createClient,
      env: fixtures.env,
    });

    const response = await handler(
      new Request('https://example.com/cleanup-sticker-assets', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer gc-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: false }),
      })
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      dryRun: false,
      cutoff: expect.any(String),
      scanned: 2,
      deleted: 1,
      deletedAssetIds: ['asset-stale'],
    });
    expect(response.status).toBe(200);
    expect(fixtures.storageRemovals).toEqual([
      {
        bucket: 'sticker-bucket',
        paths: ['stale/path.png'],
      },
    ]);
    expect(fixtures.deletedAssetIdBatches).toEqual([['asset-stale']]);
  });
});
