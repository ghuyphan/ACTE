begin;

create table if not exists public.app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

create table if not exists public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  current_approved_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  download_count bigint not null default 0 check (download_count >= 0),
  like_count bigint not null default 0 check (like_count >= 0),
  unpublished_at timestamptz,
  unpublished_by uuid references auth.users(id) on delete set null
);

alter table public.sticker_packs
  add column if not exists download_count bigint not null default 0
    check (download_count >= 0),
  add column if not exists like_count bigint not null default 0
    check (like_count >= 0);

-- Repair an interrupted/older draft of this feature that used text asset IDs.
-- The deployed sticker_assets.id column is UUID, so every referencing column
-- and RPC argument must use UUID too.
do $$
begin
  if to_regclass('public.sticker_pack_revisions') is not null
     and exists (
       select 1
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'sticker_pack_revisions'
          and column_name = 'thumbnail_asset_id'
          and data_type <> 'uuid'
     ) then
    alter table public.sticker_pack_revisions
      drop constraint if exists sticker_pack_revisions_thumbnail_asset_id_fkey;
    alter table public.sticker_pack_revisions
      alter column thumbnail_asset_id type uuid
      using thumbnail_asset_id::uuid;
  end if;

  if to_regclass('public.sticker_pack_items') is not null
     and exists (
       select 1
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'sticker_pack_items'
          and column_name = 'asset_id'
          and data_type <> 'uuid'
     ) then
    alter table public.sticker_pack_items
      drop constraint if exists sticker_pack_items_asset_id_fkey;
    alter table public.sticker_pack_items
      alter column asset_id type uuid
      using asset_id::uuid;
  end if;
end;
$$;

create table if not exists public.sticker_pack_revisions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  description text check (description is null or char_length(btrim(description)) <= 200),
  thumbnail_asset_id uuid not null references public.sticker_assets(id) on delete restrict,
  moderator_feedback text,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pack_id, revision_number),
  check (
    (status = 'rejected' and char_length(btrim(coalesce(moderator_feedback, ''))) > 0)
    or status <> 'rejected'
  )
);

alter table public.sticker_packs
  drop constraint if exists sticker_packs_current_approved_revision_fk;
alter table public.sticker_packs
  add constraint sticker_packs_current_approved_revision_fk
  foreign key (current_approved_revision_id)
  references public.sticker_pack_revisions(id)
  on delete set null;

create table if not exists public.sticker_pack_items (
  revision_id uuid not null references public.sticker_pack_revisions(id) on delete cascade,
  asset_id uuid not null references public.sticker_assets(id) on delete restrict,
  position integer not null check (position between 0 and 29),
  render_mode text not null default 'default' check (render_mode = 'default'),
  created_at timestamptz not null default now(),
  primary key (revision_id, asset_id),
  unique (revision_id, position)
);

