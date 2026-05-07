create table if not exists public.shared_post_response_reactions (
  id text primary key,
  post_id text not null references public.shared_posts(id) on delete cascade,
  response_id text not null references public.shared_post_responses(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_display_name text,
  author_photo_url_snapshot text,
  emoji text not null check (char_length(btrim(emoji)) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (response_id, author_user_id)
);

create index if not exists idx_shared_post_response_reactions_post_response
  on public.shared_post_response_reactions(post_id, response_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'shared_post_response_reactions'
     ) then
    alter publication supabase_realtime add table public.shared_post_response_reactions;
  end if;
end;
$$;

alter table public.shared_post_response_reactions enable row level security;

drop policy if exists "shared_post_response_reactions_visible_select" on public.shared_post_response_reactions;
create policy "shared_post_response_reactions_visible_select"
  on public.shared_post_response_reactions
  for select
  using (
    exists (
      select 1
        from public.shared_posts p
       where p.id = shared_post_response_reactions.post_id
         and (
           p.author_user_id = auth.uid()
           or p.audience_user_ids @> array[auth.uid()]::uuid[]
         )
    )
  );

drop policy if exists "shared_post_response_reactions_audience_insert" on public.shared_post_response_reactions;
create policy "shared_post_response_reactions_audience_insert"
  on public.shared_post_response_reactions
  for insert
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
        from public.shared_posts p
       where p.id = shared_post_response_reactions.post_id
         and (
           p.author_user_id = auth.uid()
           or p.audience_user_ids @> array[auth.uid()]::uuid[]
         )
    )
  );

drop policy if exists "shared_post_response_reactions_author_update" on public.shared_post_response_reactions;
create policy "shared_post_response_reactions_author_update"
  on public.shared_post_response_reactions
  for update
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());
