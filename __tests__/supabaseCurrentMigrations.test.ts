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
  const noteLocalRevisionMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260426150000_add_note_local_revision.sql'),
    'utf8'
  );
  const sharedChatIntegrityMigration = readFileSync(
    resolve(__dirname, '../supabase/migrations/20260526120000_harden_shared_chat_integrity.sql'),
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

  it('keeps media path ownership checks on every remote media column', () => {
    expect(mediaPathOwnershipMigration).toContain('storage_path_input = btrim(storage_path_input)');
    expect(mediaPathOwnershipMigration).toContain(
      "split_part(storage_path_input, '/', 1) = owner_user_id_input::text"
    );
    expect(mediaPathOwnershipMigration).toContain("storage_path_input !~ '(^|/)\\.\\.?(/|$)'");
    expect(mediaPathOwnershipMigration).toContain("storage_path_input !~ '//'");
    expect(mediaPathOwnershipMigration).toContain('[A-Za-z0-9][A-Za-z0-9._/-]*');

    for (const column of [
      'photo_path',
      'paired_video_path',
      'dual_primary_photo_path',
      'dual_secondary_photo_path',
    ]) {
      expect(mediaPathOwnershipMigration).toContain(
        `(${column} is null or public.is_valid_user_storage_path(user_id, ${column}))`
      );
      expect(mediaPathOwnershipMigration).toContain(
        `(${column} is null or public.is_valid_user_storage_path(author_user_id, ${column}))`
      );
      expect(mediaPathOwnershipMigration).toContain(`shared_posts.${column} = storage.objects.name`);
    }
  });

  it('drops the legacy room schema for already-migrated Supabase projects', () => {
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.room_posts cascade');
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.room_invites cascade');
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.room_members cascade');
    expect(legacyRoomCleanupMigration).toContain('drop table if exists public.rooms cascade');
    expect(legacyRoomCleanupMigration).toContain("where id = 'room-post-media'");
  });

  it('keeps the remote note revision column available for sync conflict checks', () => {
    expect(noteLocalRevisionMigration).toContain('add column if not exists local_revision bigint not null default 0');
    expect(noteLocalRevisionMigration).toContain('notes_user_local_revision_idx');
  });

  it('keeps shared chat response and direct-chat integrity checks in current migrations', () => {
    expect(sharedChatIntegrityMigration).toContain(
      'foreign key (post_id, response_id)'
    );
    expect(sharedChatIntegrityMigration).toContain(
      'response.post_id = shared_post_response_reactions.post_id'
    );
    expect(sharedChatIntegrityMigration).toContain(
      'foreign key (post_id, reply_to_response_id)'
    );
    expect(sharedChatIntegrityMigration).toContain(
      'create or replace function public.enforce_direct_shared_chat_integrity()'
    );
    expect(sharedChatIntegrityMigration).toContain(
      'Direct chats require an existing friendship.'
    );
    expect(sharedChatIntegrityMigration).toContain(
      'direct_chat_key = least(audience_user_ids[1]::text, audience_user_ids[2]::text)'
    );
  });
});
