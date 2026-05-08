import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, Platform } from 'react-native';
import { useAuth } from './useAuth';
import {
    arePlaceRemindersEnabled,
    getReminderPermissionState,
    syncGeofenceRegions,
} from '../services/geofenceService';
import { syncSocialPushRegistration } from '../services/socialPushService';
import { scheduleOnIdle } from '../utils/scheduleOnIdle';

const LOCATION_FIX_TIMEOUT_MS = 8000;
const FOREGROUND_LOCATION_REQUEST_TIMEOUT_MS = LOCATION_FIX_TIMEOUT_MS + 4000;
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
    reason:
        | 'feature_disabled'
        | 'foreground_denied'
        | 'background_denied'
        | 'notifications_denied'
        | 'geofence_unavailable'
        | 'unavailable'
        | null;
}

interface ForegroundPermissionRequestResult {
    granted: boolean;
    requiresSettings: boolean;
}

function getForegroundLocationFailureFromError(error: unknown): ForegroundLocationRequestResult {
    const errorMessage = getLocationErrorMessage(error);
    const servicesDisabled =
        errorMessage.includes('location services are disabled') ||
        errorMessage.includes('provider is unavailable');
    const permissionDenied =
        errorMessage.includes('permission') &&
        (
            errorMessage.includes('denied') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('not authorized')
        );

    return {
        location: null,
        requiresSettings: servicesDisabled,
        reason: servicesDisabled
            ? 'services_disabled'
            : permissionDenied
                ? 'permission_denied'
                : 'unavailable',
    };
}

function isRecentLocation(location: Location.LocationObject | null | undefined) {
    if (!location) {
        return false;
    }

    return Date.now() - location.timestamp <= RECENT_LOCATION_MAX_AGE_MS;
}

