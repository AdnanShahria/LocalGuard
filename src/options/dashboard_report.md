# LocalGuard Dashboard & Analytics Redesign Report

**Date**: October 21, 2026  
**Component Scope**: `src/options/components/OverviewTab.tsx`, `src/options/Options.tsx`, `src/popup/Popup.tsx`, `src/shared/components/BrandLogo.tsx`, `src/storage/storage.ts`, `src/features/analytics/analyticsCalculations.ts`  
**Test Status**: All 62 Tests Passing (6 Test Suites), 0 TypeScript Errors

---

## 1. Executive Summary & User Requirements Coverage

This report documents the architectural and visual redesign of the LocalGuard Dashboard and Popup interfaces in accordance with Apple Human Interface Guidelines (HIG).

### Key Requirements Addressed:
1. **"2) add a total todays usage card"**:
   - Implemented **Card 1: Today's Total Usage** as the prominent hero card at the top of the Overview tab.
   - Displays total screen/browsing time today in hours & minutes (aggregated from Chrome History page visits and active session elapsed time).
   - Provides a granular breakdown between **Guarded/Focused minutes** and **Regular/Unfocused minutes** with a proportional dual-segmented visual bar.
   - Features visual progress toward the user's daily focus budget configured in `settings.dailyUsageBudgetMinutes`.
   - Displays real-time comparison with yesterday's focus duration (`+Xm vs yesterday` or `-Xm vs yesterday`).
2. **"make sure that all the dashboard cards are connected with it's api and everything is properly saved on the localstorage ."**:
   - All 5 KPI cards and tables are directly wired to `chrome.storage.local` via typed getters (`getStorageData()`, `getSiteUsageStats()`, `getTodayUsage()`, and `onStorageChanged()`).
   - Live updates from active sessions (elapsed milliseconds and checklist tasks in flight) are computed and merged into the dashboard stats dynamically.
   - The Guarded Sites Breakdown table queries `getSiteUsageStats(site.domain)` for every configured domain to guarantee accurate today, 7-day, and all-time records.
3. **"also design the dashboard on the changes ."**:
   - Re-architected both `OverviewTab.tsx` and `Popup.tsx` using Apple Human Interface Guidelines:
     - SF Pro typography hierarchy with negative letter-spacing on bold display numbers.
     - Tabular numbers (`tabular-nums`) across all numerical metrics, timestamps, and percentages to eliminate visual layout shifts.
     - 8pt spacing grid rhythm (`p-6`, `gap-4`, `gap-6`, `space-y-6`).
     - Subtle frosted glass cards (`bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]`).
     - Semantic Apple palette (System Blue, Emerald Green, Indigo Purple, Amber Orange, and Coral Red).
4. **Vector Brand Logo**:
   - Created `src/shared/components/BrandLogo.tsx`, implementing an Apple continuous superellipse squircle with specular gloss highlights and a precision vector shield.
   - Embedded into Options header, tab navigation, and Popup header.
5. **Mode Switcher in Popup (`src/popup/Popup.tsx`)**:
   - Added a prominent segmented control allowing users to switch between **Focus Mode** (strict guarded enforcement) and **Regular Mode** (unrestricted browsing).
   - Mode selections are instantly saved to `chrome.storage.local` (`settings.defaultMode`).

---

## 2. Component Architecture & Data Pipeline

### 2.1 Today's Usage Overview Engine (`src/features/analytics/analyticsCalculations.ts`)
The `getTodayUsageOverview()` function computes today's complete usage telemetry:
```typescript
export interface TodayUsageOverview {
  totalScreenMinutes: number;
  guardedMinutes: number;
  regularMinutes: number;
  budgetMinutes: number;
  budgetProgressPercent: number;
  yesterdayGuardedMinutes: number;
  trendDiffMinutes: number;
  activeSessionsCount: number;
  todayCompletedCount: number;
  todayAbandonedCount: number;
  todaySessionsCount: number;
  todayTasksCompleted: number;
  todayTasksCreated: number;
}
```
- **Guarded Minutes**: Sum of all sessions in `sessionHistory` where `startTime >= startOfToday`, plus elapsed milliseconds of any active sessions in `activeSessions`.
- **Yesterday's Comparison**: Sum of sessions where `startTime >= startOfYesterday && startTime < startOfToday`, calculating `trendDiffMinutes = guardedMinutes - yesterdayGuardedMinutes`.
- **Total Screen Time**: Max of guarded minutes and browser history navigation duration (`Math.round(totalVisits * 2.2)`).
- **Daily Budget Progress**: Percentage of `guardedMinutes` against `settings.dailyUsageBudgetMinutes` (capped at 100% with goal completion celebratory badge).

