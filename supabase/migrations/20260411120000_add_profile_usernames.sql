alter table public.profiles add column if not exists username text;

create or replace function public.normalize_username_seed(seed text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text := lower(btrim(coalesce(seed, '')));
begin
  normalized := split_part(normalized, '@', 1);
  normalized := regexp_replace(normalized, '[^a-z0-9._]+', '_', 'g');
  normalized := regexp_replace(normalized, '[._]{2,}', '_', 'g');
  normalized := regexp_replace(normalized, '^[._]+|[._]+$', '', 'g');
  normalized := left(normalized, 20);

  if normalized = '' then
    return 'noto';
  end if;

  return normalized;
end;
$$;

create or replace function public.generate_unique_username(seed text, existing_user_id uuid default null)
returns text
language plpgsql
volatile
as $$
declare
  base_username text := public.normalize_username_seed(seed);
  candidate_username text := base_username;
  suffix integer := 0;
  max_base_length integer;
begin
  loop
    exit when not exists (
      select 1
        from public.profiles
       where username = candidate_username
         and (existing_user_id is null or id <> existing_user_id)
    );

    suffix := suffix + 1;
    max_base_length := greatest(1, 20 - char_length(suffix::text) - 1);
    candidate_username := left(base_username, max_base_length) || '_' || suffix::text;
  end loop;

  return candidate_username;
end;
$$;

do $$
declare
  profile_row record;
begin
  for profile_row in
    select
      profiles.id,
      profiles.display_name,
      auth_users.email,
      auth_users.raw_user_meta_data
    from public.profiles as profiles
    left join auth.users as auth_users
      on auth_users.id = profiles.id
    where profiles.username is null
       or btrim(profiles.username) = ''
    order by auth_users.created_at nulls first, profiles.id
  loop
    update public.profiles
       set username = public.generate_unique_username(
         coalesce(
           nullif(btrim(profile_row.raw_user_meta_data ->> 'username'), ''),
           nullif(btrim(profile_row.email), ''),
           nullif(btrim(profile_row.display_name), ''),
           profile_row.id::text
         ),
         profile_row.id
       ),
           updated_at = now()
     where id = profile_row.id;
  end loop;
end;
$$;

update public.friendships as friendships
   set display_name_snapshot = coalesce(profiles.username, profiles.display_name, friendships.display_name_snapshot)
  from public.profiles as profiles
 where profiles.id = friendships.friend_user_id
   and friendships.display_name_snapshot is distinct from coalesce(
     profiles.username,
     profiles.display_name,
     friendships.display_name_snapshot
   );

update public.friend_invites as friend_invites
   set inviter_display_name_snapshot = coalesce(profiles.username, profiles.display_name, friend_invites.inviter_display_name_snapshot)
  from public.profiles as profiles
 where profiles.id = friend_invites.inviter_user_id
   and friend_invites.inviter_display_name_snapshot is distinct from coalesce(
     profiles.username,
     profiles.display_name,
     friend_invites.inviter_display_name_snapshot
   );

update public.shared_posts as shared_posts
   set author_display_name = coalesce(profiles.username, profiles.display_name, shared_posts.author_display_name)
  from public.profiles as profiles
 where profiles.id = shared_posts.author_user_id
   and shared_posts.author_display_name is distinct from coalesce(
     profiles.username,
     profiles.display_name,
     shared_posts.author_display_name
   );

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username ~ '^[a-z0-9._]+$'
    and char_length(username) between 1 and 20
  );

create unique index if not exists idx_profiles_username_unique
  on public.profiles (username);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_display_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'displayName'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
  );
  profile_username text := public.generate_unique_username(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(btrim(new.email), ''),
      profile_display_name,
      new.id::text
    ),
    new.id
  );
begin
  insert into public.profiles (id, display_name, username, photo_url)
  values (
    new.id,
    profile_display_name,
    profile_username,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        username = coalesce(public.profiles.username, excluded.username),
        photo_url = excluded.photo_url,
        updated_at = now();

  insert into public.user_usage (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

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

  invite_token_hash := encode(digest(normalized_invite_token, 'sha256'), 'hex');

  select *
    into invite_row
    from public.friend_invites
   where token_hash = invite_token_hash
     and (invite_id is null or id = invite_id)
   order by created_at desc
   limit 1;

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

  update public.friend_invites
     set accepted_by_user_id = current_user_id,
         accepted_at = now_ts
   where id = invite_row.id;

  select *
    into result_row
    from public.friendships
   where user_id = current_user_id
     and friend_user_id = invite_row.inviter_user_id;

  return result_row;
end;
$$;
