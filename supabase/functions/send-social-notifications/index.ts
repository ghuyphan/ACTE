import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

type SupabaseAdminClient = ReturnType<typeof createClient<any, 'public', any>>;

type SocialNotificationRequest =
  | {
      type: 'friend_accepted';
      friendUserId: string;
    }
  | {
      type: 'shared_post_created';
      postId: string;
    }
  | {
      type: 'shared_post_response_created';
      responseId: string;
    };

type SocialNotificationResponse =
  | {
      success: true;
      recipients: number;
      delivered: number;
    }
  | {
      success: false;
      error: string;
    };

type PushTargetRow = {
  user_id: string;
  expo_push_token: string;
  platform: string | null;
};

type ReservedNotificationRecipientRow = {
  recipient_user_id: string;
};

type PushTarget = {
  userId: string;
  token: string;
  platform: string;
};

type PushMessage = {
  to: string;
  sound?: 'default';
  title?: string;
  body?: string;
  channelId?: string;
  _contentAvailable?: boolean;
  data: Record<string, unknown>;
};

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  details?: {
    error?: string;
  };
};

type SharedPostRow = {
  id: string;
  author_user_id: string;
  author_display_name: string | null;
  audience_user_ids: string[] | null;
  type: 'text' | 'photo';
  place_name: string | null;
  text?: string | null;
};

type SharedPostResponseRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  author_display_name: string | null;
  emoji: string | null;
  text: string | null;
};

type ClaimedNotificationEvent = {
  resource_id: string;
  recipient_user_id: string | null;
};

class NotificationControlUnavailableError extends Error {
  constructor(control: 'idempotency' | 'rate-limit') {
    super(`Social notification ${control} control is unavailable.`);
    this.name = 'NotificationControlUnavailableError';
  }
}

const ANDROID_SOCIAL_CHANNEL_ID = 'social-v2';
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: SocialNotificationResponse, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || 'A friend';
}

function truncateNotificationLine(value: string, maxLength = 96) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getMemoryKindLabel(type: SharedPostRow['type']) {
  return type === 'photo' ? 'photo' : 'note';
}

function getMemoryContext(placeName: string) {
  return placeName ? ` from ${placeName}` : '';
}

function buildPushMessage(options: {
  token: string;
  platform: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}): PushMessage {
  const isSharedPost = options.data.notificationType === 'shared-post';
  if (isSharedPost) {
    const data = {
      ...options.data,
      notificationTitle: options.title,
      notificationBody: options.body,
      notificationChannelId: ANDROID_SOCIAL_CHANNEL_ID,
    };

    if (options.platform === 'ios') {
      return {
        to: options.token,
        _contentAvailable: true,
        data,
      };
    }

    if (options.platform === 'android') {
      return {
        to: options.token,
        data,
      };
    }

    return {
      to: options.token,
      sound: 'default',
      title: options.title,
      body: options.body,
      channelId: ANDROID_SOCIAL_CHANNEL_ID,
      _contentAvailable: true,
      data,
    };
  }

  return {
    to: options.token,
    sound: 'default',
    title: options.title,
    body: options.body,
    channelId: ANDROID_SOCIAL_CHANNEL_ID,
    data: options.data,
  };
}

async function getAuthenticatedUser(request: Request, supabaseUrl: string, anonKey: string) {
  const authorization = request.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new Error('Authentication required.');
  }

  return user;
}

