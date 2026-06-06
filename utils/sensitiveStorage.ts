import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  getPersistentItem,
  removePersistentItem,
  setPersistentItem,
} from './appStorage';

type MMKVInstance = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => boolean;
};

const SENSITIVE_STORAGE_ID = 'noto-sensitive-storage';
const SENSITIVE_STORAGE_KEY_NAME = 'noto.sensitive-storage.encryption-key.v1';
const SENSITIVE_VALUE_KEY_PREFIX = 'noto.sensitive-value.';

let sensitiveStoragePromise: Promise<MMKVInstance | null> | null = null;

function isNativePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function getOrCreateEncryptionKey() {
  const existingKey = await SecureStore.getItemAsync(SENSITIVE_STORAGE_KEY_NAME);
  if (existingKey?.trim()) {
    return existingKey;
  }

  const nextKey = bytesToHex(await Crypto.getRandomBytesAsync(16));
  await SecureStore.setItemAsync(SENSITIVE_STORAGE_KEY_NAME, nextKey);
  return nextKey;
}

async function createSensitiveStorage(): Promise<MMKVInstance | null> {
  if (!isNativePlatform() || process.env.NODE_ENV === 'test') {
    return null;
  }

  try {
    const encryptionKey = await getOrCreateEncryptionKey();
    const { createMMKV } = require('react-native-mmkv') as {
      createMMKV: (config: {
        id: string;
        encryptionKey: string;
        encryptionType: 'AES-256';
      }) => MMKVInstance;
    };

    return createMMKV({
      id: SENSITIVE_STORAGE_ID,
      encryptionKey,
      encryptionType: 'AES-256',
    });
  } catch (error) {
    console.warn('[sensitive-storage] Encrypted storage unavailable; using secure fallback:', error);
    return null;
  }
}

function getSensitiveStorage() {
  sensitiveStoragePromise ??= createSensitiveStorage();
  return sensitiveStoragePromise;
}

function shouldUseSecureStoreFallback() {
  return isNativePlatform() && process.env.NODE_ENV !== 'test';
}

function getSecureFallbackKey(key: string) {
  return `${SENSITIVE_VALUE_KEY_PREFIX}${key}`;
}

export async function getSensitiveItem(key: string): Promise<string | null> {
  const storage = await getSensitiveStorage();
  if (!storage) {
    if (shouldUseSecureStoreFallback()) {
      const secureValue = await SecureStore.getItemAsync(getSecureFallbackKey(key));
      if (secureValue !== null) {
        return secureValue;
      }

      const legacyValue = await getPersistentItem(key);
      if (legacyValue !== null) {
        await SecureStore.setItemAsync(getSecureFallbackKey(key), legacyValue);
        await removePersistentItem(key);
      }
      return legacyValue;
    }

    return getPersistentItem(key);
  }

  const encryptedValue = storage.getString(key);
  if (encryptedValue !== undefined) {
    return encryptedValue;
  }

  const legacyValue = await getPersistentItem(key);
  if (legacyValue === null) {
    return null;
  }

  storage.set(key, legacyValue);
  await removePersistentItem(key);
  return legacyValue;
}

export async function setSensitiveItem(key: string, value: string): Promise<void> {
  const storage = await getSensitiveStorage();
  if (!storage) {
    if (shouldUseSecureStoreFallback()) {
      await SecureStore.setItemAsync(getSecureFallbackKey(key), value);
      await removePersistentItem(key);
      return;
    }

    await setPersistentItem(key, value);
    return;
  }

  storage.set(key, value);
  await removePersistentItem(key);
}

export async function removeSensitiveItem(key: string): Promise<void> {
  const storage = await getSensitiveStorage();
  storage?.remove(key);
  if (shouldUseSecureStoreFallback()) {
    await SecureStore.deleteItemAsync(getSecureFallbackKey(key));
  }
  await removePersistentItem(key);
}

export function resetSensitiveStorageForTests() {
  sensitiveStoragePromise = null;
}
