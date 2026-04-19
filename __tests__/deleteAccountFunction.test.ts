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
        photo_path: ' note/photo.jpg ',
        paired_video_path: 'note/video.mov',
        sticker_placements_json: JSON.stringify([
          { asset: { remotePath: 'stickers/note-sticker.png' } },
          { asset: { remotePath: ' stickers/note-sticker.png ' } },
        ]),
      },
    ],
    shared_posts: [
      {
        photo_path: 'shared/photo.jpg',
        paired_video_path: ' shared/video.mov ',
        sticker_placements_json: JSON.stringify([
          { asset: { remotePath: 'stickers/shared-sticker.png' } },
        ]),
      },
    ],
    room_posts: [{ photo_path: 'room/photo.jpg' }],
    sticker_assets: [{ storage_bucket: ' custom-bucket ', storage_path: ' custom/path.png ' }],
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
      if (table === 'notes' || table === 'shared_posts' || table === 'room_posts' || table === 'sticker_assets') {
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
  it('removes note, shared-post, room, and sticker storage before deleting the auth user', async () => {
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
            'note/photo.jpg',
            'note/video.mov',
            'stickers/note-sticker.png',
          ]),
        },
        {
          bucket: 'shared-post-media',
          paths: expect.arrayContaining([
            'shared/photo.jpg',
            'shared/video.mov',
            'stickers/shared-sticker.png',
          ]),
        },
        {
          bucket: 'room-post-media',
          paths: ['room/photo.jpg'],
        },
        {
          bucket: 'custom-bucket',
          paths: ['custom/path.png'],
        },
      ])
    );
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
      error: 'Failed to delete sticker asset refs during account cleanup: refs delete failed',
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
      error: 'Failed to delete device push tokens during account cleanup: push token delete failed',
    });
    expect(response.status).toBe(500);
    expect(fixtures.deleteUser).not.toHaveBeenCalled();
  });
});
