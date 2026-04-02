alter table public.notes
  add column if not exists is_live_photo boolean not null default false,
  add column if not exists paired_video_path text;

alter table public.shared_posts
  add column if not exists is_live_photo boolean not null default false,
  add column if not exists paired_video_path text;
