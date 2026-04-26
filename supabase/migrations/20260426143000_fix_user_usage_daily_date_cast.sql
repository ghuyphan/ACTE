begin;

create or replace function public._recompute_user_usage_unchecked(
  user_id_input uuid,
  synced_at_input timestamptz default now(),
  time_zone_input text default 'UTC'
)
returns public.user_usage
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effective_time_zone text := public.normalize_usage_time_zone(time_zone_input);
  local_day_start timestamptz;
  local_day_end timestamptz;
  next_usage public.user_usage;
begin
  if user_id_input is null then
    raise exception 'User id required.' using errcode = '22023';
  end if;

  local_day_start := date_trunc('day', timezone(effective_time_zone, now()))
    at time zone effective_time_zone;
  local_day_end := local_day_start + interval '1 day';

  insert into public.user_usage (
    user_id,
    note_count,
    photo_note_count,
    photo_note_daily_count,
    photo_note_daily_date,
    photo_note_daily_time_zone,
    last_synced_at
  )
  select
    user_id_input,
    count(*)::integer,
    count(*) filter (where type = 'photo')::integer,
    count(*) filter (
      where type = 'photo'
        and created_at >= local_day_start
        and created_at < local_day_end
    )::integer,
    timezone(effective_time_zone, now())::date,
    effective_time_zone,
    coalesce(synced_at_input, now())
  from public.notes
  where user_id = user_id_input
  on conflict (user_id) do update set
    note_count = excluded.note_count,
    photo_note_count = excluded.photo_note_count,
    photo_note_daily_count = excluded.photo_note_daily_count,
    photo_note_daily_date = excluded.photo_note_daily_date,
    photo_note_daily_time_zone = excluded.photo_note_daily_time_zone,
    last_synced_at = excluded.last_synced_at
  returning * into next_usage;

  return next_usage;
end;
$$;

revoke all on function public._recompute_user_usage_unchecked(uuid, timestamptz, text) from public;
revoke all on function public._recompute_user_usage_unchecked(uuid, timestamptz, text) from anon;
revoke all on function public._recompute_user_usage_unchecked(uuid, timestamptz, text) from authenticated;

commit;
