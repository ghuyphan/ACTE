create table if not exists public.note_tombstones (
  note_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null
);

create table if not exists public.shared_post_tombstones (
  post_id text primary key,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null
);

create index if not exists idx_note_tombstones_user_deleted
  on public.note_tombstones (user_id, deleted_at desc);

create index if not exists idx_shared_post_tombstones_author_deleted
  on public.shared_post_tombstones (author_user_id, deleted_at desc);

alter table public.note_tombstones enable row level security;
alter table public.shared_post_tombstones enable row level security;

drop policy if exists "note_tombstones_own_read" on public.note_tombstones;
create policy "note_tombstones_own_read"
  on public.note_tombstones for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "note_tombstones_own_insert" on public.note_tombstones;
create policy "note_tombstones_own_insert"
  on public.note_tombstones for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "note_tombstones_own_delete" on public.note_tombstones;
create policy "note_tombstones_own_delete"
  on public.note_tombstones for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "shared_post_tombstones_author_read" on public.shared_post_tombstones;
create policy "shared_post_tombstones_author_read"
  on public.shared_post_tombstones for select
  to authenticated
  using (auth.uid() = author_user_id);

drop policy if exists "shared_post_tombstones_author_insert" on public.shared_post_tombstones;
create policy "shared_post_tombstones_author_insert"
  on public.shared_post_tombstones for insert
  to authenticated
  with check (auth.uid() = author_user_id);

drop policy if exists "shared_post_tombstones_author_delete" on public.shared_post_tombstones;
create policy "shared_post_tombstones_author_delete"
  on public.shared_post_tombstones for delete
  to authenticated
  using (auth.uid() = author_user_id);