async function loadFriendAcceptedPayload(
  adminClient: SupabaseAdminClient,
  actorUserId: string,
  friendUserId: string
) {
  const normalizedFriendUserId = friendUserId.trim();
  if (!normalizedFriendUserId) {
    throw new Error('Friend required.');
  }

  const { data: friendship, error: friendshipError } = await adminClient
    .from('friendships')
    .select('user_id, friend_user_id')
    .eq('user_id', actorUserId)
    .eq('friend_user_id', normalizedFriendUserId)
    .maybeSingle();

  if (friendshipError) {
    throw friendshipError;
  }

  if (!friendship) {
    throw new Error('Friendship not found.');
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('display_name')
    .eq('id', actorUserId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const actorDisplayName = normalizeDisplayName(
    profile && typeof profile === 'object' && 'display_name' in profile
      ? (profile as { display_name?: string | null }).display_name
      : null
  );

  return {
    recipientUserIds: [normalizedFriendUserId],
    title: `${actorDisplayName} accepted your invite`,
    body: 'You can now start sharing memories together in Noto.',
    data: {
      route: `/(tabs)?openSharedManageAt=${Date.now()}`,
      notificationType: 'friend-accepted',
      friendUserId: actorUserId,
    },
  };
}

async function loadSharedPostPayload(
  adminClient: SupabaseAdminClient,
  actorUserId: string,
  postId: string
) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    throw new Error('Shared post required.');
  }

  const { data: post, error: postError } = await adminClient
    .from('shared_posts')
    .select('id, author_user_id, author_display_name, audience_user_ids, type, text, place_name')
    .eq('id', normalizedPostId)
    .eq('author_user_id', actorUserId)
    .maybeSingle();

  if (postError) {
    throw postError;
  }

  if (!post) {
    throw new Error('Shared post not found.');
  }

  const typedPost = post as SharedPostRow;
  const actorDisplayName = normalizeDisplayName(typedPost.author_display_name);
  const placeName = typedPost.place_name?.trim() ?? '';
  const recipientUserIds = Array.from(
    new Set((typedPost.audience_user_ids ?? []).filter((userId) => userId && userId !== actorUserId))
  );

  if (recipientUserIds.length === 0) {
    return {
      recipientUserIds,
      title: '',
      body: '',
      data: {
        route: `/shared/${typedPost.id}`,
        sharedPostId: typedPost.id,
        notificationType: 'shared-post',
      },
    };
  }

  const memoryKind = getMemoryKindLabel(typedPost.type);
  const title = `${actorDisplayName} shared a ${memoryKind}${getMemoryContext(placeName)}`;
  const noteExcerpt = typedPost.type === 'text' ? truncateNotificationLine(typedPost.text ?? '', 90) : '';
  const body =
    noteExcerpt ||
    (placeName
      ? `A new Noto memory is waiting at ${placeName}.`
      : 'A new Noto memory is waiting for you.');

  return {
    recipientUserIds,
    title,
    body,
    data: {
      actorDisplayName,
      memoryType: typedPost.type,
      placeName,
      route: `/shared/${typedPost.id}`,
      sharedPostId: typedPost.id,
      notificationType: 'shared-post',
    },
  };
}

async function loadSharedPostResponsePayload(
  adminClient: SupabaseAdminClient,
  actorUserId: string,
  responseId: string
) {
  const normalizedResponseId = responseId.trim();
  if (!normalizedResponseId) {
    throw new Error('Response required.');
  }

  const { data: response, error: responseError } = await adminClient
    .from('shared_post_responses')
    .select('id, post_id, author_user_id, author_display_name, emoji, text')
    .eq('id', normalizedResponseId)
    .eq('author_user_id', actorUserId)
    .maybeSingle();

  if (responseError) {
    throw responseError;
  }

  if (!response) {
    throw new Error('Response not found.');
  }

  const typedResponse = response as SharedPostResponseRow;
  const { data: post, error: postError } = await adminClient
    .from('shared_posts')
    .select('id, author_user_id, audience_user_ids, type, place_name')
    .eq('id', typedResponse.post_id)
    .maybeSingle();

  if (postError) {
    throw postError;
  }

  if (!post) {
    throw new Error('Shared post not found.');
  }

  const typedPost = post as Pick<
    SharedPostRow,
    'id' | 'author_user_id' | 'audience_user_ids' | 'type' | 'place_name'
  >;
  const recipientUserIds = Array.from(
    new Set([typedPost.author_user_id, ...(typedPost.audience_user_ids ?? [])])
  ).filter((userId) => userId && userId !== actorUserId);
  const actorDisplayName = normalizeDisplayName(typedResponse.author_display_name);
  const text = typedResponse.text?.trim() ?? '';
  const emoji = typedResponse.emoji?.trim() ?? '';
  const placeName = typedPost.place_name?.trim() ?? '';
  const memoryContext = placeName ? ` to the ${placeName} memory` : ' to a memory';
  const body = text ? truncateNotificationLine(text, 96) : emoji || 'Open Noto to see their response.';
  const title = emoji && !text
    ? `${actorDisplayName} sent ${emoji}`
    : `${actorDisplayName} replied${memoryContext}`;

  return {
    recipientUserIds,
    title,
    body,
    data: {
      actorDisplayName,
      memoryType: typedPost.type,
      placeName,
      route: `/shared/chat/${typedPost.id}`,
      sharedPostId: typedPost.id,
      responseId: typedResponse.id,
      notificationType: 'shared-response',
    },
  };
}

