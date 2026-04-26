set check_function_bodies = off;

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  photo_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note_count integer not null default 0,
  photo_note_count integer not null default 0,
  last_synced_at timestamptz
);

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('text', 'photo')),
  content text not null,
  photo_path text,
  has_doodle boolean not null default false,
  doodle_strokes_json text,
  location_name text,
  prompt_id text,
  prompt_text_snapshot text,
  prompt_answer text,
  mood_emoji text,
  latitude double precision not null,
  longitude double precision not null,
  radius double precision not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz,
  synced_at timestamptz not null
);

create table if not exists public.friend_invites (
  id text primary key,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  inviter_display_name_snapshot text,
  inviter_photo_url_snapshot text,
  token text not null unique,
  created_at timestamptz not null,
  revoked_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  display_name_snapshot text,
  photo_url_snapshot text,
  friended_at timestamptz not null,
  last_shared_at timestamptz,
  created_by_invite_id text,
  created_by_invite_token text,
  primary key (user_id, friend_user_id)
);

create table if not exists public.shared_posts (
  id text primary key,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_display_name text,
  author_photo_url_snapshot text,
  audience_user_ids uuid[] not null,
  type text not null check (type in ('text', 'photo')),
  text text not null,
  photo_path text,
  doodle_strokes_json text,
  place_name text,
  source_note_id text,
  created_at timestamptz not null,
  updated_at timestamptz
);

create index if not exists idx_notes_user_synced on public.notes (user_id, synced_at desc);
create index if not exists idx_notes_user_updated on public.notes (user_id, updated_at desc nulls last);
create index if not exists idx_friendships_user_friended on public.friendships (user_id, friended_at asc);
create index if not exists idx_shared_posts_created on public.shared_posts (created_at desc);
create index if not exists idx_shared_posts_author_source on public.shared_posts (author_user_id, source_note_id);
create index if not exists idx_shared_posts_audience on public.shared_posts using gin (audience_user_ids);

create unique index if not exists idx_friend_invites_one_active
  on public.friend_invites (inviter_user_id)
  where revoked_at is null and accepted_by_user_id is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, photo_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        photo_url = excluded.photo_url,
        updated_at = now();

  insert into public.user_usage (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_usage enable row level security;
alter table public.notes enable row level security;
alter table public.friend_invites enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_posts enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "user_usage_own_read"
  on public.user_usage for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_usage_own_insert"
  on public.user_usage for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_usage_own_update"
  on public.user_usage for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes_own_all"
  on public.notes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "friend_invites_owner_select"
  on public.friend_invites for select
  to authenticated
  using (auth.uid() = inviter_user_id);

create policy "friend_invites_owner_insert"
  on public.friend_invites for insert
  to authenticated
  with check (auth.uid() = inviter_user_id);

create policy "friend_invites_owner_update"
  on public.friend_invites for update
  to authenticated
  using (auth.uid() = inviter_user_id)
  with check (auth.uid() = inviter_user_id);

create policy "friendships_owner_read"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id);

create policy "friendships_owner_update"
  on public.friendships for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "shared_posts_read_visible"
  on public.shared_posts for select
  to authenticated
  using (auth.uid() = author_user_id or auth.uid() = any (audience_user_ids));

create policy "shared_posts_insert_author"
  on public.shared_posts for insert
  to authenticated
  with check (auth.uid() = author_user_id);

create policy "shared_posts_update_author"
  on public.shared_posts for update
  to authenticated
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

create policy "shared_posts_delete_author"
  on public.shared_posts for delete
  to authenticated
  using (auth.uid() = author_user_id);

