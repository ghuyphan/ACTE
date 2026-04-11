create or replace function public.find_user_by_username(search_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  photo_url text,
  is_self boolean,
  already_friends boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_username text := lower(regexp_replace(btrim(coalesce(search_username, '')), '^@+', ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_username = '' then
    raise exception 'Username required.';
  end if;

  return query
  select
    profiles.id,
    profiles.username,
    profiles.display_name,
    profiles.photo_url,
    profiles.id = current_user_id as is_self,
    exists (
      select 1
        from public.friendships
       where friendships.user_id = current_user_id
         and friendships.friend_user_id = profiles.id
    ) as already_friends
    from public.profiles as profiles
   where profiles.username = normalized_username
   limit 1;

  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

create or replace function public.add_friend_by_username(search_username text)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_username text := lower(regexp_replace(btrim(coalesce(search_username, '')), '^@+', ''));
  current_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  now_ts timestamptz := now();
  result_row public.friendships%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_username = '' then
    raise exception 'Username required.';
  end if;

  select *
    into target_profile
    from public.profiles
   where username = normalized_username
   limit 1;

  if target_profile.id is null then
    raise exception 'User not found.';
  end if;

  if target_profile.id = current_user_id then
    raise exception 'You cannot add yourself.';
  end if;

  if exists (
    select 1
      from public.friendships
     where friendships.user_id = current_user_id
       and friendships.friend_user_id = target_profile.id
  ) then
    raise exception 'You are already friends.';
  end if;

  select *
    into current_profile
    from public.profiles
   where id = current_user_id;

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
    target_profile.id,
    coalesce(target_profile.username, target_profile.display_name),
    target_profile.photo_url,
    now_ts,
    null,
    null,
    null
  );

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
    target_profile.id,
    current_user_id,
    coalesce(current_profile.username, current_profile.display_name),
    current_profile.photo_url,
    now_ts,
    null,
    null,
    null
  );

  select *
    into result_row
    from public.friendships
   where user_id = current_user_id
     and friend_user_id = target_profile.id;

  return result_row;
end;
$$;

grant execute on function public.find_user_by_username(text) to authenticated;
grant execute on function public.add_friend_by_username(text) to authenticated;
