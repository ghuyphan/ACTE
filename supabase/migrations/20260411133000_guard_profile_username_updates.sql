alter table public.profiles
  add column if not exists username_set_at timestamptz;

create or replace function public.guard_profile_username()
returns trigger
language plpgsql
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(btrim(coalesce(new.username, '')));
  normalized_username := regexp_replace(normalized_username, '^@+', '');

  if normalized_username = '' then
    raise exception 'Username required.';
  end if;

  if char_length(normalized_username) > 20 then
    raise exception 'Username must be 20 characters or fewer.';
  end if;

  if normalized_username !~ '^[a-z0-9._]+$' then
    raise exception 'Username must use only lowercase letters, numbers, periods, or underscores.';
  end if;

  new.username := normalized_username;

  if tg_op = 'UPDATE' and old.username is distinct from normalized_username then
    if old.username_set_at is not null then
      raise exception 'Username can only be changed once.';
    end if;

    new.username_set_at := now();
  elsif tg_op = 'UPDATE' then
    new.username_set_at := old.username_set_at;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_username_guard on public.profiles;
create trigger profiles_username_guard
  before insert or update on public.profiles
  for each row
  execute function public.guard_profile_username();