async function loadPushTargets(
  adminClient: SupabaseAdminClient,
  userIds: string[]
) {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await adminClient
    .from('device_push_tokens')
    .select('user_id, expo_push_token, platform')
    .in('user_id', userIds);

  if (error) {
    throw error;
  }

  return Array.from(
    new Map(
      ((data ?? []) as PushTargetRow[])
        .map((row) => {
          const userId = row.user_id?.trim() ?? '';
          const token = row.expo_push_token?.trim() ?? '';
          return [
            token,
            {
              userId,
              token,
              platform: row.platform?.trim()?.toLowerCase() ?? '',
            },
          ] as const;
        })
        .filter(([token, target]) => Boolean(token) && Boolean(target.userId))
    ).values()
  ) satisfies PushTarget[];
}

async function reserveNotificationRecipients(
  adminClient: SupabaseAdminClient,
  options: {
    type: SocialNotificationRequest['type'];
    actorUserId: string;
    resourceId: string;
    recipientUserIds: string[];
  }
) {
  const normalizedRecipientUserIds = Array.from(
    new Set(options.recipientUserIds.map((userId) => userId.trim()).filter(Boolean))
  );
  if (normalizedRecipientUserIds.length === 0) {
    return [];
  }

  const { data, error } = await adminClient.rpc('reserve_social_notification_delivery', {
    event_type_input: options.type,
    actor_user_id_input: options.actorUserId,
    recipient_user_ids_input: normalizedRecipientUserIds,
    resource_id_input: options.resourceId,
  });

  if (error) {
    console.error('Failed to reserve social notification recipients:', error);
    throw new NotificationControlUnavailableError('rate-limit');
  }

  return Array.from(
    new Set(
      ((data ?? []) as ReservedNotificationRecipientRow[])
        .map((row) => row.recipient_user_id?.trim() ?? '')
        .filter(Boolean)
    )
  );
}

async function prunePushTokens(
  adminClient: SupabaseAdminClient,
  pushTokens: string[]
) {
  if (pushTokens.length === 0) {
    return;
  }

  const { error } = await adminClient
    .from('device_push_tokens')
    .delete()
    .in('expo_push_token', pushTokens);

  if (error) {
    throw error;
  }
}

async function claimNotificationEvent(
  adminClient: SupabaseAdminClient,
  options:
    | {
        type: 'friend_accepted';
        actorUserId: string;
        recipientUserId: string;
      }
    | {
        type: 'shared_post_created';
        actorUserId: string;
        resourceId: string;
      }
    | {
        type: 'shared_post_response_created';
        actorUserId: string;
        resourceId: string;
      }
) {
  const { data, error } = await adminClient.rpc('claim_social_notification_event', {
    event_type_input: options.type,
    actor_user_id_input: options.actorUserId,
    resource_id_input:
      options.type === 'shared_post_created' || options.type === 'shared_post_response_created'
        ? options.resourceId
        : null,
    recipient_user_id_input:
      options.type === 'friend_accepted' ? options.recipientUserId : null,
  });

  if (error) {
    console.error('Failed to claim social notification event:', error);
    throw new NotificationControlUnavailableError('idempotency');
  }

  const row = Array.isArray(data) ? data[0] : data;
  const resourceId =
    row && typeof row === 'object' && 'resource_id' in row
      ? String(row.resource_id ?? '').trim()
      : '';
  if (!resourceId) {
    return null;
  }

  return {
    resource_id: resourceId,
    recipient_user_id:
      row && typeof row === 'object' && 'recipient_user_id' in row
        ? typeof row.recipient_user_id === 'string' && row.recipient_user_id.trim()
          ? row.recipient_user_id.trim()
          : null
        : null,
  } satisfies ClaimedNotificationEvent;
}

