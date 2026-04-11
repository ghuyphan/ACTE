begin;

grant select, insert, update, delete on public.sticker_assets to authenticated;
grant select, insert, update, delete on public.sticker_asset_refs to authenticated;

alter table public.sticker_assets enable row level security;
alter table public.sticker_asset_refs enable row level security;

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

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sticker_asset_refs'
  loop
    execute format(
      'drop policy if exists %I on public.sticker_asset_refs',
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
