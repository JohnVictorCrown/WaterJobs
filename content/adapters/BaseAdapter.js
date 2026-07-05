class SiteRegistry {
  static adapters = [];

  static register(adapterClass) {
    this.adapters.push(adapterClass);
  }

  static getAdapter(url) {
    return this.adapters.find((a) => a.matches(url));
  }
}

class BaseAdapter {
  static matches(_url) {
    return false;
  }

  constructor(jobUrl) {
    this.jobUrl = jobUrl;
  }
}
