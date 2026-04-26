alter table public.notes
  add column if not exists local_revision bigint not null default 0;

create index if not exists notes_user_local_revision_idx
  on public.notes(user_id, local_revision desc);