async function releaseNotificationEvent(
  adminClient: SupabaseAdminClient,
  type: SocialNotificationRequest['type'],
  actorUserId: string,
  resourceId: string
) {
  const { error } = await adminClient.rpc('release_social_notification_event', {
    event_type_input: type,
    actor_user_id_input: actorUserId,
    resource_id_input: resourceId,
  });

  if (error) {
    console.warn('Failed to release social notification event claim:', error);
  }
}

async function markNotificationEventDelivered(
  adminClient: SupabaseAdminClient,
  type: SocialNotificationRequest['type'],
  actorUserId: string,
  resourceId: string
) {
  const { error } = await adminClient.rpc('mark_social_notification_event_delivered', {
    event_type_input: type,
    actor_user_id_input: actorUserId,
    resource_id_input: resourceId,
  });

  if (error) {
    console.warn('Failed to mark social notification event delivered:', error);
  }
}

async function sendExpoPushMessages(
  messages: PushMessage[],
  expoAccessToken: string
) {
  if (messages.length === 0) {
    return {
      delivered: 0,
      invalidTokens: [] as string[],
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  const response = await fetch(EXPO_PUSH_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Expo push delivery failed.');
  }

  const responseBody = (await response.json().catch(() => null)) as
    | {
        data?: ExpoPushTicket[];
      }
    | null;

  if (!Array.isArray(responseBody?.data)) {
    return {
      delivered: messages.length,
      invalidTokens: [] as string[],
    };
  }

  const invalidTokens: string[] = [];
  let delivered = 0;

  responseBody.data.forEach((ticket, index) => {
    if (ticket?.status === 'ok') {
      delivered += 1;
      return;
    }

    if (ticket?.details?.error === 'DeviceNotRegistered') {
      invalidTokens.push(messages[index]?.to ?? '');
    }
  });

  return {
    delivered,
    invalidTokens: invalidTokens.filter(Boolean),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        {
          success: false,
          error: 'Social notification function is not configured on the server.',
        },
        500
      );
    }

    const user = await getAuthenticatedUser(request, supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = (await request.json()) as Partial<SocialNotificationRequest>;
    let claimedEvent: ClaimedNotificationEvent | null = null;
    let shouldReleaseEvent = false;
    let deliverySucceeded = false;

    if (!body?.type) {
      return jsonResponse(
        {
          success: false,
          error: 'Notification type required.',
        },
        400
      );
    }

    try {
      const payload = await (
        body.type === 'friend_accepted'
          ? (() => {
              const recipientUserId = body.friendUserId?.trim() ?? '';
              if (!recipientUserId) {
                throw new Error('Friend required.');
              }

              return claimNotificationEvent(adminClient, {
                type: 'friend_accepted',
                actorUserId: user.id,
                recipientUserId,
              }).then(async (claimed) => {
                if (!claimed?.recipient_user_id) {
                  return { claimedEvent: null, payload: null };
                }

                return {
                  claimedEvent: claimed,
                  payload: await loadFriendAcceptedPayload(
                    adminClient,
                    user.id,
                    claimed.recipient_user_id
                  ),
                };
              });
            })()
          : body.type === 'shared_post_created'
            ? (() => {
                const postId = body.postId?.trim() ?? '';
                return loadSharedPostPayload(adminClient, user.id, postId).then(
                  async (sharedPostPayload) => ({
                    claimedEvent: await claimNotificationEvent(adminClient, {
                      type: 'shared_post_created',
                      actorUserId: user.id,
                      resourceId: postId,
                    }),
                    payload: sharedPostPayload,
                  })
                );
              })()
            : body.type === 'shared_post_response_created'
              ? (() => {
                  const responseId = body.responseId?.trim() ?? '';
                  return loadSharedPostResponsePayload(adminClient, user.id, responseId).then(
                    async (responsePayload) => ({
                      claimedEvent: await claimNotificationEvent(adminClient, {
                        type: 'shared_post_response_created',
                        actorUserId: user.id,
                        resourceId: responseId,
                      }),
                      payload: responsePayload,
                    })
                  );
                })()
            : Promise.resolve(null)
      );

      if (!payload) {
        return jsonResponse(
          {
            success: false,
            error: 'Unsupported notification type.',
          },
          400
        );
      }

      claimedEvent = payload.claimedEvent;
      const notificationPayload = payload.payload;
      if (!claimedEvent || !notificationPayload) {
        return jsonResponse({
          success: true,
          recipients: 0,
          delivered: 0,
        });
      }

      shouldReleaseEvent = true;

      if (notificationPayload.recipientUserIds.length === 0) {
        await markNotificationEventDelivered(
          adminClient,
          body.type,
          user.id,
          claimedEvent.resource_id
        );
        shouldReleaseEvent = false;

        return jsonResponse({
          success: true,
          recipients: 0,
          delivered: 0,
        });
      }

      const pushTargets = await loadPushTargets(adminClient, notificationPayload.recipientUserIds);
      if (pushTargets.length === 0) {
        await releaseNotificationEvent(adminClient, body.type, user.id, claimedEvent.resource_id);
        shouldReleaseEvent = false;

        return jsonResponse({
          success: true,
          recipients: notificationPayload.recipientUserIds.length,
          delivered: 0,
        });
      }

      const pushRecipientUserIds = Array.from(new Set(pushTargets.map((target) => target.userId)));
      const reservedRecipientUserIds = await reserveNotificationRecipients(adminClient, {
        type: body.type,
        actorUserId: user.id,
        resourceId: claimedEvent.resource_id,
        recipientUserIds: pushRecipientUserIds,
      });
      const reservedRecipientUserIdSet = new Set(reservedRecipientUserIds);
      const reservedPushTargets = pushTargets.filter((target) =>
        reservedRecipientUserIdSet.has(target.userId)
      );

      if (reservedPushTargets.length === 0) {
        await markNotificationEventDelivered(
          adminClient,
          body.type,
          user.id,
          claimedEvent.resource_id
        );
        shouldReleaseEvent = false;

        return jsonResponse({
          success: true,
          recipients: notificationPayload.recipientUserIds.length,
          delivered: 0,
        });
      }

      const messages: PushMessage[] = reservedPushTargets.map(({ token, platform }) =>
        buildPushMessage({
          token,
          platform,
          title: notificationPayload.title,
          body: notificationPayload.body,
          data: notificationPayload.data,
        })
      );

      const delivery = await sendExpoPushMessages(messages, expoAccessToken).catch((error) => {
        console.warn('Expo social notification delivery failed; leaving event retryable:', error);
        return {
          delivered: 0,
          invalidTokens: [] as string[],
        };
      });

      if (delivery.invalidTokens.length > 0) {
        try {
          await prunePushTokens(adminClient, delivery.invalidTokens);
        } catch (error) {
          console.warn('Failed to prune invalid Expo push tokens:', error);
        }
      }

      if (delivery.delivered === 0) {
        await releaseNotificationEvent(adminClient, body.type, user.id, claimedEvent.resource_id);
        shouldReleaseEvent = false;

        return jsonResponse({
          success: true,
          recipients: notificationPayload.recipientUserIds.length,
          delivered: 0,
        });
      }

      deliverySucceeded = true;

      await markNotificationEventDelivered(
        adminClient,
        body.type,
        user.id,
        claimedEvent.resource_id
      );
      shouldReleaseEvent = false;

      return jsonResponse({
        success: true,
        recipients: notificationPayload.recipientUserIds.length,
        delivered: delivery.delivered,
      });
    } catch (error) {
      if (claimedEvent && shouldReleaseEvent && !deliverySucceeded) {
        try {
          await releaseNotificationEvent(adminClient, body.type, user.id, claimedEvent.resource_id);
        } catch (releaseError) {
          console.warn('Failed to release social notification event claim:', releaseError);
        }
      }

      throw error;
    }
  } catch (error) {
    console.error('send-social-notifications failed:', error);
    if (error instanceof NotificationControlUnavailableError) {
      return jsonResponse(
        {
          success: false,
          error: 'Social notification delivery is temporarily unavailable.',
        },
        503
      );
    }

    return jsonResponse(
      {
        success: false,
        error: 'Could not send social notification right now.',
      },
      500
    );
  }
});
