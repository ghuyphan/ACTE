begin;

alter table public.social_notification_events
  drop constraint if exists social_notification_events_event_type_check;

alter table public.social_notification_events
  add constraint social_notification_events_event_type_check
  check (event_type in ('friend_accepted', 'shared_post_created', 'shared_post_response_created'));

alter table public.social_notification_rate_limit_events
  drop constraint if exists social_notification_rate_limit_events_event_type_check;

alter table public.social_notification_rate_limit_events
  add constraint social_notification_rate_limit_events_event_type_check
  check (event_type in ('friend_accepted', 'shared_post_created', 'shared_post_response_created'));

create or replace function public.reserve_social_notification_delivery(
  event_type_input text,
  actor_user_id_input uuid,
  recipient_user_ids_input uuid[],
  resource_id_input text default null
)
returns table(recipient_user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_event_type text := btrim(coalesce(event_type_input, ''));
  cooldown_window interval;
  hourly_limit integer;
  daily_limit integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service-role notification senders can reserve push delivery.'
      using errcode = '42501';
  end if;

  if actor_user_id_input is null then
    raise exception 'Actor user id required.' using errcode = '22023';
  end if;

  if normalized_event_type = 'friend_accepted' then
    cooldown_window := interval '5 minutes';
    hourly_limit := 3;
    daily_limit := 10;
  elsif normalized_event_type = 'shared_post_created' then
    cooldown_window := interval '60 seconds';
    hourly_limit := 12;
    daily_limit := 40;
  elsif normalized_event_type = 'shared_post_response_created' then
    cooldown_window := interval '30 seconds';
    hourly_limit := 20;
    daily_limit := 60;
  else
    raise exception 'Unsupported notification event type: %', event_type_input
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('social-push:' || actor_user_id_input::text));

  delete from public.social_notification_rate_limit_events
   where created_at < now() - interval '8 days';

  return query
  with requested_recipients as (
    select distinct recipient_id
      from unnest(coalesce(recipient_user_ids_input, array[]::uuid[])) as requested(recipient_id)
     where recipient_id is not null
       and recipient_id is distinct from actor_user_id_input
  ),
  eligible_recipients as (
    select requested_recipients.recipient_id
      from requested_recipients
     where not exists (
       select 1
         from public.social_notification_rate_limit_events recent
        where recent.event_type = normalized_event_type
          and recent.actor_user_id = actor_user_id_input
          and recent.recipient_user_id = requested_recipients.recipient_id
          and recent.created_at >= now() - cooldown_window
     )
       and (
         select count(*)
           from public.social_notification_rate_limit_events hourly
          where hourly.event_type = normalized_event_type
            and hourly.actor_user_id = actor_user_id_input
            and hourly.recipient_user_id = requested_recipients.recipient_id
            and hourly.created_at >= now() - interval '1 hour'
       ) < hourly_limit
       and (
         select count(*)
           from public.social_notification_rate_limit_events daily
          where daily.event_type = normalized_event_type
            and daily.actor_user_id = actor_user_id_input
            and daily.recipient_user_id = requested_recipients.recipient_id
            and daily.created_at >= now() - interval '1 day'
       ) < daily_limit
  ),
  inserted_recipients as (
    insert into public.social_notification_rate_limit_events (
      event_type,
      actor_user_id,
      recipient_user_id,
      resource_id
    )
    select
      normalized_event_type,
      actor_user_id_input,
      eligible_recipients.recipient_id,
      nullif(btrim(coalesce(resource_id_input, '')), '')
    from eligible_recipients
    on conflict do nothing
    returning public.social_notification_rate_limit_events.recipient_user_id
  )
  select inserted_recipients.recipient_user_id
    from inserted_recipients;
end;
$$;

create table if not exists public.friend_groups (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.friend_group_members (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  group_id text not null references public.friend_groups(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, friend_user_id),
  constraint friend_group_members_friendship_exists
    foreign key (owner_user_id, friend_user_id)
    references public.friendships(user_id, friend_user_id)
    on delete cascade
);

create index if not exists idx_friend_groups_owner_created
  on public.friend_groups(owner_user_id, created_at);

create index if not exists idx_friend_group_members_owner
  on public.friend_group_members(owner_user_id);

create table if not exists public.shared_post_responses (
  id text primary key,
  post_id text not null references public.shared_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_display_name text,
  author_photo_url_snapshot text,
  emoji text check (emoji is null or char_length(btrim(emoji)) between 1 and 16),
  text text not null default '' check (char_length(text) <= 160),
  created_at timestamptz not null default now(),
  constraint shared_post_responses_non_empty check (emoji is not null or char_length(btrim(text)) > 0)
);

create index if not exists idx_shared_post_responses_post_created
  on public.shared_post_responses(post_id, created_at);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'shared_post_responses'
     ) then
    alter publication supabase_realtime add table public.shared_post_responses;
  end if;
end;
$$;

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.shared_post_responses enable row level security;

drop policy if exists "friend_groups_owner_all" on public.friend_groups;
create policy "friend_groups_owner_all"
  on public.friend_groups
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "friend_group_members_owner_all" on public.friend_group_members;
create policy "friend_group_members_owner_all"
  on public.friend_group_members
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "shared_post_responses_visible_select" on public.shared_post_responses;
create policy "shared_post_responses_visible_select"
  on public.shared_post_responses
  for select
  using (
    exists (
      select 1
        from public.shared_posts p
       where p.id = shared_post_responses.post_id
         and (
           p.author_user_id = auth.uid()
           or p.audience_user_ids @> array[auth.uid()]::uuid[]
         )
    )
  );

drop policy if exists "shared_post_responses_audience_insert" on public.shared_post_responses;
create policy "shared_post_responses_audience_insert"
  on public.shared_post_responses
  for insert
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
        from public.shared_posts p
       where p.id = shared_post_responses.post_id
         and p.audience_user_ids @> array[auth.uid()]::uuid[]
    )
  );

commit;