create or replace function public.accept_friend_invite(invite_token text, invite_id text default null)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_row public.friend_invites%rowtype;
  current_profile public.profiles%rowtype;
  inviter_profile public.profiles%rowtype;
  now_ts timestamptz := now();
  result_row public.friendships%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into invite_row
    from public.friend_invites
   where token = invite_token
     and (invite_id is null or id = invite_id)
   order by created_at desc
   limit 1;

  if invite_row.id is null then
    raise exception 'Invite not found.';
  end if;

  if invite_row.inviter_user_id = current_user_id then
    raise exception 'You cannot accept your own invite.';
  end if;

  if invite_row.revoked_at is not null then
    raise exception 'This invite link is no longer active.';
  end if;

  if invite_row.accepted_by_user_id is not null and invite_row.accepted_by_user_id <> current_user_id then
    raise exception 'This invite link has already been used.';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at <= now_ts then
    raise exception 'This invite link has expired.';
  end if;

  select * into current_profile from public.profiles where id = current_user_id;
  select * into inviter_profile from public.profiles where id = invite_row.inviter_user_id;

  insert into public.friendships (
    user_id,
    friend_user_id,
    display_name_snapshot,
    photo_url_snapshot,
    friended_at,
    last_shared_at,
    created_by_invite_id,
    created_by_invite_token
  )
  values (
    current_user_id,
    invite_row.inviter_user_id,
    inviter_profile.display_name,
    inviter_profile.photo_url,
    now_ts,
    null,
    invite_row.id,
    invite_row.token
  )
  on conflict (user_id, friend_user_id) do update
    set display_name_snapshot = excluded.display_name_snapshot,
        photo_url_snapshot = excluded.photo_url_snapshot,
        friended_at = excluded.friended_at,
        created_by_invite_id = excluded.created_by_invite_id,
        created_by_invite_token = excluded.created_by_invite_token;

  insert into public.friendships (
    user_id,
    friend_user_id,
    display_name_snapshot,
    photo_url_snapshot,
    friended_at,
    last_shared_at,
    created_by_invite_id,
    created_by_invite_token
  )
  values (
    invite_row.inviter_user_id,
    current_user_id,
    current_profile.display_name,
    current_profile.photo_url,
    now_ts,
    null,
    invite_row.id,
    invite_row.token
  )
  on conflict (user_id, friend_user_id) do update
    set display_name_snapshot = excluded.display_name_snapshot,
        photo_url_snapshot = excluded.photo_url_snapshot,
        friended_at = excluded.friended_at,
        created_by_invite_id = excluded.created_by_invite_id,
        created_by_invite_token = excluded.created_by_invite_token;

  update public.friend_invites
     set accepted_by_user_id = current_user_id,
         accepted_at = now_ts
   where id = invite_row.id;

  select *
    into result_row
    from public.friendships
   where user_id = current_user_id
     and friend_user_id = invite_row.inviter_user_id;

  return result_row;
end;
$$;

create or replace function public.remove_friend(friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.friendships
   where (user_id = current_user_id and friend_user_id = remove_friend.friend_user_id)
      or (user_id = remove_friend.friend_user_id and friend_user_id = current_user_id);
end;
$$;

grant execute on function public.accept_friend_invite(text, text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values
  ('note-media', 'note-media', false),
  ('shared-post-media', 'shared-post-media', false)
on conflict (id) do nothing;

create policy "note_media_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_media_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shared_post_media_select_visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shared-post-media'
    and exists (
      select 1
        from public.shared_posts
       where shared_posts.photo_path = storage.objects.name
         and (shared_posts.author_user_id = auth.uid() or auth.uid() = any (shared_posts.audience_user_ids))
    )
  );

create policy "shared_post_media_insert_author"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shared-post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shared_post_media_update_author"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shared-post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'shared-post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shared_post_media_delete_author"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shared-post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

do $$
begin
  if not exists (
    select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
     where p.pubname = 'supabase_realtime'
       and n.nspname = 'public'
       and c.relname = 'user_usage'
  ) then
    alter publication supabase_realtime add table public.user_usage;
  end if;

  if not exists (
    select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
     where p.pubname = 'supabase_realtime'
       and n.nspname = 'public'
       and c.relname = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;

  if not exists (
    select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
     where p.pubname = 'supabase_realtime'
       and n.nspname = 'public'
       and c.relname = 'friend_invites'
  ) then
    alter publication supabase_realtime add table public.friend_invites;
  end if;

  if not exists (
    select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
     where p.pubname = 'supabase_realtime'
       and n.nspname = 'public'
       and c.relname = 'shared_posts'
  ) then
    alter publication supabase_realtime add table public.shared_posts;
  end if;
end;
$$;
