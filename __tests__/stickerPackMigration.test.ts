import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../supabase/migrations/20260606110000_public_sticker_packs.sql'
  ),
  'utf8'
);

describe('public sticker pack migration authorization contract', () => {
  it.each([
    'app_roles',
    'sticker_packs',
    'sticker_pack_revisions',
    'sticker_pack_items',
    'sticker_pack_installs',
    'sticker_pack_likes',
  ])('enables RLS on %s', (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it('keeps mutation authorization in security-definer RPCs', () => {
    for (const functionName of [
      'save_sticker_pack_draft',
      'submit_sticker_pack_revision',
      'install_sticker_pack',
      'remove_sticker_pack',
      'set_sticker_pack_liked',
      'approve_sticker_pack_revision',
      'reject_sticker_pack_revision',
      'unpublish_sticker_pack',
    ]) {
      expect(migration).toContain(`function public.${functionName}`);
    }
    expect(migration).toContain('Moderator authorization required.');
    expect(migration).toContain('Every submitted sticker must belong to the pack creator.');
    expect(migration).toContain("check (render_mode = 'default')");
  });

  it('tracks durable downloads and one like per user for popularity sorting', () => {
    expect(migration).toContain('download_count bigint not null default 0');
    expect(migration).toContain('like_count bigint not null default 0');
    expect(migration).toContain('primary key (user_id, pack_id)');
    expect(migration).toContain('set download_count = download_count + 1');
    expect(migration).toContain('set like_count = next_like_count');
  });

  it('uses UUID asset identifiers to match sticker_assets.id', () => {
    expect(migration).toContain(
      'thumbnail_asset_id uuid not null references public.sticker_assets(id)'
    );
    expect(migration).toContain(
      'asset_id uuid not null references public.sticker_assets(id)'
    );
    expect(migration).toContain('thumbnail_asset_id_input uuid');
    expect(migration).toContain('ordered_asset_ids uuid[]');
    expect(migration).not.toContain('thumbnail_asset_id text not null references');
    expect(migration).not.toContain('asset_id text not null references public.sticker_assets');
  });

  it('repairs text columns left by an older migration draft', () => {
    expect(migration).toContain('alter column thumbnail_asset_id type uuid');
    expect(migration).toContain('using thumbnail_asset_id::uuid');
    expect(migration).toContain('alter column asset_id type uuid');
    expect(migration).toContain('using asset_id::uuid');
  });

  it('requires feedback and preserves an approved revision through a current pointer', () => {
    expect(migration).toContain('Rejection feedback is required.');
    expect(migration).toContain('current_approved_revision_id');
    expect(migration).toContain('set current_approved_revision_id = target_revision_id');
    expect(migration).toContain('delete from public.sticker_pack_installs where pack_id = target_pack_id');
  });
});
