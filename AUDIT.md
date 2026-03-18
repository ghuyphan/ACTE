# Codebase Audit: Security, Performance, and Best Practices

This document outlines identified issues in the codebase related to security, performance, and general engineering best practices.

## 🛡️ Security Issues

### 1. Hardcoded Identifiers and Configuration
*   **File:** `widgets/ios/LocketWidget.swift`
    *   **Issue:** Hardcoded App Group identifier `ExpoWidgetsAppGroupIdentifier` is accessed via `Bundle.main.object(forInfoDictionaryKey:)`. While technically a config lookup, many related keys in the project are hardcoded in source rather than environment variables.
    *   **Risk:** Makes the codebase less portable and exposes environment-specific configuration in version control.

### 2. Over-provisioned Firestore Rules
*   **File:** `firestore.rules`
    *   **Issue:** The `sharedPosts` collection allows any signed-in user to `create` a post as long as they set themselves as the `authorUid`. There is no validation that the `audienceUserIds` (which grants read access to others) is limited to actual friends or valid users.
    *   **Risk:** Potential for "spam" or "ghost" posts where a malicious user could inject data into another user's feed if they know their `uid`.
    *   **Issue:** `isRoomMember` and `isRoomOwner` helpers rely on `exists()` and `get()` which consume extra document reads per request.

### 3. Insecure Randomness (Partially Resolved)
*   **File:** `services/database.ts`
    *   **Observation:** The `generateId` function was recently updated to use `Crypto.randomUUID()`. However, older versions of the database or other parts of the app might still rely on less secure methods if not audited.

### 4. Data Exposure in Sync
*   **File:** `services/syncService.ts`
    *   **Issue:** Sensitive data (like Base64 encoded photos) is stored in the local SQLite `sync_queue` table and then sent to Firestore. 
    *   **Risk:** If the device is compromised, the `sync_queue` contains full unencrypted payloads of deleted or pending notes.

---

## 🚀 Performance Concerns

### 1. Widespread Re-renders (Context Optimization)
*   **File:** `hooks/useNotesStore.tsx`
    *   **Issue:** `NotesProvider` provides a single large object containing both state (`notes`, `loading`) and many stable function references (`createNote`, `deleteNote`). 
    *   **Impact:** Any time a single note is added or updated, the `notes` array reference changes, causing *every* component consuming `useNotesStore` to re-render, even if they only use a stable action like `deleteNote`.
    *   **Recommendation:** Split the context into `NotesStateContext` and `NotesActionsContext`.

### 2. Blocking Sync Operations
*   **File:** `services/syncService.ts`
    *   **Issue:** `serializeNoteForFirebase` reads photos from disk and converts them to Base64 strings *during* the sync process. For users with many photos, this can lead to high memory usage and UI lag if triggered on the main thread.
    *   **Issue:** `syncNotesToFirebase` performs a full snapshot upload (`uploadLocalSnapshotToFirebase`) and a full remote merge every time it runs.
    *   **Impact:** O(N) complexity where N is the total number of notes. As a user's library grows, sync will become exponentially slower and more expensive.

### 3. Lack of Database Pagination
*   **File:** `services/database.ts`
    *   **Issue:** `getAllNotes()` fetches the entire `notes` table into memory.
    *   **Impact:** Inefficient for users with hundreds or thousands of notes. It increases memory pressure and slows down app startup/refresh.

### 4. Heavy Computation in `useEffect`
*   **File:** `hooks/useNotesStore.tsx`
    *   **Issue:** `cleanupOrphanPhotoFiles()` is called in a `useEffect` on every mount (with a small timeout).
    *   **Impact:** This involves disk I/O and database checks. Running this too frequently can impact battery life and disk performance.

---

## 🛠️ Non-Best Practices

### 1. Mixed Concerns in Hooks
*   **File:** `hooks/useNotesStore.tsx`
    *   **Issue:** The hook contains business logic (syncing geofences, recording sync changes, updating widgets) mixed with state management.
    *   **Recommendation:** Move side-effects into a dedicated "Coordinator" or "Middleware" layer.

### 2. Manual SQLite Migrations
*   **File:** `services/database.ts`
    *   **Issue:** Migrations are handled via manual `PRAGMA user_version` checks and `ALTER TABLE` statements inside `getDB`.
    *   **Risk:** Error-prone and difficult to test. As the schema grows, this block will become unmaintainable.
    *   **Recommendation:** Use a dedicated migration library or a more structured migration runner.

### 3. Inconsistent Error Handling
*   **Observation:** Some services log errors to `console.warn` (e.g., `syncService.ts`), while others return structured error objects (e.g., `useAuth.tsx`).
    *   **Impact:** Makes it difficult for the UI to provide consistent feedback to the user.

### 4. Large Base64 Payloads in Firestore
*   **Issue:** Storing photos as Base64 strings directly in Firestore documents.
    *   **Impact:** Firestore has a 1MB limit per document. High-resolution photos will easily exceed this, causing sync to fail.
    *   **Recommendation:** Use Firebase Storage for files and store only the URL in Firestore.

### 5. String-based ISO Timestamps for Ordering
*   **File:** `services/database.ts`
    *   **Issue:** Relying on ISO string comparisons in SQLite for ordering and sync logic.
    *   **Impact:** While generally safe for ISO-8601, it is less efficient than integer timestamps and can lead to bugs if different locales or formats are accidentally introduced.
