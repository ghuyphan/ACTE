begin;

alter table public.friendships
  add column if not exists friend_nickname text;

alter table public.friendships
  drop constraint if exists friendships_friend_nickname_length;

alter table public.friendships
  add constraint friendships_friend_nickname_length
  check (friend_nickname is null or char_length(friend_nickname) <= 40);

create or replace function public.update_friend_nickname(
  target_friend_user_id uuid,
  nickname text
)
returns table (
  user_id uuid,
  friend_user_id uuid,
  display_name_snapshot text,
  friend_nickname text,
  photo_url_snapshot text,
  friended_at timestamptz,
  last_shared_at timestamptz,
  created_by_invite_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_nickname text := nullif(btrim(nickname), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if normalized_nickname is not null and char_length(normalized_nickname) > 40 then
    raise exception 'Nickname must be 40 characters or fewer.';
  end if;

  update public.friendships
     set friend_nickname = normalized_nickname
   where friendships.user_id = auth.uid()
     and friendships.friend_user_id = target_friend_user_id;

  if not found then
    raise exception 'Friend not found.';
  end if;

  return query
    select
      f.user_id,
      f.friend_user_id,
      f.display_name_snapshot,
      f.friend_nickname,
      f.photo_url_snapshot,
      f.friended_at,
      f.last_shared_at,
      f.created_by_invite_id
    from public.friendships f
    where f.user_id = auth.uid()
      and f.friend_user_id = target_friend_user_id;
end;
$$;

revoke all on function public.update_friend_nickname(uuid, text) from public;
grant execute on function public.update_friend_nickname(uuid, text) to authenticated;

commit;
