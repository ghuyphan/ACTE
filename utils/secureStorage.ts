import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function isNativeSecureStoragePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (isNativeSecureStoragePlatform()) {
    return SecureStore.getItemAsync(key);
  }

  return AsyncStorage.getItem(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isNativeSecureStoragePlatform()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

export async function removeSecureItem(key: string): Promise<void> {
  if (isNativeSecureStoragePlatform()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}
