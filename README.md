# LifeSolver Focus Guard

> **Intentional, purposeful browsing for Facebook and YouTube.**  
> A browser-only, privacy-first Chrome Extension (Manifest V3) engineered with TypeScript, React 18, Tailwind CSS, and Lucide icons.

---

## 1. Product Philosophy

The internet's largest video and social platforms are built around infinite feeds and algorithmic rabbit holes. **LifeSolver Focus Guard** introduces a gentle, immovable pause button whenever you open Facebook or YouTube, enforcing one simple habit:

$$\text{Purpose} \longrightarrow \text{Time Limit} \longrightarrow \text{Focused Session} \longrightarrow \text{Review}$$

When you open Facebook or YouTube:
1. **Purpose Modal**: Focus Guard asks why you opened the site, what tasks you intend to accomplish, and how much time you allocate.
2. **Floating Focus HUD**: Once you start, an isolated, draggable focus HUD docks at the bottom-right corner with a live, adaptive countdown and interactive checklist.
3. **Session Review**: When your time expires or when you complete your tasks, an intentional reflection dialog lets you mark the session as finished, review tasks, or gracefully abandon it without judgment.
4. **Local Analytics & History**: Every session is recorded strictly in your browser's local storage (`chrome.storage.local`), providing actionable insights into your focus habits.

---

## 2. Technical Architecture & Constraints

- **Platform Target**: Google Chrome & Chromium-based browsers (Edge, Brave, Arc, Opera).
- **Manifest**: Manifest Version 3 (MV3).
- **Architecture**: 100% client-side, zero backend, zero external database, zero network analytics.
- **Persistent Storage**: `chrome.storage.local` with automated schema migrations and in-memory mock fallback.
- **Audio Feedback**: Web Audio API synthesizer for harmonic completion chimes (100% offline, zero external audio assets, CSP-compliant).
- **UI Isolation**: Shadow DOM (`attachShadow({ mode: 'open' })`) with injected inline styles ensures zero CSS leaks between the extension and host page styles (Facebook / YouTube dark mode or CSS resets).
- **Supported Domains**:
  - `https://www.facebook.com/*`, `https://facebook.com/*`, `https://web.facebook.com/*`
  - `https://www.youtube.com/*`, `https://youtube.com/*`

---

## 3. Directory Structure

```text
Focus Guard/
├── dist/                               # Production build (Load unpacked directory)
│   ├── manifest.json
│   ├── popup.html
│   ├── options.html
│   ├── service-worker-loader.js
│   ├── assets/
│   └── icons/
├── public/                             # Static assets
│   └── icons/                          # 16, 32, 48, 128 px PNG icons
├── src/
│   ├── background/
│   │   └── index.ts                    # MV3 background service worker & badge manager
│   ├── content/
│   │   ├── components/
│   │   │   ├── PurposeModal.tsx        # Glassmorphic modal asking "Why are you here?"
│   │   │   ├── FocusHUD.tsx            # Floating, draggable focus timer & checklist HUD
│   │   │   └── SessionEndDialog.tsx    # Completion / abandonment review dialog
│   │   ├── index.tsx                   # Shadow DOM mount & SPA navigation observer
│   │   ├── siteDetector.ts             # Domain & subdomain detection logic
│   │   └── styles.css                  # Isolated Tailwind styles for content script
│   ├── features/
│   │   ├── analytics/
│   │   │   └── analyticsCalculations.ts# 13 essential metrics & daily activity aggregations
│   │   └── session/
│   │       └── timerCalculations.ts    # Deadline countdown & adaptive palette engine
│   ├── options/
│   │   ├── components/
│   │   │   ├── OverviewTab.tsx         # KPI cards & 7-day activity visual charts
│   │   │   ├── HistoryTab.tsx          # Searchable, filterable session history table
│   │   │   └── SettingsTab.tsx         # Presets, sound, motion, and JSON/CSV data backup
│   │   ├── index.tsx
│   │   └── Options.tsx                 # Full-width productivity dashboard
│   ├── popup/
│   │   ├── index.tsx
│   │   └── Popup.tsx                   # Toolbar quick status & live timer
│   ├── shared/
│   │   ├── audio.ts                    # Web Audio API harmonic chime generator
│   │   └── types.ts                    # TypeScript models & default settings
│   ├── storage/
│   │   ├── migrations.ts               # Storage schema migration engine (v0 -> v1)
│   │   └── storage.ts                  # Type-safe chrome.storage.local wrapper
│   └── styles/
│       └── global.css                  # Global Tailwind stylesheet
├── tests/
│   ├── analytics.test.ts               # Metrics aggregation & filtering tests
│   ├── setup.ts                        # In-memory mock chrome APIs
│   ├── siteDetectionAndLifecycle.test.ts # Site routing & duplicate HUD tests
│   ├── storage.test.ts                 # Storage CRUD, export/import, & migration tests
│   └── timer.test.ts                   # Countdown accuracy & minute color tests
├── manifest.json                       # Source MV3 manifest definition
├── package.json                        # Dependencies and scripts
├── tailwind.config.js                  # Dark charcoal & glassmorphism theme config
├── tsconfig.json                       # Strict TypeScript configuration
└── vite.config.ts                      # CRXJS + Vite 5 bundler configuration
```

---

## 4. Adaptive Timer Color System

Focus Guard implements a multi-tier adaptive timer palette that prioritizes urgency while providing minute-boundary visual feedback:

