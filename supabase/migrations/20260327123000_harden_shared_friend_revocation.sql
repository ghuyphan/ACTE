create or replace function public.are_users_friends(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    left_user_id is not null
    and right_user_id is not null
    and exists (
      select 1
        from public.friendships
       where user_id = left_user_id
         and friend_user_id = right_user_id
    );
$$;

create or replace function public.is_valid_shared_post_audience(author_id uuid, audience_ids uuid[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    author_id is not null
    and audience_ids is not null
    and array_position(audience_ids, author_id) is not null
    and not exists (
      select 1
        from unnest(audience_ids) as audience_user_id
       where audience_user_id is null
    )
    and (
      select count(distinct audience_user_id)
        from unnest(audience_ids) as audience_user_id
    ) = cardinality(audience_ids)
    and not exists (
      select 1
        from unnest(audience_ids) as audience_user_id
       where audience_user_id <> author_id
         and not public.are_users_friends(author_id, audience_user_id)
    );
$$;

grant execute on function public.are_users_friends(uuid, uuid) to authenticated;
grant execute on function public.is_valid_shared_post_audience(uuid, uuid[]) to authenticated;

drop policy if exists "shared_posts_read_visible" on public.shared_posts;
create policy "shared_posts_read_visible"
  on public.shared_posts for select
  to authenticated
  using (
    auth.uid() = author_user_id
    or (
      auth.uid() = any (audience_user_ids)
      and public.are_users_friends(author_user_id, auth.uid())
    )
  );

drop policy if exists "shared_posts_insert_author" on public.shared_posts;
create policy "shared_posts_insert_author"
  on public.shared_posts for insert
  to authenticated
  with check (
    auth.uid() = author_user_id
    and public.is_valid_shared_post_audience(author_user_id, audience_user_ids)
  );

drop policy if exists "shared_posts_update_author" on public.shared_posts;
create policy "shared_posts_update_author"
  on public.shared_posts for update
  to authenticated
  using (auth.uid() = author_user_id)
  with check (
    auth.uid() = author_user_id
    and public.is_valid_shared_post_audience(author_user_id, audience_user_ids)
  );

create or replace function public.remove_friend(friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if remove_friend.friend_user_id is null then
    raise exception 'Friend required.';
  end if;

  if remove_friend.friend_user_id = current_user_id then
    raise exception 'Choose a different friend.';
  end if;

  update public.shared_posts
     set audience_user_ids = array_remove(audience_user_ids, remove_friend.friend_user_id),
         updated_at = now()
   where author_user_id = current_user_id
     and remove_friend.friend_user_id = any (audience_user_ids);

  update public.shared_posts
     set audience_user_ids = array_remove(audience_user_ids, current_user_id),
         updated_at = now()
   where author_user_id = remove_friend.friend_user_id
     and current_user_id = any (audience_user_ids);

  delete from public.friendships
   where (user_id = current_user_id and friend_user_id = remove_friend.friend_user_id)
      or (user_id = remove_friend.friend_user_id and friend_user_id = current_user_id);
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;
