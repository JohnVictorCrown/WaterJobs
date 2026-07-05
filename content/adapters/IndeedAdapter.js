class IndeedAdapter extends BaseAdapter {
  static matches(url) {
    const u = url.toLowerCase();
    return u.includes('indeed.com') || u.includes('indeed.co.uk') || u.includes('indeed.de') || u.includes('indeed.fr') || u.includes('indeed.ca') || u.includes('indeed.com.au') || u.includes('indeed.co.in') || u.includes('indeed.it') || u.includes('indeed.es') || u.includes('indeed.nl') || u.includes('indeed.pl') || u.includes('indeed.se') || u.includes('indeed.ch') || u.includes('indeed.com.br') || u.includes('indeed.com.mx') || u.includes('indeed.com.ar') || u.includes('indeed.com.co') || u.includes('indeed.com.pe') || u.includes('indeed.com.pt');
  }

  constructor(jobUrl) {
    super(jobUrl);
    this.engine = new IndeedEngine();
  }

  isSerpPage() {
    return this.engine.isSerpPage();
  }

  scanSerp() {
    return this.engine.scanSerp();
  }

  isConfirmed() {
    return this.engine.isConfirmed();
  }
}

SiteRegistry.register(IndeedAdapter);
