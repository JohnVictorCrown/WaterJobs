let batchQueue = [];
let batchTabId = null;
let batchRunning = false;
let batchCurrent = 0;
let batchTotal = 0;
let batchStopped = false;
let currentJob = null;
let currentJobHandled = false;
let skipReady = false; // only true while pollForConfirmation is actively running

let popupWindowId = null;

// Open popup as a persistent window (doesn't auto-close like default_popup)
chrome.action.onClicked.addListener(() => {
  if (popupWindowId) {
    chrome.windows.update(popupWindowId, { focused: true }).catch(() => {
      popupWindowId = null;
      createPopupWindow();
    });
  } else {
    createPopupWindow();
  }
});

function createPopupWindow() {
  chrome.windows.create({
    url: 'popup/popup.html',
    type: 'popup',
    width: 440,
    height: 600,
    focused: true
  }, (win) => {
    popupWindowId = win?.id || null;
  });
}

// Keyboard shortcut: Ctrl+Shift+S (Cmd+Shift+S on Mac) to skip current job
chrome.commands.onCommand.addListener((command) => {
  if (command === 'skip-job') {
    console.log('[TRACE] keyboard shortcut: skip-job');
    if (currentJob && !currentJobHandled && skipReady) {
      currentJobHandled = true;
      skipReady = false;
      logResult(currentJob, true, 'Skipped (keyboard)');
      batchQueue.shift();
      setTimeout(processNext, 1500);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'batch-start') {
    console.log('[TRACE] batch-start received, queue:', message.jobs?.length);
    startBatch(message.jobs, message.tabId);
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'batch-stop') {
    console.log('[TRACE] batch-stop received, currentJob:', currentJob?.title);
    batchStopped = true;
    batchRunning = false;
    postToPopup({ action: 'batch-status', running: false, current: batchCurrent, total: batchTotal });
    sendToTab(batchTabId, { action: 'hide-float-bar' });
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'batch-skip') {
    console.log('[TRACE] batch-skip received for:', currentJob?.title, '| handled:', currentJobHandled, '| skipReady:', skipReady, '| queue length:', batchQueue.length);
    if (currentJob && !currentJobHandled && skipReady) {
      currentJobHandled = true;
      skipReady = false;
      console.log('[TRACE] >>> SKIP PROCESSING:', currentJob.title, '| queue before shift:', JSON.stringify(batchQueue.map(j => j.title)));
      logResult(currentJob, true, 'Skipped');
      batchQueue.shift();
      console.log('[TRACE] >>> queue after shift:', JSON.stringify(batchQueue.map(j => j.title)));
      setTimeout(processNext, 1500);
    } else {
      const reason = !currentJob ? 'no currentJob' : currentJobHandled ? 'already handled' : !skipReady ? 'skip not ready (still navigating)' : 'unknown';
      console.log('[TRACE] >>> SKIP BLOCKED —', reason);
    }
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'get-batch-status') {
    sendResponse({ running: batchRunning, current: batchCurrent, total: batchTotal });
    return true;
  }
});

function sendToTab(tabId, msg) {
  return chrome.tabs.sendMessage(tabId, msg).catch(() => null);
}

function postToPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function waitForContentScript(tabId, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await sendToTab(tabId, { action: 'ping' });
    if (r && r.alive) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function startBatch(jobs, tabId) {
  console.log('[TRACE] startBatch called with', jobs.length, 'jobs');
  if (!tabId || jobs.length === 0) return;
  batchQueue = [...jobs];
  batchTabId = tabId;
  batchRunning = true;
  batchStopped = false;
  batchCurrent = 0;
  batchTotal = jobs.length;
  currentJob = null;
  currentJobHandled = false;
  postToPopup({ action: 'batch-status', running: true, current: 0, total: jobs.length });
  sendToTab(tabId, { action: 'show-float-bar', label: '0 / ' + jobs.length });
  processNext();
}

async function processNext() {
  console.log('[TRACE] === processNext called === queue length:', batchQueue.length, '| stopped:', batchStopped, '| running:', batchRunning);
  if (batchStopped || !batchRunning) {
    console.log('[TRACE] processNext — batch stopped or not running');
    sendToTab(batchTabId, { action: 'hide-float-bar' });
    batchRunning = false;
    return;
  }
  if (batchQueue.length === 0) {
    console.log('[TRACE] processNext — queue empty, batch done');
    batchRunning = false;
    currentJob = null;
    postToPopup({ action: 'batch-status', running: false, done: true, current: batchTotal, total: batchTotal });
    sendToTab(batchTabId, { action: 'hide-float-bar' });
    return;
  }

  const job = batchQueue[0];
  currentJob = job;
  currentJobHandled = false;
  skipReady = false; // block skip during navigation + content script load
  batchCurrent = batchTotal - batchQueue.length + 1;
  console.log('[TRACE] processNext — processing job', batchCurrent, '/', batchTotal, ':', job.title);

  postToPopup({ action: 'batch-status', running: true, current: batchCurrent, total: batchTotal, job: job.title });

  // Navigate to the job URL
  console.log('[TRACE] navigating to:', job.url);
  const tab = await new Promise(r => chrome.tabs.update(batchTabId, { url: job.url }, t => r(chrome.runtime.lastError ? null : t)));
  if (!tab) {
    console.log('[TRACE] tab was closed during navigation');
    if (!currentJobHandled) {
      currentJobHandled = true;
      logResult(job, false, 'Tab was closed');
      batchQueue.shift();
      setTimeout(processNext, 1500);
    }
    return;
  }

  // Wait for the tab to actually navigate to the job URL
  // (prevents detecting the OLD page's content script before it's destroyed)
  console.log('[TRACE] waiting for navigation to complete...');
  await new Promise(r => setTimeout(r, 1500));

  // Wait for content script to load
  console.log('[TRACE] waiting for content script...');
  const ready = await waitForContentScript(batchTabId, 30000);
  if (!ready) {
    console.log('[TRACE] content script did not load (timeout or redirect)');
    if (!currentJobHandled) {
      currentJobHandled = true;
      logResult(job, false, 'Content script did not load');
      batchQueue.shift();
      setTimeout(processNext, 1500);
    }
    return;
  }

  console.log('[TRACE] content script loaded, sending click-apply');
  // Step 1: Click "Me candidatar" on the job detail page.
  // This triggers navigation to a separate apply form page.
  const clickResult = await sendToTab(batchTabId, { action: 'click-apply' });
  console.log('[TRACE] click-apply result:', JSON.stringify(clickResult));

  // Step 2: Wait for navigation to the apply form page.
  // After clicking "Me candidatar", the page navigates to a new URL.
  // The old content script is destroyed; we wait for the new one to load.
  if (clickResult && clickResult.clicked) {
    console.log('[TRACE] waiting for navigation to apply form...');
    // Give a moment for navigation to start
    await new Promise(r => setTimeout(r, 1500));
    // Wait for the content script to re-load on the new page
    const formReady = await waitForContentScript(batchTabId, 20000);
    if (formReady) {
      console.log('[TRACE] apply form loaded, sending click-submit');
      const submitResult = await sendToTab(batchTabId, { action: 'click-submit' });
      console.log('[TRACE] click-submit result:', JSON.stringify(submitResult));

      // Settle delay after form submission — lets the confirmation page render
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log('[TRACE] apply form content script did not load (timeout)');
    }
  }

  console.log('[TRACE] showing float bar, starting poll');
  sendToTab(batchTabId, { action: 'show-float-bar', label: batchCurrent + ' / ' + batchTotal });

  skipReady = true; // now safe to process skip messages
  await pollForConfirmation(batchTabId, job);
  console.log('[TRACE] pollForConfirmation returned for', job.title);
}

async function pollForConfirmation(tabId, job) {
  const CONFIRMATION_TIMEOUT = 300000;
  const POLL_INTERVAL = 2000;
  const start = Date.now();

  console.log('[TRACE] pollForConfirmation started for:', job.title);

  // Wait before first check so the page can fully settle after navigation.
  // Prevents a false-positive on the very first poll that could cause
  // a double-advance when combined with a Skip or confirm on the previous job.
  await new Promise(r => setTimeout(r, POLL_INTERVAL));

  // Check stop/handled flags after the settle delay
  if (batchStopped || !batchRunning) {
    console.log('[TRACE] poll — batch stopped during settle, exiting');
    return;
  }
  if (currentJobHandled) {
    console.log('[TRACE] poll — handled during settle, exiting');
    return;
  }

  while (Date.now() - start < CONFIRMATION_TIMEOUT) {
    if (batchStopped || !batchRunning) {
      console.log('[TRACE] poll — batch stopped, exiting');
      return;
    }

    if (currentJobHandled) {
      console.log('[TRACE] poll — currentJobHandled is true, exiting');
      return;
    }

    const result = await sendToTab(tabId, { action: 'check-confirmation' });
    if (result?.confirmed) {
      const matchedText = result.matchedText || 'Confirmed';
      console.log('[TRACE] >>> CONFIRMATION DETECTED for:', job.title, '| matched:', matchedText);
      if (!currentJobHandled) {
        currentJobHandled = true;
        logResult(job, true, 'Confirmed', matchedText);
        console.log('[TRACE] >>> queue before shift:', JSON.stringify(batchQueue.map(j => j.title)));
        batchQueue.shift();
        console.log('[TRACE] >>> queue after shift:', JSON.stringify(batchQueue.map(j => j.title)));
        setTimeout(processNext, 1500);
      } else {
        console.log('[TRACE] >>> confirm blocked — already handled');
      }
      return;
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  console.log('[TRACE] poll — timed out for:', job.title);
  if (!currentJobHandled) {
    currentJobHandled = true;
    logResult(job, false, 'Timed out waiting for confirmation (5 min)');
    batchQueue.shift();
    setTimeout(processNext, 1500);
  }
}

function logResult(job, success, reason, detail) {
  const entry = { jobUrl: job.url, title: job.title, company: job.company, success, reason: reason || '', detail: detail || '', time: Date.now() };
  postToPopup({ action: 'batch-log', entry, current: batchCurrent, total: batchTotal });
}
