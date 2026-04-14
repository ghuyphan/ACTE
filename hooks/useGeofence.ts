import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from './useAuth';
import {
    arePlaceRemindersEnabled,
    getReminderPermissionState,
    syncGeofenceRegions,
} from '../services/geofenceService';
import { syncSocialPushRegistration } from '../services/socialPushService';
import { scheduleOnIdle } from '../utils/scheduleOnIdle';

const LOCATION_FIX_TIMEOUT_MS = 8000;
const RECENT_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;

function getLocationErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message.toLowerCase();
    }

    if (typeof error === 'object' && error && 'message' in error) {
        return String((error as { message?: unknown }).message ?? '').toLowerCase();
    }

    return '';
}

function isBackgroundLocationManifestError(error: unknown) {
    const message = getLocationErrorMessage(error);
    return (
        (
            message.includes('background location') ||
            message.includes('access_background_location')
        ) &&
        (
            message.includes('need to add') ||
            message.includes('androidmanifest') ||
            message.includes('rejected')
        )
    );
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

interface ForegroundPermissionRequestResult {
    granted: boolean;
    requiresSettings: boolean;
}

function isRecentLocation(location: Location.LocationObject | null | undefined) {
    if (!location) {
        return false;
    }

    return Date.now() - location.timestamp <= RECENT_LOCATION_MAX_AGE_MS;
}

export function useGeofence() {
    const { user } = useAuth();
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const [remindersEnabled, setRemindersEnabled] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const locationRef = useRef<Location.LocationObject | null>(null);
    const foregroundLocationRequestRef = useRef<Promise<ForegroundLocationRequestResult> | null>(null);
    const isMountedRef = useRef(true);
    const backgroundRefreshRequestIdRef = useRef(0);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            backgroundRefreshRequestIdRef.current += 1;
        };
    }, []);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    const commitLocation = useCallback((nextLocation: Location.LocationObject | null) => {
        if (!nextLocation) {
            return null;
        }

        locationRef.current = nextLocation;
        setLocation(nextLocation);
        return nextLocation;
    }, []);

    const refreshPermissions = useCallback(async () => {
        if (!arePlaceRemindersEnabled()) {
            setHasLocationPermission(false);
            setRemindersEnabled(false);
            return {
                foregroundGranted: false,
                remindersEnabled: false,
            };
        }

        const permissionState = await getReminderPermissionState();
        setHasLocationPermission(permissionState.foregroundGranted);
        setRemindersEnabled(permissionState.remindersEnabled);
        return permissionState;
    }, []);

    const resolveCurrentPosition = useCallback(async (): Promise<Location.LocationObject | null> => {
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
            return null;
        }

        return currentLocation;
    }, []);

    const refreshLocation = useCallback(async (
        options: { preferCached?: boolean; backgroundRefreshIfCached?: boolean } = {}
    ): Promise<ForegroundLocationRequestResult> => {
        const { preferCached = true, backgroundRefreshIfCached = false } = options;
        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                return {
                    location: null,
                    requiresSettings: true,
                    reason: 'services_disabled',
                };
            }

            const cachedLocation = locationRef.current;
            if (preferCached && isRecentLocation(cachedLocation)) {
                return {
                    location: cachedLocation,
                    requiresSettings: false,
                    reason: null,
                };
            }

            const known = await Location.getLastKnownPositionAsync();
            if (known) {
                commitLocation(known);
                if (preferCached) {
                    if (backgroundRefreshIfCached) {
                        const backgroundRefreshRequestId = ++backgroundRefreshRequestIdRef.current;
                        void resolveCurrentPosition()
                            .then((currentLocation) => {
                                if (
                                    currentLocation &&
                                    isMountedRef.current &&
                                    backgroundRefreshRequestId === backgroundRefreshRequestIdRef.current
                                ) {
                                    commitLocation(currentLocation);
                                }
                            })
                            .catch(() => undefined);
                    }
                    return {
                        location: known,
                        requiresSettings: false,
                        reason: null,
                    };
                }
            }

            const currentLocation = await resolveCurrentPosition();

            if (!currentLocation) {
                return {
                    location: known ?? cachedLocation ?? null,
                    requiresSettings: false,
                    reason: known || cachedLocation ? null : 'timeout',
                };
            }

            if (currentLocation) {
                commitLocation(currentLocation);
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
    }, [commitLocation, resolveCurrentPosition]);

    useEffect(() => {
        let cancelled = false;
        const idleHandle = scheduleOnIdle(() => {
            void (async () => {
                if (!arePlaceRemindersEnabled()) {
                    if (!cancelled) {
                        setHasLocationPermission(false);
                        setRemindersEnabled(false);
                    }
                    return;
                }

                const foregroundStatus = await Location.getForegroundPermissionsAsync();
                if (cancelled) {
                    return;
                }

                const foregroundGranted = foregroundStatus.status === 'granted';
                setHasLocationPermission(foregroundGranted);
                await refreshPermissions();
                if (foregroundGranted) {
                    void refreshLocation({
                        preferCached: true,
                        backgroundRefreshIfCached: true,
                    }).catch(() => undefined);
                }
            })();
        });

        return () => {
            cancelled = true;
            idleHandle.cancel();
        };
    }, [refreshLocation, refreshPermissions]);

    const requestForegroundPermission = useCallback(async (): Promise<ForegroundPermissionRequestResult> => {
        if (!arePlaceRemindersEnabled()) {
            setHasLocationPermission(false);
            setRemindersEnabled(false);
            return {
                granted: false,
                requiresSettings: false,
            };
        }

        let foregroundStatus = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus.status !== 'granted') {
            foregroundStatus = await Location.requestForegroundPermissionsAsync();
        }

        const granted = foregroundStatus.status === 'granted';
        setHasLocationPermission(granted);

        if (!granted) {
            return {
                granted: false,
                requiresSettings: foregroundStatus.canAskAgain === false,
            };
        }

        return {
            granted: true,
            requiresSettings: false,
        };
    }, []);

    const requestForegroundLocation = useCallback(async (): Promise<ForegroundLocationRequestResult> => {
        if (foregroundLocationRequestRef.current) {
            return foregroundLocationRequestRef.current;
        }

        const requestPromise: Promise<ForegroundLocationRequestResult> = (async () => {
            const foregroundPermission = await requestForegroundPermission();
            if (!foregroundPermission.granted) {
                return {
                    location: null,
                    requiresSettings: foregroundPermission.requiresSettings,
                    reason: 'permission_denied',
                };
            }

            return refreshLocation({
                preferCached: true,
                backgroundRefreshIfCached: true,
            });
        })();

        foregroundLocationRequestRef.current = requestPromise;

        try {
            return await requestPromise;
        } finally {
            if (foregroundLocationRequestRef.current === requestPromise) {
                foregroundLocationRequestRef.current = null;
            }
        }
    }, [refreshLocation, requestForegroundPermission]);

    const requestReminderPermissions = useCallback(async (): Promise<ReminderPermissionRequestResult> => {
        if (!arePlaceRemindersEnabled()) {
            setRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: false,
            };
        }

        const foregroundPermission = await requestForegroundPermission();
        if (!foregroundPermission.granted) {
            setRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: foregroundPermission.requiresSettings,
            };
        }

        let backgroundStatus: Awaited<ReturnType<typeof Location.getBackgroundPermissionsAsync>>;
        try {
            backgroundStatus = await Location.getBackgroundPermissionsAsync();
        } catch (error) {
            if (isBackgroundLocationManifestError(error)) {
                setRemindersEnabled(false);
                return {
                    enabled: false,
                    requiresSettings: false,
                };
            }

            throw error;
        }
        if (backgroundStatus.status !== 'granted') {
            try {
                backgroundStatus = await Location.requestBackgroundPermissionsAsync();
            } catch (error) {
                if (isBackgroundLocationManifestError(error)) {
                    setRemindersEnabled(false);
                    return {
                        enabled: false,
                        requiresSettings: false,
                    };
                }

                throw error;
            }
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
            void refreshLocation({
                preferCached: true,
                backgroundRefreshIfCached: true,
            }).catch(() => undefined);
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
    }, [refreshLocation, requestForegroundPermission, user]);

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
