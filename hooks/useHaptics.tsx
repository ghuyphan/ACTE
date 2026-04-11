import * as ExpoHaptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getPersistentItem, getPersistentItemSync, setPersistentItem } from '../utils/appStorage';

type HapticsContextValue = {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => Promise<void>;
  preferenceReady: boolean;
};

const HAPTICS_ENABLED_KEY = 'settings.hapticsEnabled';
const HapticsContext = createContext<HapticsContextValue | undefined>(undefined);

const ENABLED_VALUES = new Set(['true', '1']);
let hapticsEnabled = true;

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
export type ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export type NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

function normalizeHapticsEnabled(value: string | null): boolean {
  if (value === null) {
    return true;
  }

  return ENABLED_VALUES.has(value.trim().toLowerCase());
}

function setGlobalHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

function handleHapticsError(error: unknown) {
  console.warn('[haptics] Failed to trigger feedback:', error);
}

function wrapHapticsCall(callback: () => Promise<void> | void): Promise<void> {
  if (!hapticsEnabled) {
    return Promise.resolve();
  }

  try {
    return Promise.resolve(callback()).catch(handleHapticsError);
  } catch (error) {
    handleHapticsError(error);
    return Promise.resolve();
  }
}

export function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light
): Promise<void> {
  return wrapHapticsCall(() => ExpoHaptics.impactAsync(style));
}

export function notificationAsync(
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success
): Promise<void> {
  return wrapHapticsCall(() => ExpoHaptics.notificationAsync(type));
}

export function selectionAsync(): Promise<void> {
  return wrapHapticsCall(() => ExpoHaptics.selectionAsync());
}

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  const initialSavedPreference = getPersistentItemSync(HAPTICS_ENABLED_KEY);
  const [isEnabled, setIsEnabledState] = useState<boolean>(() =>
    normalizeHapticsEnabled(initialSavedPreference ?? null)
  );
  const [preferenceReady, setPreferenceReady] = useState(() => initialSavedPreference !== undefined);

  useEffect(() => {
    setGlobalHapticsEnabled(isEnabled);
  }, [isEnabled]);

  useEffect(() => {
    if (preferenceReady) {
      return;
    }

    let cancelled = false;

    void getPersistentItem(HAPTICS_ENABLED_KEY)
      .then((value) => {
        if (cancelled) {
          return;
        }

        setIsEnabledState(normalizeHapticsEnabled(value));
      })
      .catch((error) => {
        console.warn('[haptics] Failed to load preference:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setPreferenceReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preferenceReady]);

  const setIsEnabled = useCallback(async (enabled: boolean) => {
    setIsEnabledState(enabled);
    await setPersistentItem(HAPTICS_ENABLED_KEY, enabled ? 'true' : 'false');
  }, []);

  return (
    <HapticsContext.Provider value={{ isEnabled, setIsEnabled, preferenceReady }}>
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics() {
  const context = useContext(HapticsContext);

  if (!context) {
    throw new Error('useHaptics must be used within a HapticsProvider');
  }

  return context;
}
