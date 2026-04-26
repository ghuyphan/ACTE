import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';

type EdgeHandler = (request: Request) => Promise<Response>;
type SupabaseError = { message: string } | null;

function loadDeleteAccountHandler(options: {
  createClient: (url: string, key: string, options?: unknown) => unknown;
  env: Record<string, string | undefined>;
}) {
  const source = readFileSync(
    resolve(__dirname, '../supabase/functions/delete-account/index.ts'),
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
    filename: 'supabase/functions/delete-account/index.ts',
  });

  if (!handler) {
    throw new Error('Failed to capture delete-account handler');
  }

  return handler;
}

function createDeleteAccountFixtures(options?: {
  userLastSignInAt?: string;
  mutationErrors?: Partial<Record<'sticker_asset_refs' | 'sticker_assets' | 'device_push_tokens', SupabaseError>>;
}) {
  const storageRemovals: Array<{ bucket: string; paths: string[] }> = [];
  const deleteUser = jest.fn(async () => ({ error: null }));
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  };

  const selectRows = {
    notes: [
      {
        photo_path: ' user-1/note/photo.jpg ',
        dual_primary_photo_path: 'user-1/note/dual-primary.jpg',
        dual_secondary_photo_path: 'attacker/note/dual-secondary.jpg',
        paired_video_path: 'user-1/note/video.mov',
        sticker_placements_json: JSON.stringify([
          { asset: { remotePath: 'user-1/stickers/note-sticker.png' } },
          { asset: { remotePath: ' user-1/stickers/note-sticker.png ' } },
          { asset: { remotePath: 'attacker/stickers/forged.png' } },
          { asset: { remotePath: 'user-1//stickers/empty-segment.png' } },
          { asset: { remotePath: 'user-1/./stickers/dot-segment.png' } },
          { asset: { remotePath: 'user-1/stickers/space name.png' } },
        ]),
      },
    ],
    shared_posts: [
      {
        photo_path: 'user-1/shared/photo.jpg',
        dual_primary_photo_path: 'user-1/shared/dual-primary.jpg',
        dual_secondary_photo_path: 'attacker/shared/dual-secondary.jpg',
        paired_video_path: ' user-1/shared/video.mov ',
        sticker_placements_json: JSON.stringify([
          { asset: { remotePath: 'user-1/stickers/shared-sticker.png' } },
          { asset: { remotePath: '/user-1/stickers/rooted.png' } },
          { asset: { remotePath: 'user-1/stickers/../traversal.png' } },
        ]),
      },
    ],
    sticker_assets: [
      { storage_bucket: ' note-media ', storage_path: ' user-1/stickers/registered.png ' },
      { storage_bucket: ' note-media ', storage_path: ' user-1//stickers/registered-empty.png ' },
      { storage_bucket: ' shared-post-media ', storage_path: ' user-1/stickers/registered space.png ' },
      { storage_bucket: ' custom-bucket ', storage_path: ' custom/path.png ' },
    ],
  } as const;

  const mutationErrors = options?.mutationErrors ?? {};

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
      if (table === 'notes' || table === 'shared_posts' || table === 'sticker_assets') {
        return {
          select: () => ({
            eq: jest.fn(async () => ({
              data: selectRows[table],
              error: null,
            })),
          }),
          delete: () => ({
            eq: jest.fn(async () => ({
              error: mutationErrors.sticker_assets ?? null,
            })),
          }),
        };
      }

      if (table === 'sticker_asset_refs') {
        return {
          delete: () => ({
            eq: jest.fn(async () => ({
              error: mutationErrors.sticker_asset_refs ?? null,
            })),
          }),
        };
      }

      if (table === 'device_push_tokens') {
        return {
          delete: () => ({
            eq: jest.fn(async () => ({
              error: mutationErrors.device_push_tokens ?? null,
            })),
          }),
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    },
    auth: {
      admin: {
        deleteUser,
      },
    },
  };

  const userClient = {
    auth: {
      getUser: jest.fn(async () => ({
        data: {
          user: {
            id: 'user-1',
            last_sign_in_at: options?.userLastSignInAt ?? new Date().toISOString(),
          },
        },
        error: null,
      })),
    },
  };

  const createClient = jest.fn((url: string, key: string) => {
    if (url !== env.SUPABASE_URL) {
      throw new Error(`Unexpected url ${url}`);
    }

    if (key === env.SUPABASE_ANON_KEY) {
      return userClient;
    }

    if (key === env.SUPABASE_SERVICE_ROLE_KEY) {
      return adminClient;
    }

    throw new Error(`Unexpected key ${key}`);
  });

  return {
    createClient,
    deleteUser,
    env,
    storageRemovals,
  };
}

describe('delete-account edge function', () => {
  it('removes note, shared-post, and sticker storage before deleting the auth user', async () => {
    const fixtures = createDeleteAccountFixtures();
    const handler = loadDeleteAccountHandler({
      createClient: fixtures.createClient,
      env: fixtures.env,
    });

    const response = await handler(
      new Request('https://example.com/delete-account', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-jwt',
        },
      })
    );

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.status).toBe(200);
    expect(fixtures.deleteUser).toHaveBeenCalledWith('user-1');
    expect(fixtures.storageRemovals).toEqual(
      expect.arrayContaining([
        {
          bucket: 'note-media',
          paths: expect.arrayContaining([
            'user-1/note/photo.jpg',
            'user-1/note/dual-primary.jpg',
            'user-1/note/video.mov',
            'user-1/stickers/note-sticker.png',
          ]),
        },
        {
          bucket: 'shared-post-media',
          paths: expect.arrayContaining([
            'user-1/shared/photo.jpg',
            'user-1/shared/dual-primary.jpg',
            'user-1/shared/video.mov',
            'user-1/stickers/shared-sticker.png',
          ]),
        },
        {
          bucket: 'note-media',
          paths: ['user-1/stickers/registered.png'],
        },
      ])
    );
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('attacker');
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('custom/path.png');
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('empty-segment');
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('dot-segment');
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('space name');
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('rooted');
    expect(JSON.stringify(fixtures.storageRemovals)).not.toContain('traversal');
  });

  it('fails safely and skips auth deletion when sticker asset record cleanup fails', async () => {
    const fixtures = createDeleteAccountFixtures({
      mutationErrors: {
        sticker_asset_refs: { message: 'refs delete failed' },
      },
    });
    const handler = loadDeleteAccountHandler({
      createClient: fixtures.createClient,
      env: fixtures.env,
    });

    const response = await handler(new Request('https://example.com/delete-account', { method: 'POST' }));

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Could not delete this account right now.',
    });
    expect(response.status).toBe(500);
    expect(fixtures.deleteUser).not.toHaveBeenCalled();
  });

  it('fails safely and skips auth deletion when push token cleanup fails', async () => {
    const fixtures = createDeleteAccountFixtures({
      mutationErrors: {
        device_push_tokens: { message: 'push token delete failed' },
      },
    });
    const handler = loadDeleteAccountHandler({
      createClient: fixtures.createClient,
      env: fixtures.env,
    });

    const response = await handler(new Request('https://example.com/delete-account', { method: 'POST' }));

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Could not delete this account right now.',
    });
    expect(response.status).toBe(500);
    expect(fixtures.deleteUser).not.toHaveBeenCalled();
  });
});
