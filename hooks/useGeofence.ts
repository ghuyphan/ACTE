import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from './useAuth';
import { getReminderPermissionState, syncGeofenceRegions } from '../services/geofenceService';
import { syncSocialPushRegistration } from '../services/socialPushService';
import { scheduleOnIdle } from '../utils/scheduleOnIdle';

const LOCATION_FIX_TIMEOUT_MS = 8000;

function getLocationErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message.toLowerCase();
    }

    if (typeof error === 'object' && error && 'message' in error) {
        return String((error as { message?: unknown }).message ?? '').toLowerCase();
    }

    return '';
}

export interface ForegroundLocationRequestResult {
    location: Location.LocationObject | null;
    requiresSettings: boolean;
    reason: 'permission_denied' | 'services_disabled' | 'timeout' | 'unavailable' | null;
}

export interface ReminderPermissionRequestResult {
    enabled: boolean;
    requiresSettings: boolean;
}

export function useGeofence() {
    const { user } = useAuth();
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const [remindersEnabled, setRemindersEnabled] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    const refreshPermissions = useCallback(async () => {
        const permissionState = await getReminderPermissionState();
        setHasLocationPermission(permissionState.foregroundGranted);
        setRemindersEnabled(permissionState.remindersEnabled);
        return permissionState;
    }, []);

    const refreshLocation = useCallback(async (): Promise<ForegroundLocationRequestResult> => {
        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                return {
                    location: null,
                    requiresSettings: true,
                    reason: 'services_disabled',
                };
            }

            const known = await Location.getLastKnownPositionAsync();
            if (known) {
                setLocation(known);
                return {
                    location: known,
                    requiresSettings: false,
                    reason: null,
                };
            }

            const timeoutToken = Symbol('foreground-location-timeout');
            const currentLocation = await Promise.race<Location.LocationObject | typeof timeoutToken>([
                Location.getCurrentPositionAsync({
                    accuracy: Location.LocationAccuracy.Balanced,
                }),
                new Promise<typeof timeoutToken>((resolve) => {
                    setTimeout(() => resolve(timeoutToken), LOCATION_FIX_TIMEOUT_MS);
                }),
            ]);

            if (currentLocation === timeoutToken) {
                return {
                    location: null,
                    requiresSettings: false,
                    reason: 'timeout',
                };
            }

            if (currentLocation) {
                setLocation(currentLocation);
            }

            return {
                location: currentLocation,
                requiresSettings: false,
                reason: currentLocation ? null : 'unavailable',
            };
        } catch (error) {
            const errorMessage = getLocationErrorMessage(error);
            return {
                location: null,
                requiresSettings:
                    errorMessage.includes('location services are disabled') ||
                    errorMessage.includes('provider is unavailable'),
                reason:
                    errorMessage.includes('location services are disabled') ||
                    errorMessage.includes('provider is unavailable')
                        ? 'services_disabled'
                        : 'unavailable',
            };
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const idleHandle = scheduleOnIdle(() => {
            void (async () => {
                const foregroundStatus = await Location.getForegroundPermissionsAsync();
                if (cancelled) {
                    return;
                }

                setHasLocationPermission(foregroundStatus.status === 'granted');
                await refreshPermissions();
            })();
        });

        return () => {
            cancelled = true;
            idleHandle.cancel();
        };
    }, [refreshPermissions]);

    const requestForegroundLocation = useCallback(async (): Promise<ForegroundLocationRequestResult> => {
        let foregroundStatus = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus.status !== 'granted') {
            foregroundStatus = await Location.requestForegroundPermissionsAsync();
        }

        const granted = foregroundStatus.status === 'granted';
        setHasLocationPermission(granted);

        if (!granted) {
            return {
                location: null,
                requiresSettings: foregroundStatus.canAskAgain === false,
                reason: 'permission_denied',
            };
        }

        return refreshLocation();
    }, [refreshLocation]);

    const requestReminderPermissions = useCallback(async (): Promise<ReminderPermissionRequestResult> => {
        const foregroundResult = await requestForegroundLocation();
        if (!foregroundResult.location) {
            setRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: foregroundResult.requiresSettings,
            };
        }

        let backgroundStatus = await Location.getBackgroundPermissionsAsync();
        if (backgroundStatus.status !== 'granted') {
            backgroundStatus = await Location.requestBackgroundPermissionsAsync();
        }

        let notificationStatus = await Notifications.getPermissionsAsync();
        if (notificationStatus.status !== 'granted') {
            notificationStatus = await Notifications.requestPermissionsAsync();
        }

        const enabled =
            backgroundStatus.status === 'granted' && notificationStatus.status === 'granted';

        setRemindersEnabled(enabled);
        if (enabled) {
            await syncGeofenceRegions();
            if (user) {
                void syncSocialPushRegistration(user).catch((error) => {
                    console.warn('[social-push] Registration refresh failed:', error);
                });
            }
        }

        const requiresSettings =
            (backgroundStatus.status !== 'granted' && backgroundStatus.canAskAgain === false) ||
            (notificationStatus.status !== 'granted' && notificationStatus.canAskAgain === false);

        return {
            enabled,
            requiresSettings,
        };
    }, [requestForegroundLocation, user]);

    const openAppSettings = useCallback(async () => {
        try {
            await Linking.openSettings();
        } catch {
            return;
        }
    }, []);

    return {
        location,
        hasLocationPermission,
        remindersEnabled,
        refreshPermissions,
        requestForegroundLocation,
        requestReminderPermissions,
        openAppSettings,
    };
}
