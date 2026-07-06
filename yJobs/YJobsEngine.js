class YJobsEngine {
  /**
   * Check if the current page is a job listings (SERP) page.
   * The companies page shows a grid of job cards.
   */
  isSerpPage() {
    // The companies listing page has job links pointing to /jobs/[id]
    // Check for the grid container unique to the SERP page
    return window.location.pathname.includes('/companies') &&
           document.querySelectorAll('a[href^="/jobs/"]').length > 5;
  }

  /**
   * Scan the current SERP page and extract all job listings.
   * Work at a Startup renders jobs in a grid of cards.
   * Uses text-base font-semibold text-blue-500 for title links.
   */
  scanSerp() {
    const links = document.querySelectorAll('a[href^="/jobs/"]');
    const jobs = [];
    const seen = new Set();
    const now = Date.now();

    // Log for debugging
    console.log('[WaterJobs] scanSerp called, found ' + links.length + ' links at ' + new Date(now).toISOString());

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href || seen.has(href)) continue;
      seen.add(href);

      const title = (link.textContent || '').trim();
      if (!title) continue;

      // Try to find card by multiple strategies
      let card = link.closest('[class*="rounded"][class*="border-gray-200"]');
      
      // Fallback: walk up looking for rounded class
      if (!card) {
        let el = link;
        for (let d = 0; d < 5; d++) {
          el = el.parentElement;
          if (!el) break;
          if ((el.className || '').includes('rounded')) {
            card = el;
            break;
          }
        }
      }

      let company = '';
      let location = '';
      let salary = '';

      if (card) {
        // Company from img alt
        const logoImg = card.querySelector('img[alt]');
        if (logoImg && logoImg.alt.trim()) {
          company = logoImg.alt.trim();
        }

        // Location from third child
        const thirdChild = card.querySelector(':scope > div.mt-auto');
        if (thirdChild) {
          location = thirdChild.textContent.trim();
        }

        // Fallback company from first child
        if (!company) {
          const firstChild = card.querySelector(':scope > div:first-child');
          if (firstChild) {
            const clone = firstChild.cloneNode(true);
            clone.querySelectorAll('img').forEach(img => img.remove());
            company = (clone.textContent || '').trim();
          }
        }

        // Salary extraction
        const cardText = card.textContent;
        const normalized = (cardText || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\u200b/g, '')
          .replace(/\u200c/g, '')
          .replace(/\u200d/g, '');
        const patterns = [
          /\$[0-9,]+(?:\s*K)?\s*[-–—]+\s*\$[0-9,]+(?:\s*K)?/gi,
          /(?:salary|range|base|pay)\s*:?\s*\$[0-9,]+(?:\s*K)?(?:\s*[-–—]+\s*\$[0-9,]+(?:\s*K)?)?/gi
        ];
        let best = '';
        for (const p of patterns) {
          const m = normalized.match(p);
          if (m && m[0].trim().length > best.length) best = m[0].trim();
        }
        salary = best;
      }

      const url = `https://www.workatastartup.com${href}`;
      jobs.push({ title, company, location, salary, url });
    }

    console.log('[WaterJobs] scanSerp returning ' + jobs.length + ' jobs');
    return jobs;
  }

  /**
   * Check if the current page shows an application confirmation.
   */
  isConfirmed() {
    const t = (document.body.textContent || '').toLowerCase();

    // Possible confirmation texts after applying on Work at a Startup
    const phrases = [
      'application submitted',
      'your application has been submitted',
      'application sent',
      'thank you for your application',
      'your application was sent',
      'you have successfully applied'
    ];

    for (const phrase of phrases) {
      if (t.includes(phrase)) return phrase;
    }

    return false;
  }

  /**
   * Extract a salary string from card text.
   * Work at a Startup uses formats like "$200K - $250K" or "$185,000-$225,000".
   */
  static _extractSalary(text) {
    // Normalize non-breaking spaces and other invisible chars
    const normalized = (text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\u200b/g, '')
      .replace(/\u200c/g, '')
      .replace(/\u200d/g, '');

    // Match patterns like: $100K - $200K, $100k-$200k, $100,000 - $200,000, $100000 - $200000
    const patterns = [
      // Range: $100K - $200K or $185,000-$225,000
      /\$[0-9,]+(?:\s*K)?\s*[-–—]+\s*\$[0-9,]+(?:\s*K)?/gi,
      // Single or range with label prefix: "salary: $200K - $250K"
      /(?:salary|range|base|pay)\s*:?\s*\$[0-9,]+(?:\s*K)?(?:\s*[-–—]+\s*\$[0-9,]+(?:\s*K)?)?/gi
    ];

    let best = '';
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const found = match[0].trim();
        if (found.length > best.length) {
          best = found;
        }
      }
    }

    return best;
  }

  /**
   * Click the "Apply" / "Apply now" button on a job detail page.
   * Searches all orange-styled buttons by text, with fallback.
   * After clicking, a modal opens for filling the application.
   */
  clickApply() {
    return new Promise((resolve) => {
      const start = Date.now();
      const TIMEOUT = 15000;

      function normalizeText(text) {
        return (text || '').replace(/[\s\u00a0\u200b\u200c\u200d]+/g, ' ').trim().toLowerCase();
      }

      function isApplyText(text) {
        const t = normalizeText(text);
        return t === 'apply' || t === 'apply now' || t === 'apply for this job';
      }

      function poll() {
        // Strategy 1: All orange buttons by text
        const orangeBtns = document.querySelectorAll('a[class*="bg-orange-500"], button[class*="bg-orange-500"]');
        for (const btn of orangeBtns) {
          if (isApplyText(btn.textContent)) {
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            btn.click();
            resolve({ clicked: true });
            return;
          }
        }

        // Strategy 2: Any element with "Apply now" or "Apply" text
        const allClickable = document.querySelectorAll('a, button, [role="button"]');
        for (const el of allClickable) {
          if (isApplyText(el.textContent)) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            el.click();
            resolve({ clicked: true });
            return;
          }
        }

        if (Date.now() - start < TIMEOUT) {
          setTimeout(poll, 300);
        } else {
          resolve({ clicked: false, reason: 'Apply button not found' });
        }
      }

      poll();
    });
  }

  /**
   * Fill the application cover letter textarea in the modal.
   * Uses the hardcoded cover letter from getCoverLetter().
   * Waits for the textarea to appear (modal to render), fills it,
   * and dispatches native React events so the form state updates.
   */
  fillApplication() {
    const text = YJobsEngine.getCoverLetter();
    return new Promise((resolve) => {
      const TEXTAREA_SELECTORS = [
        'textarea',
        'textarea[placeholder*="write"]',
        'textarea[placeholder*="cover"]',
        'textarea[placeholder*="why"]',
        'textarea[placeholder*="message"]',
        '[contenteditable="true"]'
      ];

      const start = Date.now();
      const TIMEOUT = 10000;

      function poll() {
        let textarea = null;
        for (const sel of TEXTAREA_SELECTORS) {
          textarea = document.querySelector(sel);
          if (textarea) break;
        }

        if (textarea) {
          // For standard textarea
          if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
            // Set the native value using React-compatible setter
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            )?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(textarea, text);
            } else {
              textarea.value = text;
            }
          } else if (textarea.getAttribute('contenteditable') === 'true') {
            // For contenteditable divs
            textarea.textContent = text;
          }

          // Dispatch React-friendly events
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));

          resolve({ filled: true });
          return;
        }

        if (Date.now() - start < TIMEOUT) {
          setTimeout(poll, 300);
        } else {
          resolve({ filled: false, reason: 'Textarea not found' });
        }
      }

      poll();
    });
  }

  /**
   * Click the "Send" button to submit the application.
   * The button starts disabled and becomes enabled after the textarea is filled.
   */
  clickSend() {
    return new Promise((resolve) => {
      const start = Date.now();
      const TIMEOUT = 20000;

      function normalizeText(text) {
        return (text || '').replace(/\u00a0/g, ' ').trim().toLowerCase();
      }

      function poll() {
        // Priority 1: orange button with text "Send" (not disabled)
        const orangeBtns = document.querySelectorAll('button[class*="bg-orange-500"]');
        for (const btn of orangeBtns) {
          if (normalizeText(btn.textContent) === 'send' && !btn.disabled) {
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            btn.click();
            resolve({ clicked: true });
            return;
          }
        }

        // Priority 2: any button with text "Send" that's not disabled
        const allBtns = document.querySelectorAll('button:not([disabled])');
        for (const btn of allBtns) {
          if (normalizeText(btn.textContent) === 'send') {
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            btn.click();
            resolve({ clicked: true });
            return;
          }
        }

        // Priority 3: even disabled Send button — wait for it to become enabled
        const disabledBtns = document.querySelectorAll('button[disabled]');
        for (const btn of disabledBtns) {
          if (normalizeText(btn.textContent) === 'send') {
            // Still disabled — keep polling
            break;
          }
        }

        if (Date.now() - start < TIMEOUT) {
          setTimeout(poll, 300);
        } else {
          resolve({ clicked: false, reason: 'Send button not found or stayed disabled' });
        }
      }

      poll();
    });
  }

  /**
   * The cover letter text for Work at a Startup applications.
   */
  static getCoverLetter() {
    return `My name is John Victor. I am a systems architect and innovator, and I am reaching out because I want to put my skills in advanced software development, product architecture, and incentive engineering to work with the team at Forta.
I specialize in building highly scalable, real-world digital ecosystems. Currently, I have launched a functioning MVP for Water Party—a cross-platform social matching application designed to optimize community connections:
https://waterparty-react-14hr.onrender.com
Additionally, I am actively building Water Classroom—a global, AI-powered online school designed to democratize and personalize education on a massive scale:
https://waterclassroom.onrender.com/
Why Forta Interests Me:
Forta’s mission to scale structured clinical care and personalized learning environments aligns perfectly with my background in systems engineering and human dynamics. I am looking for a high-performance, mission-driven environment where I can collaborate with a dedicated team to architect, optimize, and deploy software solutions that tangibly improve lives.
You can review my complete professional profile, credentials, and business portfolios at our verified portals:
The Stellarium Foundation: https://www.stellarium.ddns-ip.net
Water Enterprises: https://water-enterprises-landing.onrender.com/
I would welcome the opportunity to start a conversation, share insights, and discuss how my technical and strategic background can support your roadmap.
Best regards,
John Victor`;
  }
}
