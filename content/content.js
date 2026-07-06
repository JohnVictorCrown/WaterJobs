(function () {
  const url = window.location.href;
  const AdapterClass = SiteRegistry.getAdapter(url);
  const adapter = AdapterClass ? new AdapterClass(url) : null;

  let floatBar = null;

  // Inject floating bar styles once
  const styleId = 'waterjobs-float-bar-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #waterjobs-float-bar {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #1f2937;
        color: #fff;
        padding: 10px 18px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        user-select: none;
      }
      #waterjobs-float-bar__label {
        white-space: nowrap;
        font-weight: 500;
        margin-right: 4px;
      }
      #waterjobs-float-bar__skip {
        padding: 6px 16px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: #f59e0b;
        color: #fff;
        transition: background 0.15s;
      }
      #waterjobs-float-bar__skip:hover { background: #d97706; }
      #waterjobs-float-bar__skip:disabled { background: #6b7280; cursor: not-allowed; }
      #waterjobs-float-bar__stop {
        padding: 6px 16px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: #ef4444;
        color: #fff;
        transition: background 0.15s;
      }
      #waterjobs-float-bar__stop:hover { background: #dc2626; }
    `;
    document.head.appendChild(style);
  }

  function createFloatBar(label) {
    removeFloatBar();
    floatBar = document.createElement('div');
    floatBar.id = 'waterjobs-float-bar';

    const labelEl = document.createElement('span');
    labelEl.id = 'waterjobs-float-bar__label';
    labelEl.textContent = label || '';
    floatBar.appendChild(labelEl);

    const skipBtn = document.createElement('button');
    skipBtn.id = 'waterjobs-float-bar__skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => {
      skipBtn.disabled = true;
      chrome.runtime.sendMessage({ action: 'batch-skip' }).catch(() => {});
    });
    floatBar.appendChild(skipBtn);

    const stopBtn = document.createElement('button');
    stopBtn.id = 'waterjobs-float-bar__stop';
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'batch-stop' }).catch(() => {});
    });
    floatBar.appendChild(stopBtn);

    document.body.appendChild(floatBar);
  }

  function removeFloatBar() {
    if (floatBar) {
      floatBar.remove();
      floatBar = null;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse({ alive: true, adapterFound: !!adapter });
      return true;
    }

    if (message.action === 'scan') {
      if (!adapter) { sendResponse({ error: 'No adapter', jobs: [] }); return true; }
      try {
        const jobs = adapter.scanSerp();
        sendResponse({ jobs, count: jobs.length });
      } catch (err) {
        sendResponse({ error: err.message, jobs: [] });
      }
      return true;
    }

    if (message.action === 'check-confirmation') {
      const result = adapter ? adapter.isConfirmed() : false;
      sendResponse({ confirmed: !!result, matchedText: result || null });
      return true;
    }

    if (message.action === 'click-apply') {
      if (!adapter || typeof adapter.clickApply !== 'function') {
        sendResponse({ clicked: false, reason: 'No adapter or clickApply not supported' });
        return true;
      }
      adapter.clickApply().then(result => {
        sendResponse(result);
      });
      return true; // keep channel open for async response
    }

    if (message.action === 'click-submit') {
      if (!adapter || typeof adapter.clickSubmit !== 'function') {
        sendResponse({ clicked: false, reason: 'No adapter or clickSubmit not supported' });
        return true;
      }
      adapter.clickSubmit().then(result => {
        sendResponse(result);
      });
      return true;
    }

    if (message.action === 'fill-application') {
      if (!adapter || typeof adapter.fillApplication !== 'function') {
        sendResponse({ filled: false, reason: 'No adapter or fillApplication not supported' });
        return true;
      }
      adapter.fillApplication().then(result => {
        sendResponse(result);
      });
      return true;
    }

    if (message.action === 'click-send') {
      if (!adapter || typeof adapter.clickSend !== 'function') {
        sendResponse({ clicked: false, reason: 'No adapter or clickSend not supported' });
        return true;
      }
      adapter.clickSend().then(result => {
        sendResponse(result);
      });
      return true;
    }

    if (message.action === 'show-float-bar') {
      createFloatBar(message.label || 'WaterJobs');
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === 'hide-float-bar') {
      removeFloatBar();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
