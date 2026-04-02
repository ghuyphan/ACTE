import * as FileSystem from '../utils/fileSystem';
import { removePersistentItem } from '../utils/appStorage';
import { getGeofenceCooldownKey, getLocationCooldownId, getSkipNextEnterKey } from '../utils/geofenceKeys';
import {
  deleteAllNotesForScope,
  getAllNotesForScope,
  getDB,
  LOCAL_NOTES_SCOPE,
} from './database';
import { clearGeofenceRegions } from './geofenceService';
import { getNotePairedVideoUri } from './livePhotoStorage';
import { parseNoteStickerPlacements } from './noteStickers';
import { getNotePhotoUri } from './photoStorage';
import { clearSharedFeedCache } from './sharedFeedCache';

interface StickerAssetRow {
  local_uri: string | null;
}

interface SharedCacheRow {
  photo_local_uri: string | null;
  paired_video_local_uri: string | null;
  sticker_placements_json: string | null;
}

async function deleteFileIfPresent(fileUri: string | null | undefined) {
  const normalizedPath = typeof fileUri === 'string' ? fileUri.trim() : '';
  if (!normalizedPath) {
    return;
  }

  try {
    const info = await FileSystem.getInfoAsync(normalizedPath);
    if (info.exists && !info.isDirectory) {
      await FileSystem.deleteAsync(normalizedPath, { idempotent: true });
    }
  } catch (error) {
    console.warn('[account-cleanup] Failed deleting local file:', normalizedPath, error);
  }
}

export async function purgeLocalAccountScope(ownerUid: string | null | undefined): Promise<void> {
  const normalizedOwnerUid = ownerUid?.trim() ?? '';
  if (!normalizedOwnerUid || normalizedOwnerUid === LOCAL_NOTES_SCOPE) {
    return;
  }

  const database = await getDB();
  const [notes, stickerAssets, sharedCacheRows] = await Promise.all([
    getAllNotesForScope(normalizedOwnerUid),
    database.getAllAsync<StickerAssetRow>(
      'SELECT local_uri FROM sticker_assets WHERE owner_uid = ?',
      normalizedOwnerUid
    ),
    database.getAllAsync<SharedCacheRow>(
      `SELECT photo_local_uri, paired_video_local_uri, sticker_placements_json
       FROM shared_posts_cache
       WHERE user_uid = ?`,
      normalizedOwnerUid
    ),
  ]);

  const localFileUris = new Set<string>();
  const geofenceKeys = new Set<string>();

  for (const note of notes) {
    const photoUri = getNotePhotoUri(note);
    const pairedVideoUri = getNotePairedVideoUri(note);
    if (photoUri) {
      localFileUris.add(photoUri);
    }
    if (pairedVideoUri) {
      localFileUris.add(pairedVideoUri);
    }

    geofenceKeys.add(getSkipNextEnterKey(note.id));
    geofenceKeys.add(getGeofenceCooldownKey('note', note.id));
    geofenceKeys.add(
      getGeofenceCooldownKey(
        'location',
        getLocationCooldownId(note.locationName, note.latitude, note.longitude)
      )
    );
  }

  for (const asset of stickerAssets) {
    if (asset.local_uri?.trim()) {
      localFileUris.add(asset.local_uri.trim());
    }
  }

  for (const row of sharedCacheRows) {
    if (row.photo_local_uri?.trim()) {
      localFileUris.add(row.photo_local_uri.trim());
    }
    if (row.paired_video_local_uri?.trim()) {
      localFileUris.add(row.paired_video_local_uri.trim());
    }

    const placements = parseNoteStickerPlacements(row.sticker_placements_json);
    for (const placement of placements) {
      if (placement.asset.localUri?.trim()) {
        localFileUris.add(placement.asset.localUri.trim());
      }
    }
  }

  await Promise.all([
    ...Array.from(localFileUris, (fileUri) => deleteFileIfPresent(fileUri)),
    ...Array.from(geofenceKeys, (key) => removePersistentItem(key).catch(() => undefined)),
  ]);

  await deleteAllNotesForScope(normalizedOwnerUid);
  await database.runAsync('DELETE FROM sticker_assets WHERE owner_uid = ?', normalizedOwnerUid);
  await database.runAsync('DELETE FROM sync_queue WHERE owner_uid = ?', normalizedOwnerUid);
  await clearSharedFeedCache(normalizedOwnerUid).catch(() => undefined);
  await removePersistentItem(`subscription.snapshot.${normalizedOwnerUid}`).catch(() => undefined);
  await clearGeofenceRegions().catch(() => undefined);
}
