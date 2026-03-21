import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('supabase migration hardening', () => {
  const migration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260321113000_noto_initial.sql'),
    'utf8'
  );

  it('creates profiles and user_usage rows for each auth user', () => {
    expect(migration).toContain('create or replace function public.handle_new_user()');
    expect(migration).toContain('insert into public.profiles (id, display_name, photo_url)');
    expect(migration).toContain('insert into public.user_usage (user_id)');
    expect(migration).toContain('create trigger on_auth_user_created');
  });

  it('secures shared posts and friendships with row-level policies', () => {
    expect(migration).toContain('alter table public.shared_posts enable row level security;');
    expect(migration).toContain('create policy "shared_posts_read_visible"');
    expect(migration).toContain('auth.uid() = author_user_id');
    expect(migration).toContain('auth.uid() = any (audience_user_ids)');
    expect(migration).toContain('create policy "friendships_owner_read"');
  });

  it('adds invite and membership RPCs for atomic multi-row writes', () => {
    expect(migration).toContain('create or replace function public.accept_friend_invite');
    expect(migration).toContain('create or replace function public.create_room_with_owner');
    expect(migration).toContain('create or replace function public.join_room_by_invite');
    expect(migration).toContain('create or replace function public.remove_room_member');
    expect(migration).toContain('create or replace function public.remove_friend');
  });
});
