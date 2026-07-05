class IndeedEngine {
  isSerpPage() {
    return !!document.querySelector('.job_seen_beacon');
  }

  scanSerp() {
    const cards = document.querySelectorAll('.job_seen_beacon');
    const jobs = [];
    for (const card of cards) {
      const link = card.querySelector('a[data-jk].jcs-JobTitle');
      if (!link) continue;
      if (!card.textContent.includes('Candidate-se facilmente')) continue;
      const jk = link.getAttribute('data-jk');
      const titleSpan = link.querySelector('span[title]');
      const title = (titleSpan?.textContent || link.textContent).trim();
      const company = card.querySelector('[data-testid="company-name"]')?.textContent?.trim() || '';
      const location = card.querySelector('[data-testid="text-location"]')?.textContent?.trim() || '';
      const salary = card.querySelector('.salary-snippet-container')?.textContent?.trim() || '';
      if (jk && title) {
        jobs.push({ jk, title, company, location, salary, url: `https://${window.location.hostname}/viewjob?jk=${jk}` });
      }
    }
    return jobs;
  }

  isConfirmed() {
    const t = (document.body.textContent || '').toLowerCase();
    const externalRedirect = 'para finalizar sua candidatura, você precisa concluir uma etapa final no site da empresa';
    if (t.includes(externalRedirect)) return externalRedirect;
    if (t.includes('sua inscrição foi enviada') && t.includes('você receberá uma confirmação no e-mail')) {
      return 'sua inscrição foi enviada + confirmação no e-mail';
    }
    return false;
  }
}
