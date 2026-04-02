import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('delete-account edge function', () => {
  const source = readFileSync(
    resolve(__dirname, '../supabase/functions/delete-account/index.ts'),
    'utf8'
  );

  it('removes paired live-photo videos alongside note and shared-post media', () => {
    expect(source).toContain('paired_video_path');
    expect(source).toContain(".select('photo_path, paired_video_path, sticker_placements_json')");
    expect(source).toContain('addStoragePath(notePaths, row.paired_video_path);');
    expect(source).toContain('addStoragePath(sharedPostPaths, row.paired_video_path);');
  });
});
