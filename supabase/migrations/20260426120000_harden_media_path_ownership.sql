begin;

create or replace function public.is_valid_user_storage_path(
  owner_user_id_input uuid,
  storage_path_input text
)
returns boolean
language sql
immutable
strict
as $$
  select
    storage_path_input = btrim(storage_path_input)
    and split_part(storage_path_input, '/', 1) = owner_user_id_input::text
    and storage_path_input !~ '(^|/)\.\.?(/|$)'
    and storage_path_input !~ '//'
    and storage_path_input ~ (
      '^' || owner_user_id_input::text || '/[A-Za-z0-9][A-Za-z0-9._/-]*$'
    );
$$;

alter table public.notes
  add constraint notes_media_paths_owner_check
  check (
    (photo_path is null or public.is_valid_user_storage_path(user_id, photo_path))
    and (paired_video_path is null or public.is_valid_user_storage_path(user_id, paired_video_path))
    and (dual_primary_photo_path is null or public.is_valid_user_storage_path(user_id, dual_primary_photo_path))
    and (dual_secondary_photo_path is null or public.is_valid_user_storage_path(user_id, dual_secondary_photo_path))
  )
  not valid;

alter table public.shared_posts
  add constraint shared_posts_media_paths_author_check
  check (
    (photo_path is null or public.is_valid_user_storage_path(author_user_id, photo_path))
    and (paired_video_path is null or public.is_valid_user_storage_path(author_user_id, paired_video_path))
    and (dual_primary_photo_path is null or public.is_valid_user_storage_path(author_user_id, dual_primary_photo_path))
    and (dual_secondary_photo_path is null or public.is_valid_user_storage_path(author_user_id, dual_secondary_photo_path))
  )
  not valid;

drop policy if exists "shared_post_media_select_visible" on storage.objects;

create policy "shared_post_media_select_visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shared-post-media'
    and exists (
      select 1
        from public.shared_posts
       where (
            shared_posts.photo_path = storage.objects.name
         or shared_posts.dual_primary_photo_path = storage.objects.name
         or shared_posts.dual_secondary_photo_path = storage.objects.name
         or shared_posts.paired_video_path = storage.objects.name
       )
         and public.is_valid_user_storage_path(shared_posts.author_user_id, storage.objects.name)
         and (
           shared_posts.author_user_id = auth.uid()
           or (
             auth.uid() = any (shared_posts.audience_user_ids)
             and public.are_users_friends(shared_posts.author_user_id, auth.uid())
           )
         )
    )
  );

commit;
