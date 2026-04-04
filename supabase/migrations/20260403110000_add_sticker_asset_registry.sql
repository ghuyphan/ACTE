begin;

create table if not exists public.sticker_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  content_hash text not null,
  mime_type text not null,
  width int not null,
  height int not null,
  byte_size int,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (owner_user_id, content_hash)
);

create table if not exists public.sticker_asset_refs (
  asset_id uuid not null references public.sticker_assets(id) on delete cascade,
  owner_user_id uuid not null,
  container_type text not null check (container_type in ('note', 'shared_post')),
  container_id text not null,
  created_at timestamptz not null default now(),
  primary key (container_type, container_id, asset_id)
);

alter table public.sticker_assets
  add column if not exists owner_user_id uuid,
  add column if not exists content_hash text,
  add column if not exists mime_type text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists byte_size int,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz default now();

alter table public.sticker_asset_refs
  add column if not exists asset_id uuid,
  add column if not exists owner_user_id uuid,
  add column if not exists container_type text,
  add column if not exists container_id text,
  add column if not exists created_at timestamptz default now();

create index if not exists idx_sticker_assets_last_seen
  on public.sticker_assets(last_seen_at asc);

create index if not exists idx_sticker_asset_refs_asset_id
  on public.sticker_asset_refs(asset_id);

create index if not exists idx_sticker_asset_refs_owner_container
  on public.sticker_asset_refs(owner_user_id, container_type, container_id);

alter table public.sticker_assets enable row level security;
alter table public.sticker_asset_refs enable row level security;

drop policy if exists "Users can read own sticker assets" on public.sticker_assets;
drop policy if exists "Users can insert own sticker assets" on public.sticker_assets;
drop policy if exists "Users can update own sticker assets" on public.sticker_assets;
drop policy if exists "Users can delete own sticker assets" on public.sticker_assets;

create policy "Users can read own sticker assets"
on public.sticker_assets
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "Users can insert own sticker assets"
on public.sticker_assets
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "Users can update own sticker assets"
on public.sticker_assets
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "Users can delete own sticker assets"
on public.sticker_assets
for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Users can read own sticker asset refs" on public.sticker_asset_refs;
drop policy if exists "Users can insert own sticker asset refs" on public.sticker_asset_refs;
drop policy if exists "Users can update own sticker asset refs" on public.sticker_asset_refs;
drop policy if exists "Users can delete own sticker asset refs" on public.sticker_asset_refs;

create policy "Users can read own sticker asset refs"
on public.sticker_asset_refs
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "Users can insert own sticker asset refs"
on public.sticker_asset_refs
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.sticker_assets sa
    where sa.id = sticker_asset_refs.asset_id
      and sa.owner_user_id = auth.uid()
  )
);

create policy "Users can update own sticker asset refs"
on public.sticker_asset_refs
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.sticker_assets sa
    where sa.id = sticker_asset_refs.asset_id
      and sa.owner_user_id = auth.uid()
  )
);

create policy "Users can delete own sticker asset refs"
on public.sticker_asset_refs
for delete
to authenticated
using (owner_user_id = auth.uid());

commit;
