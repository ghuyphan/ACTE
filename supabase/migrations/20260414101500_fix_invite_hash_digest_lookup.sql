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

  select *
    into result_row
    from public.friendships
   where user_id = current_user_id
     and friend_user_id = invite_row.inviter_user_id;

  return result_row;
end;
$$;

grant execute on function public.accept_friend_invite(text, text) to authenticated;
