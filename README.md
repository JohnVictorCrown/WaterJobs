# WaterJobs

A Chrome extension (Manifest V3) that **automates browsing through Easy Apply jobs on Indeed**. It scans search results for "Candidate-se facilmente" jobs, opens them one by one in your tab, and automatically advances to the next job when it detects the confirmation page — so you can focus on applying, not on clicking through links.

> **How it works:** You apply manually. The extension handles the navigation. It opens each job, waits for you to finish, detects the confirmation, then moves to the next.

---

## Features

- **Scan Indeed SERP** — Finds all "Candidate-se facilmente" (Easy Apply) jobs on the current search results page
- **Select which jobs to process** — Check/uncheck individual jobs before starting
- **Batch navigation** — Opens each job URL in your current tab, one after another
- **Auto-advance on confirmation** — Detects the post-apply confirmation page and automatically moves to the next job
- **Skip / Stop** — Multiple ways to control the batch:
  - **Floating bar** on the page (Skip + Stop buttons)
  - **Persistent popup window** (click the extension icon)
  - **Keyboard shortcut** — `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac) to skip
- **External site redirect handling** — Automatically advances past jobs that redirect to the company's own application portal
- **Supports 17+ Indeed country domains** — `.com`, `.co.uk`, `.ca`, `.com.br`, `.de`, `.fr`, `.it`, `.es`, `.nl`, `.ch`, `.com.au`, and more

---

## Installation

### From source (developer mode)

1. **Clone or download** this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `WaterJobs` folder
6. The extension icon should appear in your toolbar

> After making code changes, go to `chrome://extensions` and click the refresh icon on the WaterJobs card to reload.

---

## Usage

### 1. Scan for jobs

1. Go to an Indeed search results page (e.g., `https://br.indeed.com/...`)
2. Click the **WaterJobs** extension icon — a persistent popup window opens
3. Click **Scan Page**
4. All "Candidate-se facilmente" jobs on the page appear with checkboxes

### 2. Select which jobs to process

- **Uncheck** any jobs you want to skip
- Use the **Select All** checkbox at the top to toggle all at once
- The button shows how many jobs are selected: "Start Batch (5 jobs)"

### 3. Start the batch

1. Click **Start Batch — Open Jobs**
2. The extension navigates your current tab to each job URL in sequence
3. A **floating bar** appears on the page showing the current job number (e.g., "3 / 10")

### 4. Apply manually

- Fill out and submit the application on Indeed as you normally would
- When the confirmation page appears, the extension **automatically detects it** and moves to the next job after a short delay

### 5. Skip or Stop

Use any of these methods:

| Method | Action |
|--------|--------|
| **Floating bar** (on the page) | Click **Skip** to skip current job, **Stop** to end the batch |
| **Popup window** | Click **Skip** or **Stop** in the popup |
| **Keyboard** | Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac) to skip |

---

## Supported Indeed domains

| Domain | Country |
|--------|---------|
| `indeed.com` | United States |
| `indeed.co.uk` | United Kingdom |
| `indeed.ca` | Canada |
| `indeed.com.au` | Australia |
| `indeed.co.in` | India |
| `indeed.de` | Germany |
| `indeed.fr` | France |
| `indeed.it` | Italy |
| `indeed.es` | Spain |
| `indeed.nl` | Netherlands |
| `indeed.pl` | Poland |
| `indeed.se` | Sweden |
| `indeed.ch` | Switzerland |
| `indeed.com.br` | Brazil |
| `indeed.com.mx` | Mexico |
| `indeed.com.ar` | Argentina |
| `indeed.com.co` | Colombia |
| `indeed.com.pe` | Peru |
| `indeed.com.pt` | Portugal |

---

## How it works (technical)

```
Popup ──→ Background:  batch-start (jobs, tabId)
Background ──→ Tab:    navigate to job URL
Background ──→ Tab:    show floating bar
Background ──→ Tab:    poll check-confirmation (every 2s)
Tab ──→ Background:    confirmed → advance to next job
Popup/Floating bar ──→ Background: batch-skip / batch-stop
```

The **background service worker** manages a FIFO queue of jobs. For each job:
1. Navigates your tab to the job URL
2. Waits for the content script to load
3. Shows the floating bar (Skip + Stop)
4. Polls every 2 seconds for confirmation text
5. When detected, logs the result and moves to the next after a 1.5s delay

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` (Windows/Linux) | Skip current job |
| `Cmd+Shift+S` (Mac) | Skip current job |

---

## Files structure

```
WaterJobs/
├── manifest.json           ← Extension config
├── background.js           ← Service worker (batch queue, navigation, polling)
├── content/
│   ├── content.js          ← Injected script (scan, confirmation check, floating bar)
│   └── adapters/
│       ├── BaseAdapter.js  ← Abstract class + SiteRegistry
│       └── IndeedAdapter.js
├── indeed/
│   └── IndeedEngine.js     ← SERP scanning + confirmation detection
├── popup/
│   ├── popup.html          ← Popup UI
│   ├── popup.css           ← Popup styles
│   └── popup.js            ← Popup logic
├── assets/                 ← Logo + fonts
├── icons/                  ← Extension icons
├── AGENTS.md               ← Developer documentation
└── README.md               ← You are here
```

---

## Debugging

Open the service worker console to see `[TRACE]` logs:

1. Go to `chrome://extensions`
2. Find WaterJobs
3. Click **service worker** (blue text under "Inspect views")
4. The Console tab shows the batch flow trace

---

## License

MIT
