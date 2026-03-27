alter table public.notes
  add column if not exists note_color text;

alter table public.shared_posts
  add column if not exists note_color text;
