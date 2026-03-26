alter table public.notes
  add column if not exists has_stickers boolean not null default false,
  add column if not exists sticker_placements_json text;

alter table public.shared_posts
  add column if not exists sticker_placements_json text;
