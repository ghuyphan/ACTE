alter table public.social_notification_events
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;

alter table public.social_notification_events
  add column if not exists delivery_state text not null default 'pending';

alter table public.social_notification_events
  add column if not exists claimed_at timestamptz;

alter table public.social_notification_events
  add column if not exists last_attempted_at timestamptz;

alter table public.social_notification_events
  add column if not exists delivered_at timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'social_notification_events_delivery_state_check'
  ) then
    alter table public.social_notification_events
      add constraint social_notification_events_delivery_state_check
      check (delivery_state in ('pending', 'processing', 'delivered'));
  end if;
end;
$$;

update public.social_notification_events
   set delivery_state = 'delivered',
       claimed_at = null,
       last_attempted_at = coalesce(last_attempted_at, created_at),
       delivered_at = coalesce(delivered_at, created_at)
 where delivery_state <> 'delivered'
    or delivered_at is null;

create index if not exists idx_social_notification_events_friend_acceptance_pending
  on public.social_notification_events (
    actor_user_id,
    recipient_user_id,
    delivery_state,
    created_at
  )
  where event_type = 'friend_accepted'
    and recipient_user_id is not null;

create or replace function public.claim_social_notification_event(
  event_type_input text,
  actor_user_id_input uuid,
  resource_id_input text default null,
  recipient_user_id_input uuid default null
)
returns table (
  resource_id text,
  recipient_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_event_type text := lower(btrim(coalesce(event_type_input, '')));
  normalized_resource_id text := btrim(coalesce(resource_id_input, ''));
begin
  if normalized_event_type = '' then
    raise exception 'Event type required.';
  end if;

  if actor_user_id_input is null then
    raise exception 'Actor required.';
  end if;

  if normalized_event_type = 'friend_accepted' then
    if recipient_user_id_input is null then
      raise exception 'Recipient required.';
    end if;

    return query
    with candidate as (
      select events.resource_id, events.recipient_user_id
        from public.social_notification_events as events
       where events.event_type = normalized_event_type
         and events.actor_user_id = actor_user_id_input
         and events.recipient_user_id = recipient_user_id_input
         and events.delivery_state <> 'delivered'
         and (
           events.delivery_state = 'pending'
           or events.claimed_at is null
           or events.claimed_at <= now() - interval '5 minutes'
         )
       order by events.created_at asc
       limit 1
       for update skip locked
    )
    update public.social_notification_events as events
       set delivery_state = 'processing',
           claimed_at = now(),
           last_attempted_at = now()
      from candidate
     where events.event_type = normalized_event_type
       and events.actor_user_id = actor_user_id_input
       and events.resource_id = candidate.resource_id
    returning events.resource_id, events.recipient_user_id;

    return;
  end if;

  if normalized_resource_id = '' then
    raise exception 'Resource required.';
  end if;

  return query
  insert into public.social_notification_events as events (
    event_type,
    actor_user_id,
    resource_id,
    recipient_user_id,
    delivery_state,
    created_at,
    claimed_at,
    last_attempted_at,
    delivered_at
  )
  values (
    normalized_event_type,
    actor_user_id_input,
    normalized_resource_id,
    recipient_user_id_input,
    'processing',
    now(),
    now(),
    now(),
    null
  )
  on conflict (event_type, actor_user_id, resource_id) do update
    set recipient_user_id = coalesce(events.recipient_user_id, excluded.recipient_user_id),
        delivery_state = 'processing',
        claimed_at = now(),
        last_attempted_at = now()
  where events.delivery_state <> 'delivered'
    and (
      events.delivery_state = 'pending'
      or events.claimed_at is null
      or events.claimed_at <= now() - interval '5 minutes'
    )
  returning events.resource_id, events.recipient_user_id;
end;
$$;

create or replace function public.release_social_notification_event(
  event_type_input text,
  actor_user_id_input uuid,
  resource_id_input text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.social_notification_events
     set delivery_state = 'pending',
         claimed_at = null
   where event_type = lower(btrim(coalesce(event_type_input, '')))
     and actor_user_id = actor_user_id_input
     and resource_id = btrim(coalesce(resource_id_input, ''))
     and delivery_state <> 'delivered';
$$;

create or replace function public.mark_social_notification_event_delivered(
  event_type_input text,
  actor_user_id_input uuid,
  resource_id_input text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.social_notification_events
     set delivery_state = 'delivered',
         claimed_at = null,
         delivered_at = coalesce(delivered_at, now()),
         last_attempted_at = coalesce(last_attempted_at, now())
   where event_type = lower(btrim(coalesce(event_type_input, '')))
     and actor_user_id = actor_user_id_input
     and resource_id = btrim(coalesce(resource_id_input, ''));
$$;

revoke all on function public.claim_social_notification_event(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_social_notification_event(text, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_social_notification_event_delivered(text, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_social_notification_event(text, uuid, text, uuid) to service_role;
grant execute on function public.release_social_notification_event(text, uuid, text) to service_role;
grant execute on function public.mark_social_notification_event_delivered(text, uuid, text) to service_role;

create or replace function public.accept_friend_invite(invite_token text, invite_id text default null)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_row public.friend_invites%rowtype;
  current_profile public.profiles%rowtype;
  inviter_profile public.profiles%rowtype;
  now_ts timestamptz := now();
  result_row public.friendships%rowtype;
  normalized_invite_token text := btrim(coalesce(invite_token, ''));
  invite_token_hash text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_invite_token = '' then
    raise exception 'Invite token required.';
  end if;

  invite_token_hash := encode(extensions.digest(normalized_invite_token, 'sha256'::text), 'hex');

  select *
    into invite_row
    from public.friend_invites
   where token_hash = invite_token_hash
     and (invite_id is null or id = invite_id)
   order by created_at desc
   limit 1
   for update;

  if invite_row.id is null then
    raise exception 'Invite not found.';
  end if;

  if invite_row.inviter_user_id = current_user_id then
    raise exception 'You cannot accept your own invite.';
  end if;

  if invite_row.revoked_at is not null then
    raise exception 'This invite link is no longer active.';
  end if;

  if invite_row.accepted_by_user_id is not null and invite_row.accepted_by_user_id <> current_user_id then
    raise exception 'This invite link has already been used.';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at <= now_ts then
    raise exception 'This invite link has expired.';
  end if;

  update public.friend_invites
     set accepted_by_user_id = current_user_id,
         accepted_at = coalesce(accepted_at, now_ts)
   where id = invite_row.id
     and revoked_at is null
     and (expires_at is null or expires_at > now_ts)
     and (accepted_by_user_id is null or accepted_by_user_id = current_user_id);

  if not found then
    raise exception 'This invite link has already been used.';
  end if;

  select * into current_profile from public.profiles where id = current_user_id;
  select * into inviter_profile from public.profiles where id = invite_row.inviter_user_id;

  insert into public.friendships (
    user_id,
    friend_user_id,
    display_name_snapshot,
    photo_url_snapshot,
    friended_at,
    last_shared_at,
    created_by_invite_id,
    created_by_invite_token
  )
  values (
    current_user_id,
    invite_row.inviter_user_id,
    coalesce(inviter_profile.username, inviter_profile.display_name, 'Noto user'),
    inviter_profile.photo_url,
    now_ts,
    null,
    invite_row.id,
    null
  )
  on conflict (user_id, friend_user_id) do update
    set display_name_snapshot = excluded.display_name_snapshot,
        photo_url_snapshot = excluded.photo_url_snapshot,
        friended_at = excluded.friended_at,
        created_by_invite_id = excluded.created_by_invite_id,
        created_by_invite_token = excluded.created_by_invite_token;

  insert into public.friendships (
    user_id,
    friend_user_id,
    display_name_snapshot,
    photo_url_snapshot,
    friended_at,
    last_shared_at,
    created_by_invite_id,
    created_by_invite_token
  )
  values (
    invite_row.inviter_user_id,
    current_user_id,
    coalesce(current_profile.username, current_profile.display_name, 'Noto user'),
    current_profile.photo_url,
    now_ts,
    null,
    invite_row.id,
    null
  )
  on conflict (user_id, friend_user_id) do update
    set display_name_snapshot = excluded.display_name_snapshot,
        photo_url_snapshot = excluded.photo_url_snapshot,
        friended_at = excluded.friended_at,
        created_by_invite_id = excluded.created_by_invite_id,
        created_by_invite_token = excluded.created_by_invite_token;

  insert into public.social_notification_events (
    event_type,
    actor_user_id,
    resource_id,
    recipient_user_id,
    delivery_state,
    created_at
  )
  values (
    'friend_accepted',
    current_user_id,
    invite_row.id,
    invite_row.inviter_user_id,
    'pending',
    now_ts
  )
  on conflict (event_type, actor_user_id, resource_id) do nothing;

  select *
    into result_row
    from public.friendships
   where user_id = current_user_id
     and friend_user_id = invite_row.inviter_user_id;

  return result_row;
end;
$$;

grant execute on function public.accept_friend_invite(text, text) to authenticated;

create or replace function public.register_push_token(
  expo_push_token_input text,
  platform_input text,
  app_version_input text,
  installation_id_input text
)
returns public.device_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_token text := btrim(coalesce(expo_push_token_input, ''));
  normalized_platform text := lower(btrim(coalesce(platform_input, '')));
  normalized_installation_id text := btrim(coalesce(installation_id_input, ''));
  existing_installation_row public.device_push_tokens%rowtype;
  existing_token_row public.device_push_tokens%rowtype;
  result_row public.device_push_tokens%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_token = '' then
    raise exception 'Push token required.';
  end if;

  if normalized_platform not in ('ios', 'android') then
    raise exception 'Unsupported push platform.';
  end if;

  if normalized_installation_id = '' then
    normalized_installation_id := 'legacy:' || normalized_token;
  end if;

  select *
    into existing_installation_row
    from public.device_push_tokens
   where installation_id = normalized_installation_id
   limit 1
   for update;

  select *
    into existing_token_row
    from public.device_push_tokens
   where expo_push_token = normalized_token
   limit 1
   for update;

  if existing_installation_row.installation_id is not null
     and existing_installation_row.user_id <> current_user_id
     and existing_installation_row.expo_push_token <> normalized_token then
    raise exception 'This device is already registered to another account.';
  end if;

  if existing_token_row.expo_push_token is not null
     and existing_token_row.user_id <> current_user_id
     and existing_token_row.installation_id <> normalized_installation_id then
    raise exception 'This push token is already registered to another account.';
  end if;

  delete from public.device_push_tokens
   where installation_id = normalized_installation_id
     and expo_push_token <> normalized_token
     and user_id = current_user_id;

  begin
    insert into public.device_push_tokens (
      expo_push_token,
      user_id,
      platform,
      app_version,
      installation_id,
      created_at,
      updated_at,
      last_seen_at
    )
    values (
      normalized_token,
      current_user_id,
      normalized_platform,
      nullif(btrim(coalesce(app_version_input, '')), ''),
      normalized_installation_id,
      now(),
      now(),
      now()
    )
    on conflict (expo_push_token) do update
      set user_id = excluded.user_id,
          platform = excluded.platform,
          app_version = excluded.app_version,
          installation_id = excluded.installation_id,
          updated_at = now(),
          last_seen_at = now()
    where public.device_push_tokens.user_id = current_user_id
       or public.device_push_tokens.installation_id = excluded.installation_id
    returning * into result_row;
  exception
    when unique_violation then
      raise exception 'This device or push token is already registered to another account.';
  end;

  if result_row.expo_push_token is null then
    raise exception 'This device or push token is already registered to another account.';
  end if;

  return result_row;
end;
$$;

create or replace function public.register_push_token(
  expo_push_token_input text,
  platform_input text,
  app_version_input text default null
)
returns public.device_push_tokens
language sql
security definer
set search_path = public
as $$
  select public.register_push_token(
    expo_push_token_input,
    platform_input,
    app_version_input,
    null
  );
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;
