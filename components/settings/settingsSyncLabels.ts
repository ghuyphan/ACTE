import type { TFunction } from 'i18next';

type SyncQueueOperation = 'create' | 'update' | 'delete' | 'deleteAll';
type SyncQueueStatus = 'pending' | 'processing' | 'failed';

export function getSyncOperationLabel(t: TFunction, operation: SyncQueueOperation) {
  switch (operation) {
    case 'create':
      return t('settings.syncOpCreate', 'Create');
    case 'update':
      return t('settings.syncOpUpdate', 'Update');
    case 'delete':
      return t('settings.syncOpDelete', 'Delete');
    case 'deleteAll':
      return t('settings.syncOpDeleteAll', 'Delete all');
    default:
      return operation;
  }
}

export function getSyncItemStatusLabel(t: TFunction, status: SyncQueueStatus) {
  switch (status) {
    case 'pending':
      return t('settings.syncItemStatusPending', 'Pending');
    case 'processing':
      return t('settings.syncItemStatusProcessing', 'Processing');
    case 'failed':
      return t('settings.syncItemStatusFailed', 'Failed');
    default:
      return status;
  }
}
