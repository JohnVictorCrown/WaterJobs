class TrabalhaBrasilAdapter extends BaseAdapter {
  static matches(url) {
    return url.toLowerCase().includes('trabalhabrasil.com.br');
  }

  constructor(jobUrl) {
    super(jobUrl);
    this.engine = new TrabalhaBrasilEngine();
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

  clickSubmit() {
    return this.engine.clickSubmit();
  }
}

SiteRegistry.register(TrabalhaBrasilAdapter);
