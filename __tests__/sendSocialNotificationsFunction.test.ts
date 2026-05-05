import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';

type EdgeHandler = (request: Request) => Promise<Response>;

function loadSendSocialNotificationsHandler(options: {
  createClient: (url: string, key: string, options?: unknown) => unknown;
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
}) {
  const source = readFileSync(
    resolve(__dirname, '../supabase/functions/send-social-notifications/index.ts'),
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
    fetch: options.fetch,
    setTimeout,
    clearTimeout,
  };

  Object.assign(context, { global: context, globalThis: context });
  runInNewContext(transpiled, context, {
    filename: 'supabase/functions/send-social-notifications/index.ts',
  });

  if (!handler) {
    throw new Error('Failed to capture send-social-notifications handler');
  }

  return handler;
}

describe('send-social-notifications edge function', () => {
  it('reserves social push recipients before sending Expo messages', async () => {
    const env = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      EXPO_ACCESS_TOKEN: 'expo-token',
    };
    const rpc = jest.fn(async (functionName: string, args: Record<string, unknown>) => {
      if (functionName === 'claim_social_notification_event') {
        return {
          data: {
            resource_id: 'post-1',
            recipient_user_id: null,
          },
          error: null,
        };
      }

      if (functionName === 'reserve_social_notification_delivery') {
        return {
          data: [{ recipient_user_id: 'recipient-1' }],
          error: null,
        };
      }

      if (functionName === 'mark_social_notification_event_delivered') {
        return { data: null, error: null };
      }

      throw new Error(`Unexpected rpc: ${functionName}`);
    });
    const adminClient = {
      rpc,
      from: (table: string) => {
        if (table === 'shared_posts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: jest.fn(async () => ({
                    data: {
                      id: 'post-1',
                      author_user_id: 'actor-1',
                      author_display_name: 'Huy',
                      audience_user_ids: ['recipient-1', 'recipient-2'],
                      type: 'photo',
                      place_name: 'Da Nang',
                    },
                    error: null,
                  })),
                }),
              }),
            }),
          };
        }

        if (table === 'device_push_tokens') {
          return {
            select: () => ({
              in: jest.fn(async () => ({
                data: [
                  {
                    user_id: 'recipient-1',
                    expo_push_token: 'ExponentPushToken[one]',
                    platform: 'ios',
                  },
                  {
                    user_id: 'recipient-2',
                    expo_push_token: 'ExponentPushToken[two]',
                    platform: 'android',
                  },
                ],
                error: null,
              })),
            }),
            delete: () => ({
              in: jest.fn(async () => ({ error: null })),
            }),
          };
        }

        throw new Error(`Unexpected admin table ${table}`);
      },
    };
    const userClient = {
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'actor-1' } },
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
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '[]')) as Array<{ to: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].to).toBe('ExponentPushToken[one]');
      return Response.json({ data: [{ status: 'ok' }] });
    }) as jest.MockedFunction<typeof fetch>;
    const handler = loadSendSocialNotificationsHandler({
      createClient,
      env,
      fetch: fetchMock,
    });

    const response = await handler(
      new Request('https://example.com/send-social-notifications', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-jwt',
        },
        body: JSON.stringify({ type: 'shared_post_created', postId: 'post-1' }),
      })
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      recipients: 2,
      delivered: 1,
    });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'reserve_social_notification_delivery',
      expect.objectContaining({
        actor_user_id_input: 'actor-1',
        event_type_input: 'shared_post_created',
        recipient_user_ids_input: ['recipient-1', 'recipient-2'],
        resource_id_input: 'post-1',
      })
    );
  });

  it('loads shared response notifications without requiring an embedded PostgREST relationship', async () => {
    const env = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      EXPO_ACCESS_TOKEN: 'expo-token',
    };
    const rpc = jest.fn(async (functionName: string, args: Record<string, unknown>) => {
      if (functionName === 'claim_social_notification_event') {
        return {
          data: {
            resource_id: args.resource_id_input,
            recipient_user_id: null,
          },
          error: null,
        };
      }

      if (functionName === 'reserve_social_notification_delivery') {
        return {
          data: [{ recipient_user_id: 'author-1' }],
          error: null,
        };
      }

      if (functionName === 'mark_social_notification_event_delivered') {
        return { data: null, error: null };
      }

      throw new Error(`Unexpected rpc: ${functionName}`);
    });
    const adminClient = {
      rpc,
      from: (table: string) => {
        if (table === 'shared_post_responses') {
          return {
            select: (columns: string) => {
              expect(columns).not.toContain('shared_posts(');
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: jest.fn(async () => ({
                      data: {
                        id: 'response-1',
                        post_id: 'post-1',
                        author_user_id: 'actor-1',
                        author_display_name: 'Mai',
                        emoji: null,
                        text: 'This place was so good',
                      },
                      error: null,
                    })),
                  }),
                }),
              };
            },
          };
        }

        if (table === 'shared_posts') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: jest.fn(async () => ({
                  data: {
                    id: 'post-1',
                    author_user_id: 'author-1',
                    audience_user_ids: ['actor-1'],
                    place_name: 'Da Nang',
                  },
                  error: null,
                })),
              }),
            }),
          };
        }

        if (table === 'device_push_tokens') {
          return {
            select: () => ({
              in: jest.fn(async () => ({
                data: [
                  {
                    user_id: 'author-1',
                    expo_push_token: 'ExponentPushToken[author]',
                    platform: 'android',
                  },
                ],
                error: null,
              })),
            }),
            delete: () => ({
              in: jest.fn(async () => ({ error: null })),
            }),
          };
        }

        throw new Error(`Unexpected admin table ${table}`);
      },
    };
    const userClient = {
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'actor-1' } },
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
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '[]')) as Array<{
        body?: string;
        data?: Record<string, unknown>;
        title?: string;
        to: string;
      }>;
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual(
        expect.objectContaining({
          to: 'ExponentPushToken[author]',
          title: 'Mai responded to your memory',
          body: 'This place was so good',
          data: expect.objectContaining({
            notificationType: 'shared-response',
            responseId: 'response-1',
            route: '/shared/chat/post-1',
            sharedPostId: 'post-1',
          }),
        })
      );
      return Response.json({ data: [{ status: 'ok' }] });
    }) as jest.MockedFunction<typeof fetch>;
    const handler = loadSendSocialNotificationsHandler({
      createClient,
      env,
      fetch: fetchMock,
    });

    const response = await handler(
      new Request('https://example.com/send-social-notifications', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-jwt',
        },
        body: JSON.stringify({
          type: 'shared_post_response_created',
          responseId: 'response-1',
        }),
      })
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      recipients: 1,
      delivered: 1,
    });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'reserve_social_notification_delivery',
      expect.objectContaining({
        actor_user_id_input: 'actor-1',
        event_type_input: 'shared_post_response_created',
        recipient_user_ids_input: ['author-1'],
        resource_id_input: 'response-1',
      })
    );
  });
});
