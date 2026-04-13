import { createClient } from 'jsr:@supabase/supabase-js@2';

type SocialNotificationRequest =
  | {
      type: 'friend_accepted';
      friendUserId: string;
    }
  | {
      type: 'shared_post_created';
      postId: string;
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
  expo_push_token: string;
  platform: string | null;
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
};

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
  adminClient: ReturnType<typeof createClient>,
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
      route: '/shared',
      notificationType: 'friend-accepted',
      friendUserId: actorUserId,
    },
  };
}

async function loadSharedPostPayload(
  adminClient: ReturnType<typeof createClient>,
  actorUserId: string,
  postId: string
) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    throw new Error('Shared post required.');
  }

  const { data: post, error: postError } = await adminClient
    .from('shared_posts')
    .select('id, author_user_id, author_display_name, audience_user_ids, type, place_name')
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

  const body =
    typedPost.type === 'photo'
      ? placeName
        ? `Open Noto to see the photo memory from ${placeName}.`
        : 'Open Noto to see the photo memory they shared with you.'
      : placeName
        ? `Open Noto to read the note from ${placeName}.`
        : 'Open Noto to read the note they shared with you.';

  return {
    recipientUserIds,
    title: `${actorDisplayName} shared a memory with you`,
    body,
    data: {
      route: `/shared/${typedPost.id}`,
      sharedPostId: typedPost.id,
      notificationType: 'shared-post',
    },
  };
}

async function loadPushTargets(
  adminClient: ReturnType<typeof createClient>,
  userIds: string[]
) {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await adminClient
    .from('device_push_tokens')
    .select('expo_push_token, platform')
    .in('user_id', userIds);

  if (error) {
    throw error;
  }

  return Array.from(
    new Map(
      ((data ?? []) as PushTargetRow[])
        .map((row) => {
          const token = row.expo_push_token?.trim() ?? '';
          return [
            token,
            {
              token,
              platform: row.platform?.trim()?.toLowerCase() ?? '',
            },
          ] as const;
        })
        .filter(([token]) => Boolean(token))
    ).values()
  );
}

async function prunePushTokens(
  adminClient: ReturnType<typeof createClient>,
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

    if (!body?.type) {
      return jsonResponse(
        {
          success: false,
          error: 'Notification type required.',
        },
        400
      );
    }

    const payload =
      body.type === 'friend_accepted'
        ? await loadFriendAcceptedPayload(adminClient, user.id, body.friendUserId ?? '')
        : body.type === 'shared_post_created'
          ? await loadSharedPostPayload(adminClient, user.id, body.postId ?? '')
          : null;

    if (!payload) {
      return jsonResponse(
        {
          success: false,
          error: 'Unsupported notification type.',
        },
        400
      );
    }

    const pushTargets = await loadPushTargets(adminClient, payload.recipientUserIds);
    if (pushTargets.length === 0) {
      return jsonResponse({
        success: true,
        recipients: payload.recipientUserIds.length,
        delivered: 0,
      });
    }

    const messages: PushMessage[] = pushTargets.map(({ token, platform }) => {
      if (platform === 'android' && payload.data.notificationType === 'shared-post') {
        return {
          to: token,
          data: {
            ...payload.data,
            notificationTitle: payload.title,
            notificationBody: payload.body,
            notificationChannelId: ANDROID_SOCIAL_CHANNEL_ID,
          },
        };
      }

      return {
        to: token,
        sound: 'default' as const,
        title: payload.title,
        body: payload.body,
        channelId: ANDROID_SOCIAL_CHANNEL_ID,
        _contentAvailable: payload.data.notificationType === 'shared-post',
        data: payload.data,
      };
    });

    const delivery = await sendExpoPushMessages(messages, expoAccessToken);

    if (delivery.invalidTokens.length > 0) {
      try {
        await prunePushTokens(adminClient, delivery.invalidTokens);
      } catch (error) {
        console.warn('Failed to prune invalid Expo push tokens:', error);
      }
    }

    return jsonResponse({
      success: true,
      recipients: payload.recipientUserIds.length,
      delivered: delivery.delivered,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected social notification failure.';
    return jsonResponse(
      {
        success: false,
        error: message,
      },
      500
    );
  }
});