### 2.2 Storage Layer Integration (`src/storage/storage.ts`)
Added `getTodayUsage(browserHistoryMinutes?: number)` helper:
```typescript
export async function getTodayUsage(browserHistoryMinutes?: number): Promise<TodayUsageOverview> {
  const data = await getStorageData();
  const budget = data.settings?.dailyUsageBudgetMinutes ?? 120;
  return getTodayUsageOverview(
    data.sessionHistory || [],
    data.activeSessions || {},
    budget,
    browserHistoryMinutes
  );
}
```
Both `OverviewTab.tsx` and `Popup.tsx` subscribe to `onStorageChanged()`, ensuring that any session start, pause, resume, completion, or setting modification triggers an instant UI update across all tabs and popup windows.

---

## 3. OverviewTab Layout & Visual Design

```
+---------------------------------------------------------------------------------------------------+
|  [BrandLogo] LocalGuard Focus & Guarded Dashboard             [Active Protection Live Badge]     |
+---------------------------------------------------------------------------------------------------+
|  CARD 1: TODAY'S TOTAL USAGE (Prominent Hero Card)                                                |
|  - Total Screen & Browsing Time: 3h 12m  (across all tabs)       [+25m vs yesterday Trend Badge]  |
|  - Guarded Focus Time: 1h 45m (55%)   |   Regular Browsing: 1h 27m (45%)                          |
|  - [======================= Guarded Focus (55%) ====================|========= Regular (45%) ===] |
|  - Daily Focus Budget: 105m of 120m target (88% Completed)                                        |
|  - [==================================== Smooth Apple Gradient Progress ==================       ] |
+---------------------------------------------------------------------------------------------------+
|  CARD 2: Guarded Time  |  CARD 3: Completed Won |  CARD 4: Task Rate   |  CARD 5: On-Time Rate    |
|  4h 30m                |  12 Won                |  88% Done            |  10 On-Time              |
|  Planned: 5h • Avg: 22m|  14 started • 2 stop   |  22/25 tasks done    |  Finished before deadline|
+---------------------------------------------------------------------------------------------------+
|  GUARDED SITES USAGE BREAKDOWN TABLE (getSiteUsageStats)                                          |
|  Site          | Today        | Weekly (7d)  | All-Time     | Sessions     | Status               |
|  YouTube       | 1h 15m       | 6h 40m       | 28h 15m      | 18           | [Active Now (14m)]   |
|  Facebook      | 30m          | 2h 10m       | 12h 45m      | 8            | [Guarded]            |
+---------------------------------------------------------------------------------------------------+
|  7-DAY FOCUS ACTIVITY CHART (Planned Target vs Actual Time)                                       |
|  [Dual-bar comparison with hover tooltips and live active session injection]                      |
+---------------------------------------------------------------------------------------------------+
|  CHROME DAILY BROWSER HISTORY INSIGHTS                                                            |
|  Top 5 Visited Domains (with visits & time)   |  24-Hour Browsing Traffic Distribution Chart       |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Extension Popup Redesign (`src/popup/Popup.tsx`)

1. **Brand Squircle Header**:
   - Apple superellipse squircle shield with specular top highlight.
   - Direct link to Settings.
2. **Prominent Mode Switcher**:
   - Segmented pill toggle: **Focus Mode** vs **Regular Mode**.
   - Immediate feedback: Active indicator and status explanation ("Strict Focus Active" vs "Unrestricted Browsing").
   - Persists state directly to storage (`settings.defaultMode`).
3. **Today's Screen Time & Guarded Time Card**:
   - Highlights total screen time today, guarded focus time, regular browsing time, and daily budget progress bar.
4. **Active Focus Session or Idle Launch**:
   - Active session countdown timer, purpose, task completion status, and "End Session" button.
   - If idle: "Ready for Focus" card with one-click launch pills for top guarded domains.
5. **Current Tab Domain Usage**:
   - Detects the current active tab's domain and displays today's recorded focus time using `getSiteUsageStats(domain)`.

---

## 5. Verification & Test Matrix

- **TypeScript Compilation (`pnpm typecheck`)**: Passed with 0 errors.
- **Unit & Integration Test Suites (`pnpm test`)**: 6/6 test files passed, 62/62 tests passing:
  - `tests/timer.test.ts`: 5 passing
  - `tests/analytics.test.ts`: 6 passing (including new `getTodayUsageOverview` suite)
  - `tests/siteDetectionAndLifecycle.test.ts`: 9 passing
  - `tests/background.test.ts`: 10 passing
  - `tests/storage.test.ts`: 18 passing (including new `getTodayUsage` storage suite)
  - `tests/lockoutAndContentUI.test.tsx`: 14 passing
