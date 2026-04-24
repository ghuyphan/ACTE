begin;

create or replace function public.is_valid_sticker_asset_storage_path(
  owner_user_id_input uuid,
  storage_bucket_input text,
  storage_path_input text
)
returns boolean
language sql
immutable
strict
as $$
  select
    storage_bucket_input = 'note-media'
    and storage_path_input ~ (
      '^' || owner_user_id_input::text || '/stickers/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$'
    );
$$;

alter table public.sticker_assets
  add constraint sticker_assets_storage_path_owner_check
  check (
    public.is_valid_sticker_asset_storage_path(owner_user_id, storage_bucket, storage_path)
  )
  not valid;

create or replace function public.prevent_sticker_asset_storage_retarget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
    or new.content_hash is distinct from old.content_hash
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path then
    raise exception 'Sticker asset storage identity cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_sticker_asset_storage_retarget
  on public.sticker_assets;

create trigger prevent_sticker_asset_storage_retarget
before update on public.sticker_assets
for each row
execute function public.prevent_sticker_asset_storage_retarget();

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sticker_assets'
  loop
    execute format(
      'drop policy if exists %I on public.sticker_assets',
      policy_record.policyname
    );
  end loop;
end
$$;

create policy "Users can read own sticker assets"
on public.sticker_assets
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "Users can insert own sticker assets"
on public.sticker_assets
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_valid_sticker_asset_storage_path(owner_user_id, storage_bucket, storage_path)
);

create policy "Users can update own sticker assets"
on public.sticker_assets
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_valid_sticker_asset_storage_path(owner_user_id, storage_bucket, storage_path)
);

create policy "Users can delete own sticker assets"
on public.sticker_assets
for delete
to authenticated
using (owner_user_id = auth.uid());

commit;