function withForegroundLocationRequestTimeout(
    promise: Promise<ForegroundLocationRequestResult>,
    timeoutMs: number
): Promise<ForegroundLocationRequestResult> {
    return new Promise<ForegroundLocationRequestResult>((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) {
                return;
            }

            settled = true;
            resolve({
                location: null,
                requiresSettings: false,
                reason: 'timeout',
            });
        }, timeoutMs);

        promise
            .then((result) => {
                if (settled) {
                    return;
                }

                settled = true;
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error) => {
                if (settled) {
                    return;
                }

                settled = true;
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

export function useGeofence() {
    const { user } = useAuth();
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const [remindersEnabled, setRemindersEnabled] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const hasLocationPermissionRef = useRef(false);
    const remindersEnabledRef = useRef(false);
    const locationRef = useRef<Location.LocationObject | null>(null);
    const foregroundLocationRequestRef = useRef<Promise<ForegroundLocationRequestResult> | null>(null);
    const reminderPermissionRequestRef = useRef<Promise<ReminderPermissionRequestResult> | null>(null);
    const isMountedRef = useRef(true);
    const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);
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

    const clearLocation = useCallback(() => {
        if (!locationRef.current) {
            return;
        }

        locationRef.current = null;
        setLocation(null);
    }, []);

    const commitHasLocationPermission = useCallback((granted: boolean) => {
        if (hasLocationPermissionRef.current === granted) {
            return;
        }

        hasLocationPermissionRef.current = granted;
        setHasLocationPermission(granted);
    }, []);

    const commitRemindersEnabled = useCallback((enabled: boolean) => {
        if (remindersEnabledRef.current === enabled) {
            return;
        }

        remindersEnabledRef.current = enabled;
        setRemindersEnabled(enabled);
    }, []);

    const refreshPermissions = useCallback(async () => {
        if (!arePlaceRemindersEnabled()) {
            commitHasLocationPermission(false);
            commitRemindersEnabled(false);
            clearLocation();
            return {
                foregroundGranted: false,
                remindersEnabled: false,
            };
        }

        const permissionState = await getReminderPermissionState();
        commitHasLocationPermission(permissionState.foregroundGranted);
        commitRemindersEnabled(permissionState.remindersEnabled);
        if (!permissionState.foregroundGranted) {
            clearLocation();
        }
        return permissionState;
    }, [clearLocation, commitHasLocationPermission, commitRemindersEnabled]);

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
                clearLocation();
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
            const failure = getForegroundLocationFailureFromError(error);
            if (failure.reason === 'permission_denied' || failure.reason === 'services_disabled') {
                clearLocation();
            }
            return failure;
        }
    }, [clearLocation, commitLocation, resolveCurrentPosition]);

    useEffect(() => {
        let cancelled = false;
        const idleHandle = scheduleOnIdle(() => {
            void (async () => {
                const permissionState = await refreshPermissions();
                if (cancelled) {
                    return;
                }

                if (permissionState.foregroundGranted) {
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

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = previousAppStateRef.current;
            previousAppStateRef.current = nextState;

            if (nextState !== 'active' || previousState === 'active') {
                return;
            }

            void refreshPermissions()
                .then((permissionState) => {
                    if (!permissionState.foregroundGranted) {
                        return;
                    }

                    return refreshLocation({
                        preferCached: false,
                        backgroundRefreshIfCached: false,
                    });
                })
                .catch(() => undefined);
        });

        return () => {
            subscription.remove();
        };
    }, [refreshLocation, refreshPermissions]);

    const requestForegroundPermission = useCallback(async (): Promise<ForegroundPermissionRequestResult> => {
        if (!arePlaceRemindersEnabled()) {
            commitHasLocationPermission(false);
            commitRemindersEnabled(false);
            return {
                granted: false,
                requiresSettings: false,
            };
        }

        let foregroundStatus = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus.status !== 'granted' && foregroundStatus.canAskAgain !== false) {
            foregroundStatus = await Location.requestForegroundPermissionsAsync();
        }

        const granted = foregroundStatus.status === 'granted';
        commitHasLocationPermission(granted);

        if (!granted) {
            clearLocation();
            return {
                granted: false,
                requiresSettings: foregroundStatus.canAskAgain === false,
            };
        }

        return {
            granted: true,
            requiresSettings: false,
        };
    }, [clearLocation, commitHasLocationPermission, commitRemindersEnabled]);

    const requestBackgroundPermission = useCallback(async () => {
        let backgroundStatus: Awaited<ReturnType<typeof Location.getBackgroundPermissionsAsync>>;
        try {
            backgroundStatus = await Location.getBackgroundPermissionsAsync();
        } catch (error) {
            if (isBackgroundLocationManifestError(error)) {
                return null;
            }

            throw error;
        }

        if (backgroundStatus.status === 'granted' || backgroundStatus.canAskAgain === false) {
            return backgroundStatus;
        }

        try {
            return await Location.requestBackgroundPermissionsAsync();
        } catch (error) {
            if (isBackgroundLocationManifestError(error)) {
                return null;
            }

            throw error;
        }
    }, []);

    const requestNotificationPermission = useCallback(async () => {
        let notificationStatus = await Notifications.getPermissionsAsync();
        if (notificationStatus.status !== 'granted' && notificationStatus.canAskAgain !== false) {
            notificationStatus = await Notifications.requestPermissionsAsync();
        }

        return notificationStatus;
    }, []);

    const requestForegroundLocation = useCallback(async (): Promise<ForegroundLocationRequestResult> => {
        if (foregroundLocationRequestRef.current) {
            return foregroundLocationRequestRef.current;
        }

        const requestPromise = withForegroundLocationRequestTimeout(
            (async () => {
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
            })(),
            FOREGROUND_LOCATION_REQUEST_TIMEOUT_MS
        );

        foregroundLocationRequestRef.current = requestPromise;

        try {
            return await requestPromise;
        } catch (error) {
            return getForegroundLocationFailureFromError(error);
        } finally {
            if (foregroundLocationRequestRef.current === requestPromise) {
                foregroundLocationRequestRef.current = null;
            }
        }
    }, [refreshLocation, requestForegroundPermission]);

    const requestReminderPermissions = useCallback(async (): Promise<ReminderPermissionRequestResult> => {
        if (reminderPermissionRequestRef.current) {
            return reminderPermissionRequestRef.current;
        }

        const requestPromise = (async (): Promise<ReminderPermissionRequestResult> => {
        if (!arePlaceRemindersEnabled()) {
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: false,
                reason: 'feature_disabled',
            };
        }

        let foregroundPermission: ForegroundPermissionRequestResult;
        try {
            foregroundPermission = await requestForegroundPermission();
        } catch (error) {
            console.warn('[geofence] Foreground reminder permission request failed:', error);
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: false,
                reason: 'unavailable',
            };
        }

        if (!foregroundPermission.granted) {
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: foregroundPermission.requiresSettings,
                reason: 'foreground_denied',
            };
        }

        let backgroundStatus: Awaited<ReturnType<typeof Location.getBackgroundPermissionsAsync>> | null;
        try {
            backgroundStatus = await requestBackgroundPermission();
        } catch (error) {
            console.warn('[geofence] Background reminder permission request failed:', error);
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: false,
                reason: 'unavailable',
            };
        }

        if (backgroundStatus?.status !== 'granted') {
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: backgroundStatus
                    ? backgroundStatus.canAskAgain === false || Platform.OS === 'android'
                    : false,
                reason: 'background_denied',
            };
        }

        let notificationStatus: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
        try {
            notificationStatus = await requestNotificationPermission();
        } catch (error) {
            console.warn('[geofence] Reminder notification permission request failed:', error);
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: false,
                reason: 'unavailable',
            };
        }

        if (notificationStatus.status !== 'granted') {
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: notificationStatus.canAskAgain === false,
                reason: 'notifications_denied',
            };
        }

        let enabled = false;
        try {
            enabled = await syncGeofenceRegions();
        } catch (error) {
            console.warn('[geofence] Reminder geofence registration failed:', error);
            commitRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: false,
                reason: 'geofence_unavailable',
            };
        }

        commitRemindersEnabled(enabled);
        if (enabled) {
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

        return {
            enabled,
            requiresSettings: false,
            reason: enabled ? null : 'geofence_unavailable',
        };
        })();

        reminderPermissionRequestRef.current = requestPromise;

        try {
            return await requestPromise;
        } finally {
            if (reminderPermissionRequestRef.current === requestPromise) {
                reminderPermissionRequestRef.current = null;
            }
        }
    }, [
        commitRemindersEnabled,
        refreshLocation,
        requestBackgroundPermission,
        requestForegroundPermission,
        requestNotificationPermission,
        user,
    ]);

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
