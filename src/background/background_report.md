# Service Worker Architecture & Dual-Mode Tab Departure Interceptor Report

## Executive Summary
The background service worker (`src/background/index.ts`) has been successfully updated to Chrome Extension Manifest V3 standards, implementing the dual-mode tab departure interceptor, authorized away timer ticker, action badge synchronization, and strict screen lockout broadcasting.

---

## Key Implementations

### 1. Dual-Mode Tab Departure Interceptor (`chrome.tabs.onActivated`)
- **Event Listener**: Registered `chrome.tabs.onActivated.addListener`.
- **Mode Inspection**: Retrieves current session data via `getStorageData()`. Checks if an active session exists in `mode === 'focus'` (or adhering to `settings.defaultMode === 'focus'`).
- **Focus Tab Resolution**: Dynamically resolves the origin focus tab ID via direct `session.tabId`, cached in-memory `lastFocusTabId`, or URL matching via `chrome.tabs.query`.
- **Authorization Check**: Reads `data.awayState`. If `awayState?.isAway` is `true`, departures are authorized and navigation proceeds unimpeded.
- **Interception & Switch-Back**: If in Focus Mode and not authorized away:
  - Instantly reverts focus: `chrome.tabs.update(focusTabId, { active: true })`.
  - Dispatches message to the focus tab:
    ```typescript
    chrome.tabs.sendMessage(focusTabId, {
      type: 'PROMPT_TAB_DEPARTURE',
      destinationTabId: activeInfo.tabId,
    });
    ```
- **Regular Mode Exemption**: Sessions designated with `mode === 'regular'` allow natural tab switching without interruption.

### 2. Runtime Message Dispatch Handlers
- **`START_AWAY_SESSION`**:
  - Persists `awayState` using `saveAwayState()`.
  - Switches active tab to `destinationTabId`: `chrome.tabs.update(destinationTabId, { active: true })`.
  - Initializes the countdown ticker: `startCountdownTicker()`.
  - Immediately synchronizes the action badge in amber (`#f59e0b`).
  - Returns `{ success: true, awayState }`.
- **`EXTEND_AWAY_SESSION`**:
  - Extends `deadlineTime` and `allocatedDurationMs` of `awayState`.
  - Resets `warnedOneMinuteLeft = false` to enable future warnings.
  - Persists state with `saveAwayState()` and refreshes badge.
- **`FINISH_AWAY_SESSION`**:
  - Clears `awayState` using `saveAwayState(null)`.
  - If `returnToOrigin === true`, switches active tab back to `originTabId`: `chrome.tabs.update(originTabId, { active: true })`.
  - Refreshes action badge.
- **`TRIGGER_SCREEN_LOCKOUT`**:
  - Persists lockout state using `saveLockoutState(siteId, lockoutState)`.
  - Broadcasts `SCREEN_LOCKOUT_TRIGGERED` to the target tab and active tab.

### 3. Periodic Away Ticker & Dynamic Badge Reflection
- **Ticker Mechanics**: Runs every 1,000ms via `setInterval` and backed by `chrome.alarms` (`periodInMinutes: 1`) to ensure MV3 lifecycle resilience when the service worker is awoken.
- **Remaining Time Computation**: Computes `remainingMs = awayState.deadlineTime - Date.now()`.
- **Amber Action Badge**: Displays remaining minutes (e.g. `3m` or `1m`) in amber `#f59e0b`. When expired (`remainingMs <= 0`), shows `0m` in red `#ef4444`.
- **1-Minute Warning Notification**:
  - When `remainingMs <= 60000ms` and `!awayState.warnedOneMinuteLeft`:
    - Persists `warnedOneMinuteLeft = true` via `saveAwayState()`.
    - Broadcasts `{ type: 'AWAY_ONE_MINUTE_LEFT', remainingMs, awayState }` to the active tab.
- **Expiration Notification**:
  - When `remainingMs <= 0ms`:
    - Broadcasts `{ type: 'AWAY_EXPIRED', awayState }` to the active tab.

### 4. Storage Integrity
All session and away states strictly use the typed storage accessors:
- `saveAwayState(awayState)`
- `saveStorageData(data)`
- `saveLockoutState(siteId, lockoutState)`
This ensures defensive synchronization to `chrome.storage.local` across all tabs and contexts.

---

## Verification & Test Results

1. **TypeScript Typecheck**:
   ```powershell
   pnpm typecheck
   ```
   **Verdict**: Passed with exit code 0 (zero errors).

2. **Automated Unit Tests**:
   - Added unit test suite `tests/background.test.ts` covering:
     - Tab departure interception under Focus Mode vs Regular Mode.
     - Authorized away bypass behavior.
     - `START_AWAY_SESSION`, `EXTEND_AWAY_SESSION`, and `FINISH_AWAY_SESSION` flows.
     - `TRIGGER_SCREEN_LOCKOUT` storage and broadcast.
     - Periodic ticker 1-minute warning and expiration events.
   ```powershell
   pnpm test
   ```
   **Verdict**: All 5 test suites passed (48 tests in total).

3. **Extension Production Build**:
   ```powershell
   pnpm build
   ```
   **Verdict**: Build successful (`✓ built in 6.64s`). Output generated in `dist/`.
