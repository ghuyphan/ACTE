begin;

alter table public.shared_posts
  add column if not exists is_direct_chat boolean not null default false;

alter table public.shared_posts
  add column if not exists direct_chat_key text;

create unique index if not exists idx_shared_posts_direct_chat_key
  on public.shared_posts(direct_chat_key)
  where is_direct_chat;

alter table public.shared_posts
  drop constraint if exists shared_posts_direct_chat_key_check;

alter table public.shared_posts
  add constraint shared_posts_direct_chat_key_check
  check (
    (is_direct_chat and direct_chat_key is not null and source_note_id is null)
    or (not is_direct_chat and direct_chat_key is null)
  );

commit;
