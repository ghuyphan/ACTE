export type SyncChangeType = 'create' | 'update' | 'delete' | 'deleteAll';

export interface SyncChange {
  type: SyncChangeType;
  entity: 'note';
  entityId?: string;
  timestamp: string;
}

export interface SyncService {
  isAvailable: boolean;
  recordChange: (change: SyncChange) => Promise<void>;
}

const localFirstSyncService: SyncService = {
  isAvailable: false,
  async recordChange() {
    return;
  },
};

export function getSyncService(): SyncService {
  return localFirstSyncService;
}
