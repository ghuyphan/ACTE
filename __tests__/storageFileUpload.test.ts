const mockUploadAsync = jest.fn();
const mockGetCurrentSupabaseSession = jest.fn();

jest.mock('../utils/fileSystem', () => ({
  uploadAsync: (...args: unknown[]) => mockUploadAsync(...args),
}));

jest.mock('../utils/supabase', () => ({
  getCurrentSupabaseSession: () => mockGetCurrentSupabaseSession(),
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseUrl: () => 'https://project.supabase.co/',
}));

import { uploadFileToSupabaseStorage } from '../services/storageFileUpload';

describe('uploadFileToSupabaseStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSupabaseSession.mockResolvedValue({
      access_token: 'access-token',
    });
    mockUploadAsync.mockResolvedValue({
      body: '{}',
      headers: {},
      status: 200,
    });
  });

  it('uploads a native file directly to the authenticated Storage object endpoint', async () => {
    await expect(
      uploadFileToSupabaseStorage({
        bucket: 'note-media',
        path: 'user-1/folder with space/photo.jpg',
        fileUri: 'file:///private/photo.jpg',
        contentType: 'image/jpeg',
        allowOverwrite: true,
      })
    ).resolves.toBe(true);

    expect(mockUploadAsync).toHaveBeenCalledWith(
      'https://project.supabase.co/storage/v1/object/note-media/user-1/folder%20with%20space/photo.jpg',
      'file:///private/photo.jpg',
      {
        headers: {
          apikey: 'anon-key',
          Authorization: 'Bearer access-token',
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
        httpMethod: 'POST',
      }
    );
  });

  it('fails immediately for a non-retryable storage response', async () => {
    mockUploadAsync.mockResolvedValue({
      body: '{"message":"not allowed"}',
      headers: {},
      status: 403,
    });

    await expect(
      uploadFileToSupabaseStorage({
        bucket: 'note-media',
        path: 'user-1/photo.jpg',
        fileUri: 'file:///private/photo.jpg',
        contentType: 'image/jpeg',
      })
    ).rejects.toThrow('Storage file upload failed (403)');

    expect(mockUploadAsync).toHaveBeenCalledTimes(1);
  });

  it('returns false when no authenticated native upload context is available', async () => {
    mockGetCurrentSupabaseSession.mockResolvedValue(null);

    await expect(
      uploadFileToSupabaseStorage({
        bucket: 'note-media',
        path: 'user-1/photo.jpg',
        fileUri: 'file:///private/photo.jpg',
        contentType: 'image/jpeg',
      })
    ).resolves.toBe(false);

    expect(mockUploadAsync).not.toHaveBeenCalled();
  });
});
