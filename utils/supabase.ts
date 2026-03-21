import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { mapSupabaseUser } from './appUser';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

type SupportedStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const authStorage: SupportedStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (key) => AsyncStorage.getItem(key),
        setItem: async (key, value) => {
          await AsyncStorage.setItem(key, value);
        },
        removeItem: async (key) => {
          await AsyncStorage.removeItem(key);
        },
      }
    : {
        getItem: async (key) => SecureStore.getItemAsync(key),
        setItem: async (key, value) => {
          await SecureStore.setItemAsync(key, value);
        },
        removeItem: async (key) => {
          await SecureStore.deleteItemAsync(key);
        },
      };

let supabaseClient: SupabaseClient | null | undefined;

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabase() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

export function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is unavailable in this build.');
  }

  return supabase;
}

export function isSupabaseNoRowsError(error: unknown) {
  return Boolean(
    typeof error === 'object' &&
      error &&
      'code' in error &&
      String((error as { code?: string }).code) === 'PGRST116'
  );
}

export function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Unknown Supabase error');
  }

  return 'Unknown Supabase error';
}

export async function getCurrentSupabaseSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session ?? null;
}

export async function getSupabaseUser() {
  const session = await getCurrentSupabaseSession();
  return mapSupabaseUser(session?.user);
}
