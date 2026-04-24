# Widget Background Refresh

Noto updates the widget from three sources:

- App lifecycle refreshes from `useAppWidgetRefresh`.
- Shared-post background pushes handled by `BACKGROUND_SOCIAL_PUSH_NOTIFICATION_TASK`.
- Place-reminder geofence enters handled by `BACKGROUND_GEOFENCE_TASK`.

## Shared Posts

Shared-post pushes are a data-first wake-up path. The Supabase edge function sends shared-post notifications as headless/data payloads with the visible notification copy inside `data.notificationTitle` and `data.notificationBody`. On iOS the payload also includes `_contentAvailable: true`.

When the background task receives a shared-post push, it:

1. Loads the current Supabase user from the persisted session.
2. Refreshes the shared feed from Supabase, falling back to the cached shared feed if the network refresh fails.
3. Verifies the pushed `sharedPostId` is a friend-authored post visible to the current user.
4. Calls `updateWidgetData` with the freshly fetched shared posts and the pushed `preferredNoteId`.
5. Schedules the local visible notification after the refresh path succeeds.

This means the notification and widget update are tied to the same local data refresh. Delivery is still best effort: OS background push throttling, missing notification permission, missing push registration, expired auth, network failure, Android Doze, and user force-quitting can all prevent or delay the task.

Required native configuration:

- `expo-notifications` must be configured with `enableBackgroundRemoteNotifications: true`.
- The final iOS build must include `remote-notification` in `UIBackgroundModes`.
- Shared-post pushes must remain data-only; do not add top-level `title` or `body` for the shared-post path.

## Location

Location-based widget refresh is geofence-based, not continuous tracking. When place reminders are enabled, the app registers monitored regions for saved note places through `syncGeofenceRegions`. On a geofence enter, the background task refreshes the widget with the triggered note/place even if the notification itself is suppressed by cooldown.

Expected limits:

- iOS monitors up to 20 regions.
- Android monitors up to 100 regions.
- Android generally will not restart a terminated app for location/geofence events.
- iOS can relaunch for geofence events, but delivery is still system-controlled.
- Continuous background location is intentionally not enabled.

When changing note location or radius behavior, keep the note mutation paths wired to `syncGeofenceRegions` so the registered regions stay current.
