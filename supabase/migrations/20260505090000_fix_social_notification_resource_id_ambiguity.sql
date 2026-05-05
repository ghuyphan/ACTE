begin;

create or replace function public.claim_social_notification_event(
  event_type_input text,
  actor_user_id_input uuid,
  resource_id_input text default null,
  recipient_user_id_input uuid default null
)
returns table(resource_id text, recipient_user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_event_type text := btrim(coalesce(event_type_input, ''));
  normalized_resource_id text := nullif(btrim(coalesce(resource_id_input, '')), '');
  normalized_recipient_user_id uuid := recipient_user_id_input;
  insert_columns text[] := array['event_type', 'actor_user_id', 'recipient_user_id', 'resource_id'];
  insert_values text[] := array['$1', '$2', '$3', '$4'];
  update_assignments text[] := array['recipient_user_id = excluded.recipient_user_id'];
  conflict_where text := '';
  claimed_resource_id text;
  claimed_recipient_user_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service-role notification senders can claim push delivery.'
      using errcode = '42501';
  end if;

  if actor_user_id_input is null then
    raise exception 'Actor user id required.' using errcode = '22023';
  end if;

  if normalized_event_type not in (
    'friend_accepted',
    'shared_post_created',
    'shared_post_response_created'
  ) then
    raise exception 'Unsupported notification event type: %', event_type_input
      using errcode = '22023';
  end if;

  if normalized_resource_id is null and normalized_recipient_user_id is not null then
    normalized_resource_id := normalized_recipient_user_id::text;
  end if;

  if normalized_resource_id is null then
    raise exception 'Notification resource id required.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'delivery_state'
  ) then
    insert_columns := insert_columns || 'delivery_state';
    insert_values := insert_values || quote_literal('processing');
    update_assignments := update_assignments || 'delivery_state = ''processing''';
    conflict_where := ' where events.delivery_state is distinct from ''delivered''';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'claim_started_at'
  ) then
    insert_columns := insert_columns || 'claim_started_at';
    insert_values := insert_values || 'now()';
    update_assignments := update_assignments || 'claim_started_at = now()';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'last_attempted_at'
  ) then
    insert_columns := insert_columns || 'last_attempted_at';
    insert_values := insert_values || 'now()';
    update_assignments := update_assignments || 'last_attempted_at = now()';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'attempt_count'
  ) then
    insert_columns := insert_columns || 'attempt_count';
    insert_values := insert_values || '1';
    update_assignments := update_assignments || 'attempt_count = coalesce(events.attempt_count, 0) + 1';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'updated_at'
  ) then
    insert_columns := insert_columns || 'updated_at';
    insert_values := insert_values || 'now()';
    update_assignments := update_assignments || 'updated_at = now()';
  end if;

  execute format(
    'insert into public.social_notification_events as events (%s)
     values (%s)
     on conflict (event_type, actor_user_id, resource_id) do update
       set %s%s
     returning events.resource_id, events.recipient_user_id',
    array_to_string(insert_columns, ', '),
    array_to_string(insert_values, ', '),
    array_to_string(update_assignments, ', '),
    conflict_where
  )
  using
    normalized_event_type,
    actor_user_id_input,
    normalized_recipient_user_id,
    normalized_resource_id
  into claimed_resource_id, claimed_recipient_user_id;

  if claimed_resource_id is null then
    return;
  end if;

  resource_id := claimed_resource_id;
  recipient_user_id := claimed_recipient_user_id;
  return next;
end;
$$;

create or replace function public.release_social_notification_event(
  event_type_input text,
  actor_user_id_input uuid,
  resource_id_input text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_event_type text := btrim(coalesce(event_type_input, ''));
  normalized_resource_id text := nullif(btrim(coalesce(resource_id_input, '')), '');
  update_assignments text[] := array[]::text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service-role notification senders can release push delivery.'
      using errcode = '42501';
  end if;

  if actor_user_id_input is null or normalized_resource_id is null then
    raise exception 'Notification event required.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'delivery_state'
  ) then
    update_assignments := update_assignments || 'delivery_state = ''pending''';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'claim_started_at'
  ) then
    update_assignments := update_assignments || 'claim_started_at = null';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'updated_at'
  ) then
    update_assignments := update_assignments || 'updated_at = now()';
  end if;

  if array_length(update_assignments, 1) is null then
    return;
  end if;

  execute format(
    'update public.social_notification_events as events
        set %s
      where events.event_type = $1
        and events.actor_user_id = $2
        and events.resource_id = $3',
    array_to_string(update_assignments, ', ')
  )
  using normalized_event_type, actor_user_id_input, normalized_resource_id;
end;
$$;

create or replace function public.mark_social_notification_event_delivered(
  event_type_input text,
  actor_user_id_input uuid,
  resource_id_input text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_event_type text := btrim(coalesce(event_type_input, ''));
  normalized_resource_id text := nullif(btrim(coalesce(resource_id_input, '')), '');
  update_assignments text[] := array[]::text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service-role notification senders can mark push delivery.'
      using errcode = '42501';
  end if;

  if actor_user_id_input is null or normalized_resource_id is null then
    raise exception 'Notification event required.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'delivery_state'
  ) then
    update_assignments := update_assignments || 'delivery_state = ''delivered''';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'delivered_at'
  ) then
    update_assignments := update_assignments || 'delivered_at = now()';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'social_notification_events'
       and column_name = 'updated_at'
  ) then
    update_assignments := update_assignments || 'updated_at = now()';
  end if;

  if array_length(update_assignments, 1) is null then
    return;
  end if;

  execute format(
    'update public.social_notification_events as events
        set %s
      where events.event_type = $1
        and events.actor_user_id = $2
        and events.resource_id = $3',
    array_to_string(update_assignments, ', ')
  )
  using normalized_event_type, actor_user_id_input, normalized_resource_id;
end;
$$;

revoke all on function public.claim_social_notification_event(text, uuid, text, uuid) from public;
revoke all on function public.claim_social_notification_event(text, uuid, text, uuid) from anon;
revoke all on function public.claim_social_notification_event(text, uuid, text, uuid) from authenticated;
grant execute on function public.claim_social_notification_event(text, uuid, text, uuid) to service_role;

revoke all on function public.release_social_notification_event(text, uuid, text) from public;
revoke all on function public.release_social_notification_event(text, uuid, text) from anon;
revoke all on function public.release_social_notification_event(text, uuid, text) from authenticated;
grant execute on function public.release_social_notification_event(text, uuid, text) to service_role;

revoke all on function public.mark_social_notification_event_delivered(text, uuid, text) from public;
revoke all on function public.mark_social_notification_event_delivered(text, uuid, text) from anon;
revoke all on function public.mark_social_notification_event_delivered(text, uuid, text) from authenticated;
grant execute on function public.mark_social_notification_event_delivered(text, uuid, text) to service_role;

comment on function public.claim_social_notification_event(text, uuid, text, uuid)
  is 'Service-role RPC that claims one social notification event without ambiguous resource_id references.';

commit;