create table if not exists public.sticker_pack_installs (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

create table if not exists public.sticker_pack_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

create index if not exists sticker_packs_creator_updated_idx
  on public.sticker_packs(creator_user_id, updated_at desc);
create index if not exists sticker_pack_revisions_status_submitted_idx
  on public.sticker_pack_revisions(status, submitted_at);
create index if not exists sticker_pack_items_revision_position_idx
  on public.sticker_pack_items(revision_id, position);
create index if not exists sticker_pack_installs_user_updated_idx
  on public.sticker_pack_installs(user_id, updated_at desc);
create index if not exists sticker_packs_download_count_idx
  on public.sticker_packs(download_count desc, updated_at desc);
create index if not exists sticker_packs_like_count_idx
  on public.sticker_packs(like_count desc, updated_at desc);
create index if not exists sticker_pack_likes_user_created_idx
  on public.sticker_pack_likes(user_id, created_at desc);

alter table public.app_roles enable row level security;
alter table public.sticker_packs enable row level security;
alter table public.sticker_pack_revisions enable row level security;
alter table public.sticker_pack_items enable row level security;
alter table public.sticker_pack_installs enable row level security;
alter table public.sticker_pack_likes enable row level security;

create or replace function public.is_sticker_pack_moderator(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_user_id is not null
    and exists (
      select 1
        from public.app_roles
       where user_id = target_user_id
         and role = 'moderator'
    );
$$;

revoke all on function public.is_sticker_pack_moderator(uuid) from public, anon;
grant execute on function public.is_sticker_pack_moderator(uuid) to authenticated;

drop policy if exists "app_roles_self_or_moderator_read" on public.app_roles;
create policy "app_roles_self_or_moderator_read"
  on public.app_roles for select to authenticated
  using (user_id = auth.uid() or public.is_sticker_pack_moderator());

drop policy if exists "sticker_packs_visible_read" on public.sticker_packs;
create policy "sticker_packs_visible_read"
  on public.sticker_packs for select to authenticated
  using (
    creator_user_id = auth.uid()
    or public.is_sticker_pack_moderator()
    or (
      unpublished_at is null
      and current_approved_revision_id is not null
    )
  );

drop policy if exists "sticker_pack_revisions_visible_read" on public.sticker_pack_revisions;
create policy "sticker_pack_revisions_visible_read"
  on public.sticker_pack_revisions for select to authenticated
  using (
    public.is_sticker_pack_moderator()
    or exists (
      select 1
        from public.sticker_packs pack
       where pack.id = sticker_pack_revisions.pack_id
         and (
           pack.creator_user_id = auth.uid()
           or (
             pack.unpublished_at is null
             and pack.current_approved_revision_id = sticker_pack_revisions.id
             and sticker_pack_revisions.status = 'approved'
           )
         )
    )
  );

drop policy if exists "sticker_pack_items_visible_read" on public.sticker_pack_items;
create policy "sticker_pack_items_visible_read"
  on public.sticker_pack_items for select to authenticated
  using (
    public.is_sticker_pack_moderator()
    or exists (
      select 1
        from public.sticker_pack_revisions revision
        join public.sticker_packs pack on pack.id = revision.pack_id
       where revision.id = sticker_pack_items.revision_id
         and (
           pack.creator_user_id = auth.uid()
           or (
             pack.unpublished_at is null
             and pack.current_approved_revision_id = revision.id
             and revision.status = 'approved'
           )
         )
    )
  );

drop policy if exists "sticker_pack_installs_own_read" on public.sticker_pack_installs;
create policy "sticker_pack_installs_own_read"
  on public.sticker_pack_installs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sticker_pack_likes_own_read" on public.sticker_pack_likes;
create policy "sticker_pack_likes_own_read"
  on public.sticker_pack_likes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sticker_assets_approved_pack_read" on public.sticker_assets;
create policy "sticker_assets_approved_pack_read"
  on public.sticker_assets for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
        from public.sticker_pack_items item
        join public.sticker_pack_revisions revision on revision.id = item.revision_id
        join public.sticker_packs pack on pack.id = revision.pack_id
       where item.asset_id = sticker_assets.id
         and pack.unpublished_at is null
         and pack.current_approved_revision_id = revision.id
         and revision.status = 'approved'
    )
    or public.is_sticker_pack_moderator()
  );

drop policy if exists "note_media_approved_sticker_pack_read" on storage.objects;
create policy "note_media_approved_sticker_pack_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'note-media'
    and exists (
      select 1
        from public.sticker_assets asset
        join public.sticker_pack_items item on item.asset_id = asset.id
        join public.sticker_pack_revisions revision on revision.id = item.revision_id
        join public.sticker_packs pack on pack.id = revision.pack_id
       where asset.storage_bucket = storage.objects.bucket_id
         and asset.storage_path = storage.objects.name
         and (
           (
             pack.unpublished_at is null
             and pack.current_approved_revision_id = revision.id
             and revision.status = 'approved'
           )
           or pack.creator_user_id = auth.uid()
           or public.is_sticker_pack_moderator()
         )
    )
  );

