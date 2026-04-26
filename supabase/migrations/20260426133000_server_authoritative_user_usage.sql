begin;

alter table public.user_usage
  add column if not exists photo_note_daily_time_zone text not null default 'UTC';

create or replace function public.normalize_usage_time_zone(time_zone_input text)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  normalized_time_zone text := nullif(btrim(coalesce(time_zone_input, '')), '');
begin
  if normalized_time_zone is null then
    return 'UTC';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_timezone_names
     where name = normalized_time_zone
  ) then
    return normalized_time_zone;
  end if;

  return 'UTC';
end;
$$;

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

create or replace function public.recompute_user_usage(
  user_id_input uuid,
  synced_at_input timestamptz default now(),
  time_zone_input text default 'UTC'
)
returns public.user_usage
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from user_id_input and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Cannot refresh usage for another user.' using errcode = '42501';
  end if;

  return public._recompute_user_usage_unchecked(
    user_id_input,
    synced_at_input,
    time_zone_input
  );
end;
$$;

create or replace function public.refresh_user_usage_after_note_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public._recompute_user_usage_unchecked(new.user_id, now(), 'UTC');
  end if;

  if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or old.user_id is distinct from new.user_id) then
    perform public._recompute_user_usage_unchecked(old.user_id, now(), 'UTC');
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists notes_refresh_user_usage_after_change on public.notes;
create trigger notes_refresh_user_usage_after_change
after insert or update or delete on public.notes
for each row
execute function public.refresh_user_usage_after_note_change();

drop policy if exists "user_usage_own_insert" on public.user_usage;
drop policy if exists "user_usage_own_update" on public.user_usage;
drop policy if exists "user_usage_own_delete" on public.user_usage;
drop policy if exists "Users can insert own usage" on public.user_usage;
drop policy if exists "Users can update own usage" on public.user_usage;
drop policy if exists "Users can delete own usage" on public.user_usage;

revoke insert, update, delete on public.user_usage from authenticated;
revoke all on function public._recompute_user_usage_unchecked(uuid, timestamptz, text) from public;
revoke all on function public._recompute_user_usage_unchecked(uuid, timestamptz, text) from anon;
revoke all on function public._recompute_user_usage_unchecked(uuid, timestamptz, text) from authenticated;
grant execute on function public.recompute_user_usage(uuid, timestamptz, text) to authenticated;
grant execute on function public.recompute_user_usage(uuid, timestamptz, text) to service_role;

comment on function public.recompute_user_usage(uuid, timestamptz, text)
  is 'Authenticated RPC that refreshes user_usage from server-owned notes rows instead of client-provided counters.';

commit;
