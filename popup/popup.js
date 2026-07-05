let currentJobs = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scanBtn').addEventListener('click', triggerScan);
  document.getElementById('startBatchBtn').addEventListener('click', startBatch);
  document.getElementById('stopBatch').addEventListener('click', stopBatch);
  document.getElementById('skipBtn').addEventListener('click', skipJob);
  document.getElementById('selectAllCheck').addEventListener('change', toggleSelectAll);

  // Event delegation for job card checkboxes — added once, not per scan
  document.getElementById('results').addEventListener('change', (e) => {
    if (e.target.classList.contains('job-card__checkbox')) {
      const idx = parseInt(e.target.dataset.index);
      currentJobs[idx].selected = e.target.checked;
      const card = e.target.closest('.job-card');
      card.classList.toggle('job-card--deselected', !e.target.checked);
      updateSelectAll();
      updateBatchButton();
    }
  });

  checkBatchStatus();
});

function toggleSelectAll() {
  const checked = document.getElementById('selectAllCheck').checked;
  currentJobs.forEach(j => j.selected = checked);
  document.querySelectorAll('.job-card__checkbox').forEach(cb => cb.checked = checked);
  document.querySelectorAll('.job-card').forEach(c => c.classList.toggle('job-card--deselected', !checked));
  updateBatchButton();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'batch-status') {
    updateBatchStatus(message.running, message.current, message.total, message.done, message.job);
    if (message.done) {
      showStatus('All jobs processed!', 'success');
      document.getElementById('startBatchBtn').style.display = 'block';
    }
  }
  if (message.action === 'batch-log') {
    addLogEntry(message.entry);
  }
});

async function findJobSiteTab() {
  // First check the active tab in the focused window
  const active = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeUrl = active[0]?.url?.toLowerCase() || '';
  if (activeUrl.includes('indeed.com') || activeUrl.includes('trabalhabrasil.com.br')) {
    return active[0];
  }
  // Fallback: search all windows for any supported job site tab
  const patterns = [
    '*://*.indeed.com/*',
    '*://indeed.com/*',
    '*://*.trabalhabrasil.com.br/*',
    '*://trabalhabrasil.com.br/*'
  ];
  for (const pattern of patterns) {
    const tabs = await chrome.tabs.query({ url: pattern });
    const found = tabs.find(t => t.active) || tabs[0];
    if (found) return found;
  }
  return null;
}

async function triggerScan() {
  const btn = document.getElementById('scanBtn');
  const status = document.getElementById('statusMessage');
  const results = document.getElementById('results');
  btn.disabled = true;
  status.textContent = 'Scanning...';
  status.className = '';

  try {
    const tab = await findJobSiteTab();
    if (!tab?.id) { showStatus('Open a supported job site first', 'error'); btn.disabled = false; return; }

    const ping = await chrome.tabs.sendMessage(tab.id, { action: 'ping' }).catch(() => null);
    if (!ping) { showStatus('Reload the page and try again', 'error'); btn.disabled = false; return; }
    if (!ping.adapterFound) { showStatus('This site is not supported', 'error'); btn.disabled = false; return; }

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });
    if (result?.error) { showStatus(result.error, 'error'); btn.disabled = false; return; }

    currentJobs = (result?.jobs || []).map(j => ({ ...j, selected: true }));

    if (currentJobs.length === 0) {
      results.innerHTML = '<p class="empty-state">No Easy Apply jobs found on this page.</p>';
      showStatus('No Easy Apply jobs found', '');
      btn.disabled = false;
      return;
    }

    document.getElementById('selectAllCheck').checked = true;
    document.getElementById('selectAllLabel').style.display = 'flex';
    document.getElementById('applyControls').style.display = 'block';
    updateBatchButton();

    showStatus(`Found ${currentJobs.length} Easy Apply jobs`, 'success');

    results.innerHTML = currentJobs.map((job, i) => `
      <div class="job-card job-card--easy" data-index="${i}">
        <label class="job-card__checkbox-label">
          <input type="checkbox" class="job-card__checkbox" checked data-index="${i}" />
        </label>
        <div class="job-card__body">
          <div class="job-card__title">${esc(job.title)}</div>
          <div class="job-card__company">${esc(job.company)}</div>
          <div class="job-card__meta">
            <span>${esc(job.location || '')}</span>
            ${job.salary ? `<span>${esc(job.salary)}</span>` : ''}
            <span class="job-card__badge badge--yes">Easy Apply</span>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function startBatch() {
  const selected = currentJobs.filter(j => j.selected);
  if (selected.length === 0) { showStatus('Select at least one job', 'error'); return; }
  const tab = await findJobSiteTab();
  if (!tab?.id) { showStatus('Open a supported job site first', 'error'); return; }

  document.getElementById('startBatchBtn').style.display = 'none';
  try {
    await chrome.runtime.sendMessage({ action: 'batch-start', jobs: selected, tabId: tab.id });
  } catch {}
}

function updateBatchButton() {
  const count = currentJobs.filter(j => j.selected).length;
  const btn = document.getElementById('startBatchBtn');
  btn.textContent = count === 0 ? 'Select at least one job' : `Start Batch (${count} job${count !== 1 ? 's' : ''})`;
  btn.disabled = count === 0;
}

function updateSelectAll() {
  const allSelected = currentJobs.every(j => j.selected);
  const noneSelected = currentJobs.every(j => !j.selected);
  document.getElementById('selectAllCheck').checked = allSelected;
  document.getElementById('selectAllCheck').indeterminate = !allSelected && !noneSelected;
}

async function stopBatch() {
  try {
    await chrome.runtime.sendMessage({ action: 'batch-stop' });
    updateBatchStatus(false);
    document.getElementById('startBatchBtn').style.display = 'block';
    showStatus('Batch stopped', 'error');
  } catch {}
}

async function checkBatchStatus() {
  try {
    const s = await chrome.runtime.sendMessage({ action: 'get-batch-status' });
    updateBatchStatus(s?.running, s?.current, s?.total);
  } catch {}
}

async function skipJob() {
  // Disable immediately to prevent double-clicks and race conditions
  document.getElementById('skipBtn').disabled = true;
  try {
    await chrome.runtime.sendMessage({ action: 'batch-skip' });
  } catch {}
}

function updateBatchStatus(running, current, total, done, job) {
  const el = document.getElementById('batchStatus');
  const label = document.getElementById('batchLabel');
  const skip = document.getElementById('skipBtn');
  if (running) {
    el.style.display = 'flex';
    label.textContent = job ? `Job ${current}/${total}: ${esc(job)}` : `Opening jobs... (${current}/${total})`;
    // Re-enable Skip button when the next job has loaded
    skip.disabled = false;
  } else if (done) {
    el.style.display = 'none';
  } else {
    el.style.display = 'none';
  }
}

function addLogEntry(entry) {
  const results = document.getElementById('results');
  const status = document.getElementById('statusMessage');
  const prefix = entry.success ? '✅' : '❌';
  let msg = `${prefix} ${esc(entry.title || '')} — ${entry.success ? 'Confirmed' : (entry.reason || 'Failed')}`;
  if (entry.detail) {
    msg += ` (${esc(entry.detail)})`;
  }
  status.textContent = msg;
  status.className = entry.success ? 'success' : 'error';
}

function showStatus(msg, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.className = type || '';
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
