import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('supabase migration hardening', () => {
  const migration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260321113000_noto_initial.sql'),
    'utf8'
  );
  const stickerMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260326113000_add_sticker_sync_columns.sql'),
    'utf8'
  );
  const noteColorMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260327103000_add_note_color_columns.sql'),
    'utf8'
  );
  const sharedPostCoordinatesMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260327113000_add_shared_post_coordinates.sql'),
    'utf8'
  );
  const sharedFriendRevocationMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260327123000_harden_shared_friend_revocation.sql'),
    'utf8'
  );
  const removeStorageCleanupTriggersMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260327133000_remove_storage_cleanup_triggers.sql'),
    'utf8'
  );
  const socialPushMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260329100000_add_social_push_tokens.sql'),
    'utf8'
  );
  const normalizedRemoveStorageCleanupTriggersMigration =
    removeStorageCleanupTriggersMigration.toLowerCase();

  it('creates profiles and user_usage rows for each auth user', () => {
    expect(migration).toContain('create or replace function public.handle_new_user()');
    expect(migration).toContain('insert into public.profiles (id, display_name, photo_url)');
    expect(migration).toContain('insert into public.user_usage (user_id)');
    expect(migration).toContain('create trigger on_auth_user_created');
  });

  it('secures shared posts and friendships with row-level policies', () => {
    expect(migration).toContain('alter table public.shared_posts enable row level security;');
    expect(migration).toContain('create policy "friendships_owner_read"');
    expect(sharedFriendRevocationMigration).toContain('create policy "shared_posts_read_visible"');
    expect(sharedFriendRevocationMigration).toContain('public.are_users_friends(author_user_id, auth.uid())');
    expect(sharedFriendRevocationMigration).toContain('public.is_valid_shared_post_audience(author_user_id, audience_user_ids)');
  });

  it('adds invite and membership RPCs for atomic multi-row writes', () => {
    expect(migration).toContain('create or replace function public.accept_friend_invite');
    expect(migration).toContain('create or replace function public.create_room_with_owner');
    expect(migration).toContain('create or replace function public.join_room_by_invite');
    expect(migration).toContain('create or replace function public.remove_room_member');
    expect(migration).toContain('create or replace function public.remove_friend');
  });

  it('backfills remote sticker sync columns for notes and shared posts', () => {
    expect(stickerMigration).toContain('alter table public.notes');
    expect(stickerMigration).toContain('add column if not exists has_stickers boolean not null default false');
    expect(stickerMigration).toContain('add column if not exists sticker_placements_json text');
    expect(stickerMigration).toContain('alter table public.shared_posts');
  });

  it('adds note color columns for synced notes and shared posts', () => {
    expect(noteColorMigration).toContain('alter table public.notes');
    expect(noteColorMigration).toContain('add column if not exists note_color text');
    expect(noteColorMigration).toContain('alter table public.shared_posts');
  });

  it('adds shared post coordinates for map rendering', () => {
    expect(sharedPostCoordinatesMigration).toContain('alter table public.shared_posts');
    expect(sharedPostCoordinatesMigration).toContain('add column if not exists latitude double precision');
    expect(sharedPostCoordinatesMigration).toContain('add column if not exists longitude double precision');
  });

  it('revokes old shared access when a friendship is removed', () => {
    expect(sharedFriendRevocationMigration).toContain('create or replace function public.remove_friend(friend_user_id uuid)');
    expect(sharedFriendRevocationMigration).toContain('set audience_user_ids = array_remove(audience_user_ids, remove_friend.friend_user_id)');
    expect(sharedFriendRevocationMigration).toContain('set audience_user_ids = array_remove(audience_user_ids, current_user_id)');
  });

  it('stores device push tokens and exposes RPCs for secure registration', () => {
    expect(socialPushMigration).toContain('create table if not exists public.device_push_tokens');
    expect(socialPushMigration).toContain('alter table public.device_push_tokens enable row level security;');
    expect(socialPushMigration).toContain('create or replace function public.register_push_token');
    expect(socialPushMigration).toContain('create or replace function public.unregister_push_token');
  });

  it('removes unsupported storage cleanup triggers that delete from storage.objects directly', () => {
    expect(normalizedRemoveStorageCleanupTriggersMigration).toContain(
      'drop trigger if exists tr_delete_note_media on public.notes;'
    );
    expect(normalizedRemoveStorageCleanupTriggersMigration).toContain(
      'drop trigger if exists tr_delete_shared_post_media on public.shared_posts;'
    );
    expect(normalizedRemoveStorageCleanupTriggersMigration).toContain(
      'drop trigger if exists tr_delete_room_post_media on public.room_posts;'
    );
    expect(normalizedRemoveStorageCleanupTriggersMigration).not.toContain(
      'delete from storage.objects'
    );
  });
});
