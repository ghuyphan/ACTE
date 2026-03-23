import AsyncStorage from '@react-native-async-storage/async-storage';

type MMKVInstance = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
};

let storageInstance: MMKVInstance | null | undefined;

function getStorageInstance(): MMKVInstance | null {
  if (storageInstance !== undefined) {
    return storageInstance;
  }

  if (process.env.NODE_ENV === 'test') {
    storageInstance = null;
    return storageInstance;
  }

  try {
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (config?: { id?: string }) => MMKVInstance;
    };
    storageInstance = new MMKV({ id: 'noto-app-storage' });
  } catch {
    storageInstance = null;
  }

  return storageInstance;
}

async function migrateLegacyValue(key: string, storage: MMKVInstance) {
  const legacyValue = await AsyncStorage.getItem(key);
  if (legacyValue === null) {
    return null;
  }

  storage.set(key, legacyValue);
  await AsyncStorage.removeItem(key).catch(() => undefined);
  return legacyValue;
}

export async function getPersistentItem(key: string): Promise<string | null> {
  const storage = getStorageInstance();
  if (!storage) {
    return AsyncStorage.getItem(key);
  }

  const storedValue = storage.getString(key);
  if (storedValue !== undefined) {
    return storedValue;
  }

  return migrateLegacyValue(key, storage);
}

export async function setPersistentItem(key: string, value: string): Promise<void> {
  const storage = getStorageInstance();
  if (!storage) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  storage.set(key, value);
  await AsyncStorage.removeItem(key).catch(() => undefined);
}

export async function removePersistentItem(key: string): Promise<void> {
  const storage = getStorageInstance();
  if (!storage) {
    await AsyncStorage.removeItem(key);
    return;
  }

  storage.delete(key);
  await AsyncStorage.removeItem(key).catch(() => undefined);
}

export async function multiSetPersistent(entries: Array<[string, string]>): Promise<void> {
  await Promise.all(entries.map(([key, value]) => setPersistentItem(key, value)));
}
