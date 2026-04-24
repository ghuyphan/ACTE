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
         and (
           shared_posts.author_user_id = auth.uid()
           or (
             auth.uid() = any (shared_posts.audience_user_ids)
             and public.are_users_friends(shared_posts.author_user_id, auth.uid())
           )
         )
    )
  );
