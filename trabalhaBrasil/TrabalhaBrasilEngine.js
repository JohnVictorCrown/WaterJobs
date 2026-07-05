class TrabalhaBrasilEngine {
  isSerpPage() {
    return !!document.querySelector('.job-card, .jobs-list');
  }

  scanSerp() {
    const cards = document.querySelectorAll('.job-card');
    const jobs = [];
    for (const card of cards) {
      if (card.classList.contains('job-card-skeleton')) continue;

      const link = card.querySelector('.job-link');
      if (!link) continue;

      const href = link.getAttribute('href') || '';
      const titleEl = card.querySelector('.job-title');
      const title = titleEl?.textContent?.trim() || '';
      const company = card.querySelector('.job-company')?.textContent?.trim() || '';
      const location = card.querySelector('.job-location')?.textContent?.trim() || '';

      if (!title) continue;

      const url = href.startsWith('http') ? href : `https://www.trabalhabrasil.com.br${href}`;

      jobs.push({ title, company, location, url });
    }
    return jobs;
  }

  isConfirmed() {
    const t = (document.body.textContent || '').toLowerCase();
    const phrases = [
      'currículo enviado com sucesso',
      'candidatura realizada com sucesso',
      'vaga candidatada com sucesso',
      'sua candidatura foi enviada com sucesso'
    ];
    for (const phrase of phrases) {
      if (t.includes(phrase)) return phrase;
    }
    return false;
  }

  /**
   * Click the "Me candidatar" (apply) button on a job detail page.
   * Note: After clicking, the page navigates to a separate apply form URL.
   * The background must then send clickSubmit() on the new page.
   */
  clickApply() {
    return this._findAndClick(
      t => t.includes('me candidatar') || t === 'candidatar-se',
      10000,
      'Apply button'
    );
  }

  /**
   * Click the "Finalizar candidatura" (submit) button on the apply form page.
   * Called by the background AFTER navigation from clickApply().
   */
  clickSubmit() {
    return this._findAndClick(
      t => t.includes('finalizar candidatura'),
      15000,
      'Submit button'
    );
  }

  /**
   * Shared helper: poll for a button matching text, then click it.
   * Tries known IDs first, then falls back to text matching.
   */
  _findAndClick(matcher, timeoutMs, label) {
    return new Promise((resolve) => {
      const BUTTONS = [
        'button',
        'a',
        'input[type="submit"]',
        'input[type="button"]',
        '[role="button"]'
      ];

      // Known IDs for Trabalha Brasil submit button
      const SUBMIT_IDS = {
        'btnSubmitWithAttachment': 'finalizar candidatura',
        'btnSubmit': 'finalizar candidatura'
      };

      function normalizeText(text) {
        return (text || '').replace(/\u00a0/g, ' ').trim().toLowerCase();
      }

      function findByText(elements, matcher) {
        for (const el of elements) {
          const text = normalizeText(el.textContent || el.value || '');
          if (matcher(text)) return el;
        }
        return null;
      }

      function tryById(ids) {
        for (const [id, searchText] of Object.entries(ids)) {
          const el = document.getElementById(id);
          if (el && normalizeText(el.textContent || el.value || '').includes(searchText)) {
            return el;
          }
        }
        return null;
      }

      const start = Date.now();
      function poll() {
        // Try known submit IDs first (faster, more precise)
        const byId = tryById(SUBMIT_IDS);
        if (byId) {
          byId.scrollIntoView({ behavior: 'instant', block: 'center' });
          byId.click();
          resolve({ clicked: true });
          return;
        }
        // Fallback: search all buttons by text content
        for (const sel of BUTTONS) {
          const el = findByText(document.querySelectorAll(sel), matcher);
          if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            el.click();
            resolve({ clicked: true });
            return;
          }
        }
        if (Date.now() - start < timeoutMs) {
          setTimeout(poll, 300);
        } else {
          resolve({ clicked: false, reason: label + ' not found' });
        }
      }
      poll();
    });
  }
}