| Remaining Duration | Visual Treatment | Meaning |
|---|---|---|
| **> 10 minutes** | Calm Cyan / Blue (`#06b6d4` / `#3b82f6`) | Deep focus phase |
| **10 minutes or less** | Teal / Emerald (`#10b981` / `#14b8a6`) | Steady progress |
| **5 minutes or less** | Amber (`#f59e0b`) | Approaching wrap-up |
| **2 minutes or less** | Orange (`#f97316`) | Final phase |
| **1 minute or less** | Vibrant Red (`#ef4444`) | Final sprint |
| **Expired (00:00)** | Glowing Crimson (`#dc2626`) | Explicit "Time's up" state |

**Minute Boundary Accent**: In addition to threshold colors, the timer alters its accent phase on every minute boundary (`minute % 2`), providing subtle, rhythmic visual feedback without distracting from the priority threshold colors.

---

## 5. Storage Schema & Migrations

All data is stored locally under the key `lifesolver_focus_guard_data` in `chrome.storage.local`:

```typescript
export interface StorageSchema {
  schemaVersion: number;
  activeSessions: {
    facebook: FocusSession | null;
    youtube: FocusSession | null;
  };
  sessionHistory: FocusSession[];
  canceledPromptCount: number;
  settings: UserSettings;
}

export interface FocusSession {
  id: string;
  site: 'facebook' | 'youtube';
  purpose: string;
  tasks: TaskItem[];
  startTime: number;
  allocatedDurationMs: number;
  deadlineTime: number;
  status: 'prompting' | 'active' | 'paused' | 'expired' | 'completed' | 'abandoned' | 'cancelled';
  lastUpdateTime: number;
  endTime?: number;
  actualDurationMs: number;
  sessionLabel?: string;
  wasExpired: boolean;
  tasksCompletedCount: number;
  totalTasksCount: number;
}
```

Migrations run automatically via `migrateStorageSchema()` on startup and imports.

---

## 6. Installation & Manual Testing Instructions

### Load into Google Chrome

1. Open Google Chrome (or any Chromium browser: Brave, Edge, Arc).
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions/
   ```
3. In the top-right corner of the page, toggle on **Developer mode**.
4. In the top-left corner, click **Load unpacked**.
5. In the file picker dialog, select the `dist` directory inside this project:
   ```text
   c:\Users\Adnan\Desktop\Focus Guard\dist
   ```
6. **LifeSolver Focus Guard** is now active in your browser!

### Verifying Core Features

1. **Test Facebook or YouTube Detection**:
   - Open [https://www.youtube.com](https://www.youtube.com).
   - The dark, glassmorphic **"Why are you here?"** modal will appear in the center of the page.
2. **Start a Focused Session**:
   - Enter your Purpose (e.g., *"Watch systems engineering talk"*).
   - Add one or two tasks (e.g., *"Take notes on concurrency"*).
   - Select a duration preset (e.g., `15m`) or specify a custom duration.
   - Click **Start Focus Session**.
3. **Inspect the Floating Focus HUD**:
   - The modal disappears, and the floating focus HUD appears docked in the bottom-right corner.
   - Click the drag handle in the header to drag the HUD to any preferred position on screen.
   - Click the task checkbox: notice the completed task is checked and strikethrough.
   - Click the minimize (`_`) button to collapse into a slim floating pill; click the pill to expand back.
4. **Test End-of-Session Flow**:
   - Click **End Session** on the HUD.
   - A dialog gives you three clear choices: **Finish Session**, **Continue**, or **Abandon Session**.
   - Click **Finish Session**.
5. **Inspect the Local Dashboard & Analytics**:
   - Click the extension icon in the Chrome toolbar.
   - View your live statistics summary in the popup.
   - Click **Dashboard & Analytics** to open the full dashboard page.
   - Review your KPI cards, 7-day activity bar chart, platform distribution, and session history table.
   - In the **Settings** tab, test exporting your data to JSON or CSV!

---

## 7. Running Automated Tests

Run the Vitest test suite covering all 20 specified scenarios:

```bash
# Run test suite
pnpm test

# Run strict TypeScript check
pnpm run typecheck

# Build extension
pnpm run build
```

---

## 8. Privacy & Security Assurance

- **Zero Remote Telemetry**: No tracking scripts, Google Analytics, or remote beacons.
- **Zero Remote Code**: All scripts, stylesheets, and Lucide icons are bundled locally inside the extension.
- **Zero Account Inspection**: Focus Guard never inspects passwords, cookies, authorization tokens, or page content. It detects only whether the current browser tab URL is Facebook or YouTube.
- **Local Data Only**: All session history and settings live solely in your local browser (`chrome.storage.local`). Clearing browser data or removing the extension erases local records.
- **Export / Import**: You retain full ownership of your data through one-click JSON backup export and import.

---

## 9. Known Limitations

- **Browser Storage Lifetime**: Since data is stored in `chrome.storage.local`, clearing browser extension storage or uninstalling Chrome removes the local database. Users should use the built-in **Export Backup (JSON)** feature in Settings to retain permanent backups.
- **Incognito Mode**: Focus Guard will only activate in Incognito tabs if the user explicitly enables "Allow in Incognito" in `chrome://extensions/`.
- **Fullscreen Video Overlays**: When entering native full-screen video playback on YouTube (HTML5 `<video>.requestFullscreen()`), the browser places only the video element into the OS fullscreen layer. The HUD remains visible when exiting fullscreen mode or in theater mode.
