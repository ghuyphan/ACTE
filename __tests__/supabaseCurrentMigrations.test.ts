import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('current Supabase migrations', () => {
  const mediaPathOwnershipMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260426120000_harden_media_path_ownership.sql'),
    'utf8'
  );
  const legacyRoomCleanupMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260426123000_drop_legacy_room_schema.sql'),
    'utf8'
  );

  it('hardens note and shared-post media paths without reintroducing room schema', () => {
    expect(mediaPathOwnershipMigration).toContain('public.is_valid_user_storage_path');
    expect(mediaPathOwnershipMigration).toContain('alter table public.notes');
    expect(mediaPathOwnershipMigration).toContain('alter table public.shared_posts');
    expect(mediaPathOwnershipMigration).toContain('shared_post_media_select_visible');
    expect(mediaPathOwnershipMigration).not.toContain('room_posts');
    expect(mediaPathOwnershipMigration).not.toContain('room-post-media');
  });

  it('drops the legacy room schema for already-migrated Supabase projects', () => {
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.room_posts cascade');
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.room_invites cascade');
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.room_members cascade');
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.rooms cascade');
    expect(legacyRoomCleanupMigration).toContain("where id = 'room-post-media'");
  });
});