create or replace function public.validate_sticker_pack_revision(target_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  revision_row public.sticker_pack_revisions%rowtype;
  pack_row public.sticker_packs%rowtype;
  item_count integer;
  unique_count integer;
  foreign_asset_count integer;
  invalid_render_count integer;
begin
  select * into revision_row
    from public.sticker_pack_revisions
   where id = target_revision_id;
  if not found then
    raise exception 'Sticker pack revision not found.';
  end if;

  select * into pack_row
    from public.sticker_packs
   where id = revision_row.pack_id;

  select count(*), count(distinct asset_id),
         count(*) filter (where render_mode <> 'default')
    into item_count, unique_count, invalid_render_count
    from public.sticker_pack_items
   where revision_id = target_revision_id;

  if item_count < 3 or item_count > 30 then
    raise exception 'Sticker packs require between 3 and 30 stickers.';
  end if;
  if item_count <> unique_count then
    raise exception 'Sticker pack assets must be unique.';
  end if;
  if invalid_render_count > 0 then
    raise exception 'Sticker packs can only contain cutout stickers.';
  end if;
  if not exists (
    select 1 from public.sticker_pack_items
     where revision_id = target_revision_id
       and asset_id = revision_row.thumbnail_asset_id
  ) then
    raise exception 'The thumbnail must belong to the submitted revision.';
  end if;

  select count(*) into foreign_asset_count
    from public.sticker_pack_items item
    join public.sticker_assets asset on asset.id = item.asset_id
   where item.revision_id = target_revision_id
     and asset.owner_user_id <> pack_row.creator_user_id;
  if foreign_asset_count > 0 then
    raise exception 'Every submitted sticker must belong to the pack creator.';
  end if;
end;
$$;

revoke all on function public.validate_sticker_pack_revision(uuid) from public, anon, authenticated;

create or replace function public.save_sticker_pack_draft(
  target_pack_id uuid,
  target_revision_id uuid,
  pack_name text,
  pack_description text,
  thumbnail_asset_id_input uuid,
  ordered_asset_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  next_pack_id uuid;
  next_revision_id uuid;
  next_revision_number integer;
  existing_status text;
  asset_id_value uuid;
  asset_position integer;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;
  if char_length(btrim(coalesce(pack_name, ''))) not between 1 and 50 then
    raise exception 'Pack names must contain 1 to 50 characters.';
  end if;
  if char_length(btrim(coalesce(pack_description, ''))) > 200 then
    raise exception 'Pack descriptions must contain 200 characters or fewer.';
  end if;
  if cardinality(ordered_asset_ids) < 3 or cardinality(ordered_asset_ids) > 30 then
    raise exception 'Sticker packs require between 3 and 30 stickers.';
  end if;
  if (
    select count(distinct value)
      from unnest(ordered_asset_ids) as value
  ) <> cardinality(ordered_asset_ids) then
    raise exception 'Sticker pack assets must be unique.';
  end if;
  if not thumbnail_asset_id_input = any(ordered_asset_ids) then
    raise exception 'The thumbnail must belong to the pack.';
  end if;
  if exists (
    select 1
      from unnest(ordered_asset_ids) submitted(asset_id)
      left join public.sticker_assets asset on asset.id = submitted.asset_id
     where asset.id is null
        or asset.owner_user_id <> actor_id
  ) then
    raise exception 'Every sticker must belong to the authenticated creator.';
  end if;

  if target_pack_id is null then
    insert into public.sticker_packs(creator_user_id)
    values (actor_id)
    returning id into next_pack_id;
  else
    select id into next_pack_id
      from public.sticker_packs
     where id = target_pack_id
       and creator_user_id = actor_id;
    if next_pack_id is null then
      raise exception 'Sticker pack not found or not owned by this account.';
    end if;
  end if;

  if target_revision_id is not null then
    select status into existing_status
      from public.sticker_pack_revisions
     where id = target_revision_id
       and pack_id = next_pack_id;
  end if;

  if existing_status in ('draft', 'rejected') then
    next_revision_id := target_revision_id;
    update public.sticker_pack_revisions
       set status = 'draft',
           name = btrim(pack_name),
           description = nullif(btrim(pack_description), ''),
           thumbnail_asset_id = thumbnail_asset_id_input,
           moderator_feedback = null,
           submitted_at = null,
           decided_at = null,
           decided_by = null,
           updated_at = now()
     where id = next_revision_id;
    delete from public.sticker_pack_items where revision_id = next_revision_id;
  else
    select coalesce(max(revision_number), 0) + 1
      into next_revision_number
      from public.sticker_pack_revisions
     where pack_id = next_pack_id;
    insert into public.sticker_pack_revisions(
      pack_id, revision_number, name, description, thumbnail_asset_id
    ) values (
      next_pack_id,
      next_revision_number,
      btrim(pack_name),
      nullif(btrim(pack_description), ''),
      thumbnail_asset_id_input
    )
    returning id into next_revision_id;
  end if;

  asset_position := 0;
  foreach asset_id_value in array ordered_asset_ids loop
    insert into public.sticker_pack_items(revision_id, asset_id, position, render_mode)
    values (next_revision_id, asset_id_value, asset_position, 'default');
    asset_position := asset_position + 1;
  end loop;

  perform public.validate_sticker_pack_revision(next_revision_id);
  update public.sticker_packs set updated_at = now() where id = next_pack_id;

  return jsonb_build_object('pack_id', next_pack_id, 'revision_id', next_revision_id);
end;
$$;

create or replace function public.submit_sticker_pack_revision(target_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not exists (
    select 1
      from public.sticker_pack_revisions revision
      join public.sticker_packs pack on pack.id = revision.pack_id
     where revision.id = target_revision_id
       and pack.creator_user_id = auth.uid()
       and revision.status in ('draft', 'rejected')
  ) then
    raise exception 'Only an editable revision owned by this account can be submitted.';
  end if;
  perform public.validate_sticker_pack_revision(target_revision_id);
  update public.sticker_pack_revisions
     set status = 'pending',
         moderator_feedback = null,
         submitted_at = now(),
         decided_at = null,
         decided_by = null,
         updated_at = now()
   where id = target_revision_id;
end;
$$;

create or replace function public.install_sticker_pack(target_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not exists (
    select 1
      from public.sticker_packs pack
      join public.sticker_pack_revisions revision
        on revision.id = pack.current_approved_revision_id
     where pack.id = target_pack_id
       and pack.unpublished_at is null
       and revision.status = 'approved'
  ) then
    raise exception 'This sticker pack is not available to install.';
  end if;
  insert into public.sticker_pack_installs(user_id, pack_id)
  values (auth.uid(), target_pack_id)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.sticker_packs
       set download_count = download_count + 1
     where id = target_pack_id;
  else
    update public.sticker_pack_installs
       set updated_at = now()
     where user_id = auth.uid()
       and pack_id = target_pack_id;
  end if;
end;
$$;

create or replace function public.set_sticker_pack_liked(
  target_pack_id uuid,
  liked_input boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  next_like_count bigint;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;
  if not exists (
    select 1
      from public.sticker_packs pack
      join public.sticker_pack_revisions revision
        on revision.id = pack.current_approved_revision_id
     where pack.id = target_pack_id
       and pack.unpublished_at is null
       and revision.status = 'approved'
  ) then
    raise exception 'This sticker pack is not available.';
  end if;

  if liked_input then
    insert into public.sticker_pack_likes(user_id, pack_id)
    values (actor_id, target_pack_id)
    on conflict do nothing;
  else
    delete from public.sticker_pack_likes
     where user_id = actor_id
       and pack_id = target_pack_id;
  end if;

  select count(*) into next_like_count
    from public.sticker_pack_likes
   where pack_id = target_pack_id;
  update public.sticker_packs
     set like_count = next_like_count
   where id = target_pack_id;

  return jsonb_build_object(
    'liked', liked_input,
    'like_count', next_like_count
  );
end;
$$;

create or replace function public.remove_sticker_pack(target_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  delete from public.sticker_pack_installs
   where user_id = auth.uid()
     and pack_id = target_pack_id;
end;
$$;

create or replace function public.approve_sticker_pack_revision(target_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_pack_id uuid;
begin
  if not public.is_sticker_pack_moderator() then
    raise exception 'Moderator authorization required.';
  end if;
  select pack_id into target_pack_id
    from public.sticker_pack_revisions
   where id = target_revision_id
     and status = 'pending';
  if target_pack_id is null then
    raise exception 'Pending sticker pack revision not found.';
  end if;
  perform public.validate_sticker_pack_revision(target_revision_id);
  update public.sticker_pack_revisions
     set status = 'approved',
         moderator_feedback = null,
         decided_at = now(),
         decided_by = auth.uid(),
         updated_at = now()
   where id = target_revision_id;
  update public.sticker_packs
     set current_approved_revision_id = target_revision_id,
         unpublished_at = null,
         unpublished_by = null,
         updated_at = now()
   where id = target_pack_id;
  update public.sticker_pack_installs
     set updated_at = now()
   where pack_id = target_pack_id;
end;
$$;

create or replace function public.reject_sticker_pack_revision(
  target_revision_id uuid,
  feedback_input text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sticker_pack_moderator() then
    raise exception 'Moderator authorization required.';
  end if;
  if char_length(btrim(coalesce(feedback_input, ''))) = 0 then
    raise exception 'Rejection feedback is required.';
  end if;
  update public.sticker_pack_revisions
     set status = 'rejected',
         moderator_feedback = btrim(feedback_input),
         decided_at = now(),
         decided_by = auth.uid(),
         updated_at = now()
   where id = target_revision_id
     and status = 'pending';
  if not found then
    raise exception 'Pending sticker pack revision not found.';
  end if;
end;
$$;

create or replace function public.unpublish_sticker_pack(target_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sticker_pack_moderator() then
    raise exception 'Moderator authorization required.';
  end if;
  update public.sticker_packs
     set unpublished_at = now(),
         unpublished_by = auth.uid(),
         updated_at = now()
   where id = target_pack_id
     and current_approved_revision_id is not null;
  if not found then
    raise exception 'Published sticker pack not found.';
  end if;
  delete from public.sticker_pack_installs where pack_id = target_pack_id;
end;
$$;

revoke all on function public.save_sticker_pack_draft(uuid, uuid, text, text, uuid, uuid[]) from public, anon;
revoke all on function public.submit_sticker_pack_revision(uuid) from public, anon;
revoke all on function public.install_sticker_pack(uuid) from public, anon;
revoke all on function public.remove_sticker_pack(uuid) from public, anon;
revoke all on function public.set_sticker_pack_liked(uuid, boolean) from public, anon;
revoke all on function public.approve_sticker_pack_revision(uuid) from public, anon;
revoke all on function public.reject_sticker_pack_revision(uuid, text) from public, anon;
revoke all on function public.unpublish_sticker_pack(uuid) from public, anon;

grant execute on function public.save_sticker_pack_draft(uuid, uuid, text, text, uuid, uuid[]) to authenticated;
grant execute on function public.submit_sticker_pack_revision(uuid) to authenticated;
grant execute on function public.install_sticker_pack(uuid) to authenticated;
grant execute on function public.remove_sticker_pack(uuid) to authenticated;
grant execute on function public.set_sticker_pack_liked(uuid, boolean) to authenticated;
grant execute on function public.approve_sticker_pack_revision(uuid) to authenticated;
grant execute on function public.reject_sticker_pack_revision(uuid, text) to authenticated;
grant execute on function public.unpublish_sticker_pack(uuid) to authenticated;

grant select on public.sticker_packs to authenticated;
grant select on public.sticker_pack_revisions to authenticated;
grant select on public.sticker_pack_items to authenticated;
grant select on public.sticker_pack_installs to authenticated;
grant select on public.sticker_pack_likes to authenticated;
grant select on public.app_roles to authenticated;

commit;
