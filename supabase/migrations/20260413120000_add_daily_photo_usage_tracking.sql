alter table public.user_usage
  add column if not exists photo_note_daily_count integer not null default 0,
  add column if not exists photo_note_daily_date date not null default current_date;

update public.user_usage as usage
set
  photo_note_daily_count = coalesce(stats.photo_note_daily_count, 0),
  photo_note_daily_date = current_date
from (
  select
    user_id,
    count(*) filter (where type = 'photo' and created_at::date = current_date) as photo_note_daily_count
  from public.notes
  group by user_id
) as stats
where stats.user_id = usage.user_id;

update public.user_usage
set
  photo_note_daily_count = 0,
  photo_note_daily_date = current_date
where user_id not in (select distinct user_id from public.notes);
