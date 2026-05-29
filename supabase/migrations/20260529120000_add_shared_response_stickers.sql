begin;

alter table public.shared_post_responses
  add column if not exists sticker_asset_id text,
  add column if not exists sticker_remote_path text,
  add column if not exists sticker_mime_type text,
  add column if not exists sticker_width integer,
  add column if not exists sticker_height integer,
  add column if not exists sticker_render_mode text,
  add column if not exists sticker_stamp_style text;

do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_responses_non_empty'
       and conrelid = 'public.shared_post_responses'::regclass
  ) then
    alter table public.shared_post_responses
      drop constraint shared_post_responses_non_empty;
  end if;
end $$;

alter table public.shared_post_responses
  add constraint shared_post_responses_non_empty
  check (
    emoji is not null
    or char_length(btrim(text)) > 0
    or sticker_remote_path is not null
  );

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_responses_sticker_render_mode_check'
       and conrelid = 'public.shared_post_responses'::regclass
  ) then
    alter table public.shared_post_responses
      add constraint shared_post_responses_sticker_render_mode_check
      check (sticker_render_mode is null or sticker_render_mode in ('default', 'stamp'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_responses_sticker_stamp_style_check'
       and conrelid = 'public.shared_post_responses'::regclass
  ) then
    alter table public.shared_post_responses
      add constraint shared_post_responses_sticker_stamp_style_check
      check (sticker_stamp_style is null or sticker_stamp_style in ('classic', 'circle'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'shared_post_responses_sticker_shape_check'
       and conrelid = 'public.shared_post_responses'::regclass
  ) then
    alter table public.shared_post_responses
      add constraint shared_post_responses_sticker_shape_check
      check (
        sticker_remote_path is null
        or (
          sticker_asset_id is not null
          and sticker_mime_type is not null
          and sticker_width is not null
          and sticker_width > 0
          and sticker_height is not null
          and sticker_height > 0
          and sticker_render_mode is not null
          and public.is_valid_user_storage_path(author_user_id, sticker_remote_path)
        )
      );
  end if;
end $$;

drop policy if exists "shared_post_media_select_visible" on storage.objects;

create policy "shared_post_media_select_visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shared-post-media'
    and (
      exists (
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
      or exists (
        select 1
          from public.shared_post_responses response
          join public.shared_posts post on post.id = response.post_id
         where response.sticker_remote_path = storage.objects.name
           and public.is_valid_user_storage_path(response.author_user_id, storage.objects.name)
           and (
             post.author_user_id = auth.uid()
             or response.author_user_id = auth.uid()
             or (
               auth.uid() = any (post.audience_user_ids)
               and public.are_users_friends(post.author_user_id, auth.uid())
             )
           )
      )
    )
  );

create or replace function public.get_shared_post_thread_summaries(target_post_ids text[])
returns table (
  post_id text,
  latest_response_id text,
  latest_response_created_at timestamptz,
  latest_activity_at timestamptz,
  latest_activity_author_user_id uuid,
  latest_activity_author_display_name text,
  latest_activity_author_photo_url_snapshot text,
  latest_activity_text text,
  latest_activity_emoji text,
  latest_activity_kind text
)
language sql
stable
as $$
  with visible_posts as (
    select p.id
      from public.shared_posts p
     where p.id = any(target_post_ids)
       and (
         p.author_user_id = auth.uid()
         or p.audience_user_ids @> array[auth.uid()]::uuid[]
       )
  ),
  latest_responses as (
    select distinct on (r.post_id)
      r.post_id,
      r.id as latest_response_id,
      r.created_at as latest_response_created_at
    from public.shared_post_responses r
    join visible_posts vp on vp.id = r.post_id
    order by r.post_id, r.created_at desc, r.id desc
  ),
  activities as (
    select
      r.post_id,
      r.id as response_id,
      r.created_at,
      r.author_user_id,
      r.author_display_name,
      r.author_photo_url_snapshot,
      coalesce(nullif(r.text, ''), case when r.sticker_remote_path is not null then 'Sticker' else null end) as text,
      r.emoji,
      'response'::text as kind
    from public.shared_post_responses r
    join visible_posts vp on vp.id = r.post_id

    union all

    select
      rr.post_id,
      rr.response_id,
      rr.created_at,
      rr.author_user_id,
      rr.author_display_name,
      rr.author_photo_url_snapshot,
      null::text as text,
      rr.emoji,
      'reaction'::text as kind
    from public.shared_post_response_reactions rr
    join visible_posts vp on vp.id = rr.post_id
  ),
  latest_activities as (
    select distinct on (a.post_id)
      a.post_id,
      a.created_at,
      a.author_user_id,
      a.author_display_name,
      a.author_photo_url_snapshot,
      a.text,
      a.emoji,
      a.kind
    from activities a
    order by a.post_id, a.created_at desc, a.response_id desc
  )
  select
    vp.id as post_id,
    lr.latest_response_id,
    lr.latest_response_created_at,
    la.created_at as latest_activity_at,
    la.author_user_id as latest_activity_author_user_id,
    la.author_display_name as latest_activity_author_display_name,
    la.author_photo_url_snapshot as latest_activity_author_photo_url_snapshot,
    la.text as latest_activity_text,
    la.emoji as latest_activity_emoji,
    la.kind as latest_activity_kind
  from visible_posts vp
  left join latest_responses lr on lr.post_id = vp.id
  left join latest_activities la on la.post_id = vp.id;
$$;

commit;
