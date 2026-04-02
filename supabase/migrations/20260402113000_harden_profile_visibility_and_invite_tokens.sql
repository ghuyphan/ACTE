drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_self_or_friends"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1
        from public.friendships
       where friendships.user_id = auth.uid()
         and friendships.friend_user_id = profiles.id
    )
  );

alter table public.friend_invites add column if not exists token_hash text;
alter table public.room_invites add column if not exists token_hash text;

update public.friend_invites
   set token_hash = encode(digest(token, 'sha256'), 'hex')
 where token_hash is null
   and nullif(btrim(token), '') is not null;

update public.room_invites
   set token_hash = encode(digest(token, 'sha256'), 'hex')
 where token_hash is null
   and nullif(btrim(token), '') is not null;

create unique index if not exists idx_friend_invites_token_hash_unique
  on public.friend_invites (token_hash)
  where token_hash is not null;

create unique index if not exists idx_room_invites_token_hash_unique
  on public.room_invites (token_hash)
  where token_hash is not null;

alter table public.friend_invites alter column token drop not null;
alter table public.room_invites alter column token drop not null;

update public.friend_invites
   set token = null
 where token is not null;

update public.room_invites
   set token = null
 where token is not null;

update public.friendships
   set created_by_invite_token = null
 where created_by_invite_token is not null;

update public.room_members
   set joined_via_invite_token = null
 where joined_via_invite_token is not null;

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
    inviter_profile.display_name,
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
    current_profile.display_name,
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

create or replace function public.join_room_by_invite(
  room_id text,
  invite_id text,
  invite_token text
)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  now_ts timestamptz := now();
  invite_row public.room_invites%rowtype;
  current_profile public.profiles%rowtype;
  member_row public.room_members%rowtype;
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
    from public.room_invites
   where id = invite_id
     and room_id = join_room_by_invite.room_id
     and token_hash = invite_token_hash;

  if invite_row.id is null then
    raise exception 'Invite not found.';
  end if;

  if invite_row.revoked_at is not null then
    raise exception 'This invite link is no longer active.';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at <= now_ts then
    raise exception 'This invite link has expired.';
  end if;

  select * into current_profile from public.profiles where id = current_user_id;

  insert into public.room_members (
    room_id,
    user_id,
    role,
    display_name_snapshot,
    photo_url_snapshot,
    joined_at,
    last_read_at,
    joined_via_invite_id,
    joined_via_invite_token
  )
  values (
    room_id,
    current_user_id,
    'member',
    current_profile.display_name,
    current_profile.photo_url,
    now_ts,
    now_ts,
    invite_row.id,
    null
  )
  on conflict (room_id, user_id) do update
    set role = excluded.role,
        display_name_snapshot = excluded.display_name_snapshot,
        photo_url_snapshot = excluded.photo_url_snapshot,
        last_read_at = excluded.last_read_at,
        joined_via_invite_id = excluded.joined_via_invite_id,
        joined_via_invite_token = excluded.joined_via_invite_token
  returning * into member_row;

  return member_row;
end;
$$;
