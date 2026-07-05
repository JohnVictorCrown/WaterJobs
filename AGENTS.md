# WaterJobs — AGENTS.md

Chrome extension (MV3) that finds Easy Apply jobs on Indeed, opens them one by one in your tab, and waits for you to apply manually. Once you complete the application, it detects the confirmation page and automatically moves to the next job. Skip and Stop buttons are available both in the popup and as a floating bar on the page.

## How it works

1. **Scan** — Click "Scan Page" on any Indeed SERP (search results page). The extension collects all "Candidate-se facilmente" (Easy Apply) job links.
2. **Select** — Check/uncheck jobs to opt out of any you don't want.
3. **Start Batch** — Click "Start Batch — Open Jobs". The background worker navigates your current tab to each job URL in sequence.
4. **Apply manually** — You fill out and submit the application on Indeed yourself.
5. **Auto-advance** — The worker polls the page every 2 seconds for confirmation text (e.g. "sua inscrição foi enviada"). When detected, it logs the result and opens the next job.
6. **Skip / Stop** — Use the floating bar on the page (or the popup) to skip a job or stop the batch at any time.

## Architecture

```
WaterJobs/
├── manifest.json              ← MV3 config: permissions, host matches, content scripts
├── background.js              ← Service worker: batch queue, navigation, confirmation polling
├── content/
│   ├── content.js             ← Injected content script: scan, confirmation check, floating bar
│   └── adapters/
│       ├── BaseAdapter.js     ← Abstract class + SiteRegistry pattern
│       └── IndeedAdapter.js   ← Indeed-specific adapter (scanSerp, isConfirmed)
├── indeed/
│   └── IndeedEngine.js        ← SERP scanning (scanSerp) + confirmation detection (isConfirmed)
├── trabalhaBrasil/
│   └── TrabalhaBrasilEngine.js ← Trabalha Brasil SERP scanning + confirmation detection
├── popup/
│   ├── popup.html             ← Popup UI (scan button, job list with checkboxes, batch controls)
│   ├── popup.css              ← Styled with Neue Frutiger World brand font
│   └── popup.js               ← Popup logic: scan, select/deselect, start/stop/skip batch
├── assets/
│   ├── logo.png               ← Brand logo
│   └── NeueFrutigerWorld-Regular.otf ← Brand font
└── icons/                     ← Extension icons (16, 48, 128)
```

## Message flow

```
Popup ──→ Background:  { action: 'batch-start', jobs, tabId }
Popup ──→ Background:  { action: 'batch-stop' }
Popup ──→ Background:  { action: 'batch-skip' }
Popup ──→ Background:  { action: 'get-batch-status' }

Content ──→ Background: { action: 'batch-skip' }       (from floating bar)
Content ──→ Background: { action: 'batch-stop' }       (from floating bar)

Background ──→ Content: { action: 'ping' }
Background ──→ Content: { action: 'scan' }
Background ──→ Content: { action: 'check-confirmation' }
Background ──→ Content: { action: 'show-float-bar', label }
Background ──→ Content: { action: 'hide-float-bar' }

Background ──→ Popup:   { action: 'batch-status', running, current, total, done, job }
Background ──→ Popup:   { action: 'batch-log', entry, current, total }
```

## Key files

### `background.js`
Service worker that manages the batch queue. Key state:
- `batchQueue` — FIFO queue of job objects
- `currentJob` — job currently being processed
- `currentJobHandled` — prevents double-processing (skip/confirm/timeout guards)
- `skipReady` — only `true` after content script loads and polling starts, prevents stale skip messages from previous pages

Flow: `startBatch()` → `processNext()` (navigates to URL, waits for content script, shows floating bar) → `pollForConfirmation()` (polls every 2s, detects confirmation, advances queue).

### `indeed/IndeedEngine.js`
Two methods:
- `scanSerp()` — Scans Indeed search results for "Candidate-se facilmente" job cards. Returns `{ jk, title, company, location, salary, url }`.
- `isConfirmed()` — Checks page body for confirmation text ("sua inscrição foi enviada" + "você receberá uma confirmação no e-mail") or external-site redirect message ("para finalizar sua candidatura...").

### `content/content.js`
Injected into Indeed pages. Handles:
- `ping` — Returns alive/not alive
- `scan` — Delegates to adapter's `scanSerp()`
- `check-confirmation` — Delegates to adapter's `isConfirmed()`
- `show-float-bar` / `hide-float-bar` — Creates/removes a floating bar with Skip and Stop buttons

### `popup/popup.js`
- Scan button → triggers `scan` on content script, renders job cards with checkboxes
- Select All checkbox → toggle all jobs on/off
- Start Batch button → sends selected jobs to background, button text updates with count
- Skip / Stop buttons → visible during batch runs

## Adding a new job site

1. Create `content/adapters/SiteAdapter.js` extending `BaseAdapter`.
2. Implement `matches(url)`, `scanSerp()` (returns job array), and `isConfirmed()` (checks for post-apply text).
3. Call `SiteRegistry.register(MyAdapter)` at the bottom of the file.
4. Add the adapter's script and match pattern to `manifest.json` under `content_scripts`.
5. Add the domain to `host_permissions` in `manifest.json`.

## Testing / development

- Load the extension in Chrome via `chrome://extensions` → "Load unpacked" → point at this folder.
- The content script fires on `*.indeed.com/*` (or whatever is in `matches`).
- Open the service worker console (`chrome://extensions` → WaterJobs → service worker → Inspect) to see `[TRACE]` logs for batch flow debugging.

## Key conventions

- Each adapter registers itself via `SiteRegistry.register()` at module level — this runs when the content script bundle executes.
- Job objects have the shape: `{ jk, title, company, location, salary, url }`.
- Confirmation detection uses two specific Portuguese (Brazil) phrases. Add locale detection for other languages as needed.
- The floating bar is injected dynamically by `content.js` with inline styles — no separate CSS file needed.
