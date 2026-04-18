alter table public.notes
  add column if not exists capture_variant text,
  add column if not exists dual_primary_photo_path text,
  add column if not exists dual_secondary_photo_path text,
  add column if not exists dual_primary_facing text,
  add column if not exists dual_secondary_facing text,
  add column if not exists dual_layout_preset text;

alter table public.shared_posts
  add column if not exists capture_variant text,
  add column if not exists dual_primary_photo_path text,
  add column if not exists dual_secondary_photo_path text,
  add column if not exists dual_primary_facing text,
  add column if not exists dual_secondary_facing text,
  add column if not exists dual_layout_preset text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_capture_variant_check'
  ) then
    alter table public.notes
      add constraint notes_capture_variant_check
      check (capture_variant in ('single', 'dual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_dual_primary_facing_check'
  ) then
    alter table public.notes
      add constraint notes_dual_primary_facing_check
      check (dual_primary_facing in ('front', 'back'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_dual_secondary_facing_check'
  ) then
    alter table public.notes
      add constraint notes_dual_secondary_facing_check
      check (dual_secondary_facing in ('front', 'back'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_dual_layout_preset_check'
  ) then
    alter table public.notes
      add constraint notes_dual_layout_preset_check
      check (dual_layout_preset in ('top-left'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_posts_capture_variant_check'
  ) then
    alter table public.shared_posts
      add constraint shared_posts_capture_variant_check
      check (capture_variant in ('single', 'dual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_posts_dual_primary_facing_check'
  ) then
    alter table public.shared_posts
      add constraint shared_posts_dual_primary_facing_check
      check (dual_primary_facing in ('front', 'back'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_posts_dual_secondary_facing_check'
  ) then
    alter table public.shared_posts
      add constraint shared_posts_dual_secondary_facing_check
      check (dual_secondary_facing in ('front', 'back'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_posts_dual_layout_preset_check'
  ) then
    alter table public.shared_posts
      add constraint shared_posts_dual_layout_preset_check
      check (dual_layout_preset in ('top-left'));
  end if;
end
$$;
