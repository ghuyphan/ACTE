create table if not exists public.device_push_tokens (
  expo_push_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_device_push_tokens_user
  on public.device_push_tokens (user_id, updated_at desc);

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_own_read" on public.device_push_tokens;
create policy "device_push_tokens_own_read"
  on public.device_push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.register_push_token(
  expo_push_token_input text,
  platform_input text,
  app_version_input text default null
)
returns public.device_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_token text := btrim(coalesce(expo_push_token_input, ''));
  normalized_platform text := lower(btrim(coalesce(platform_input, '')));
  result_row public.device_push_tokens%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_token = '' then
    raise exception 'Push token required.';
  end if;

  if normalized_platform not in ('ios', 'android') then
    raise exception 'Unsupported push platform.';
  end if;

  insert into public.device_push_tokens (
    expo_push_token,
    user_id,
    platform,
    app_version,
    created_at,
    updated_at,
    last_seen_at
  )
  values (
    normalized_token,
    current_user_id,
    normalized_platform,
    nullif(btrim(coalesce(app_version_input, '')), ''),
    now(),
    now(),
    now()
  )
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        updated_at = now(),
        last_seen_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.unregister_push_token(expo_push_token_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_token text := btrim(coalesce(expo_push_token_input, ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_token = '' then
    return;
  end if;

  delete from public.device_push_tokens
   where expo_push_token = normalized_token
     and user_id = current_user_id;
end;
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
