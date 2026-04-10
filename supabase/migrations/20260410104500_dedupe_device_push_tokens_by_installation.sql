alter table public.device_push_tokens
  add column if not exists installation_id text;

update public.device_push_tokens
   set installation_id = 'legacy:' || expo_push_token
 where installation_id is null;

alter table public.device_push_tokens
  alter column installation_id set not null;

create unique index if not exists idx_device_push_tokens_installation
  on public.device_push_tokens (installation_id);

create or replace function public.register_push_token(
  expo_push_token_input text,
  platform_input text,
  app_version_input text,
  installation_id_input text
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
  normalized_installation_id text := btrim(coalesce(installation_id_input, ''));
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

  if normalized_installation_id = '' then
    normalized_installation_id := 'legacy:' || normalized_token;
  end if;

  delete from public.device_push_tokens
   where installation_id = normalized_installation_id
     and expo_push_token <> normalized_token;

  insert into public.device_push_tokens (
    expo_push_token,
    user_id,
    platform,
    app_version,
    installation_id,
    created_at,
    updated_at,
    last_seen_at
  )
  values (
    normalized_token,
    current_user_id,
    normalized_platform,
    nullif(btrim(coalesce(app_version_input, '')), ''),
    normalized_installation_id,
    now(),
    now(),
    now()
  )
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        installation_id = excluded.installation_id,
        updated_at = now(),
        last_seen_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.register_push_token(
  expo_push_token_input text,
  platform_input text,
  app_version_input text default null
)
returns public.device_push_tokens
language sql
security definer
set search_path = public
as $$
  select public.register_push_token(
    expo_push_token_input,
    platform_input,
    app_version_input,
    null
  );
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;
