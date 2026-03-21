create or replace function public.is_room_member(target_room_id text, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.room_members
     where room_id = target_room_id
       and user_id = target_user_id
  );
$$;

create or replace function public.is_room_owner(target_room_id text, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.room_members
     where room_id = target_room_id
       and user_id = target_user_id
       and role = 'owner'
  );
$$;

grant execute on function public.is_room_member(text, uuid) to authenticated;
grant execute on function public.is_room_owner(text, uuid) to authenticated;

drop policy if exists "rooms_read_member" on public.rooms;
create policy "rooms_read_member"
  on public.rooms for select
  to authenticated
  using (public.is_room_member(rooms.id));

drop policy if exists "room_members_read_member" on public.room_members;
create policy "room_members_read_member"
  on public.room_members for select
  to authenticated
  using (public.is_room_member(room_members.room_id));

drop policy if exists "room_members_update_self_or_owner" on public.room_members;
create policy "room_members_update_self_or_owner"
  on public.room_members for update
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_room_owner(room_members.room_id)
  )
  with check (
    auth.uid() = user_id
    or public.is_room_owner(room_members.room_id)
  );

drop policy if exists "room_invites_read_member" on public.room_invites;
create policy "room_invites_read_member"
  on public.room_invites for select
  to authenticated
  using (public.is_room_member(room_invites.room_id));

drop policy if exists "room_invites_owner_insert" on public.room_invites;
create policy "room_invites_owner_insert"
  on public.room_invites for insert
  to authenticated
  with check (
    public.is_room_owner(room_invites.room_id)
    and auth.uid() = created_by_user_id
  );

drop policy if exists "room_invites_owner_update" on public.room_invites;
create policy "room_invites_owner_update"
  on public.room_invites for update
  to authenticated
  using (public.is_room_owner(room_invites.room_id))
  with check (public.is_room_owner(room_invites.room_id));

drop policy if exists "room_posts_read_member" on public.room_posts;
create policy "room_posts_read_member"
  on public.room_posts for select
  to authenticated
  using (public.is_room_member(room_posts.room_id));

drop policy if exists "room_posts_insert_member" on public.room_posts;
create policy "room_posts_insert_member"
  on public.room_posts for insert
  to authenticated
  with check (
    auth.uid() = author_user_id
    and public.is_room_member(room_posts.room_id)
  );

drop policy if exists "room_post_media_select_member" on storage.objects;
create policy "room_post_media_select_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'room-post-media'
    and exists (
      select 1
        from public.room_posts
       where room_posts.photo_path = storage.objects.name
         and public.is_room_member(room_posts.room_id)
    )
  );

drop policy if exists "room_post_media_insert_member" on storage.objects;
create policy "room_post_media_insert_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'room-post-media'
    and public.is_room_member(split_part(storage.objects.name, '/', 1))
  );

drop policy if exists "room_post_media_update_member" on storage.objects;
create policy "room_post_media_update_member"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'room-post-media'
    and public.is_room_member(split_part(storage.objects.name, '/', 1))
  )
  with check (
    bucket_id = 'room-post-media'
    and public.is_room_member(split_part(storage.objects.name, '/', 1))
  );

drop policy if exists "room_post_media_delete_author_or_owner" on storage.objects;
create policy "room_post_media_delete_author_or_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'room-post-media'
    and exists (
      select 1
        from public.room_posts
       where room_posts.photo_path = storage.objects.name
         and (
           room_posts.author_user_id = auth.uid()
           or public.is_room_owner(room_posts.room_id)
         )
    )
  );
