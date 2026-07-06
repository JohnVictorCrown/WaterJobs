class YJobsAdapter extends BaseAdapter {
  static matches(url) {
    const u = url.toLowerCase();
    return u.includes('workatastartup.com') || u.includes('workatastartup');
  }

  constructor(jobUrl) {
    super(jobUrl);
    this.engine = new YJobsEngine();
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

  clickApply() {
    return this.engine.clickApply();
  }

  fillApplication() {
    return this.engine.fillApplication();
  }

  clickSend() {
    return this.engine.clickSend();
  }
}

SiteRegistry.register(YJobsAdapter);
