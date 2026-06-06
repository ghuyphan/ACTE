import { Platform } from 'react-native';
import * as FileSystem from '../utils/fileSystem';
import {
  getCurrentSupabaseSession,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from '../utils/supabase';

const FILE_UPLOAD_RETRY_DELAYS_MS = [250];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeStoragePath(value: string) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function buildUploadError(status: number, body: string) {
  const detail = body.trim();
  return new Error(
    detail
      ? `Storage file upload failed (${status}): ${detail}`
      : `Storage file upload failed (${status}).`
  );
}

export async function uploadFileToSupabaseStorage(options: {
  bucket: string;
  path: string;
  fileUri: string;
  contentType: string;
  allowOverwrite?: boolean;
}): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  const [session, supabaseUrl, anonKey] = await Promise.all([
    getCurrentSupabaseSession(),
    Promise.resolve(getSupabaseUrl()),
    Promise.resolve(getSupabaseAnonKey()),
  ]);
  if (!session?.access_token || !supabaseUrl || !anonKey) {
    return false;
  }

  const uploadUrl =
    `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/` +
    `${encodeURIComponent(options.bucket)}/${encodeStoragePath(options.path)}`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': options.contentType,
    'x-upsert': options.allowOverwrite === true ? 'true' : 'false',
  };

  for (let attempt = 0; attempt <= FILE_UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    let response: FileSystem.FileSystemUploadResult;
    try {
      response = await FileSystem.uploadAsync(uploadUrl, options.fileUri, {
        headers,
        httpMethod: 'POST',
      });
    } catch (error) {
      if (attempt === FILE_UPLOAD_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await sleep(FILE_UPLOAD_RETRY_DELAYS_MS[attempt] ?? 250);
      continue;
    }

    if (response.status >= 200 && response.status < 300) {
      return true;
    }

    if (!isRetryableStatus(response.status) || attempt === FILE_UPLOAD_RETRY_DELAYS_MS.length) {
      throw buildUploadError(response.status, response.body);
    }

    await sleep(FILE_UPLOAD_RETRY_DELAYS_MS[attempt] ?? 250);
  }

  return false;
}
