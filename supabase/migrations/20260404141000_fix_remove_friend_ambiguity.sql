create or replace function public.remove_friend(target_friend_user_id uuid)
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

  if target_friend_user_id is null then
    raise exception 'Friend required.';
  end if;

  if target_friend_user_id = current_user_id then
    raise exception 'Choose a different friend.';
  end if;

  update public.shared_posts
     set audience_user_ids = array_remove(audience_user_ids, target_friend_user_id),
         updated_at = now()
   where public.shared_posts.author_user_id = current_user_id
     and target_friend_user_id = any (public.shared_posts.audience_user_ids);

  update public.shared_posts
     set audience_user_ids = array_remove(audience_user_ids, current_user_id),
         updated_at = now()
   where public.shared_posts.author_user_id = target_friend_user_id
     and current_user_id = any (public.shared_posts.audience_user_ids);

  delete from public.friendships
   where (public.friendships.user_id = current_user_id and public.friendships.friend_user_id = target_friend_user_id)
      or (public.friendships.user_id = target_friend_user_id and public.friendships.friend_user_id = current_user_id);
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;
