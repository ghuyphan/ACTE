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
      r.text,
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
