import { FetcherOptions } from '@isdk/web-fetcher';
import { PaginationConfig, SearchOptions, WebSearcher } from '@isdk/web-searcher';

export class GoogleSearcher extends WebSearcher {
  static override alias = ['google'];

  get template(): FetcherOptions {
    return {
      engine: 'browser',
      antibot: true,
      timeoutMs: 300_000, // 5 minutes
      browser: {
        headless: false, // 显示浏览器窗口方面人机交互
      },
      debug: true,
      storage: {
        persist: true,
        purge: false,
      },
      // url: 'https://www.google.com/search?q=${query}&start=${offset}&tbs=${tbs}&tbm=${tbm}&gl=${gl}&hl=${hl}&safe=${safe}',
      url: 'https://www.google.com',
      actions: [
        { id: 'fill', params: { selector: 'textarea[name=q]', value: '${query}' } },
        { id: 'submit', params: { selector: 'form' } },
        { id: 'waitFor', params: { selector: '#main #search' } }, // 等待搜索结果容器出现
        { id: 'waitFor', params: { networkIdle: true } },
        { "action": "trim", "params": { "presets": "all",  } },
        {
          id: 'extract',
          storeAs: 'results',
          "params": {
            "type": "array",
            "mode": { "type": "segmented", "anchor": "a:has(h3)" },
            "selector": "#main #search",
            "items": {
              "url": { "selector": "a:has(h3)", "attribute": "href", "required": true },
              "title": { "selector": "a:has(h3) h3", "required": true, "mode": "innerText" },
              "snippet": { "selector": "div[style*='-webkit-line-clamp']", "type": "html" }
            }
          }
        }
      ]
    };
  }

  override get pagination(): PaginationConfig {
    return {
      type: 'url-param',
      paramName: 'start',
      startValue: 0,
      increment: 10
    };
  }

  protected override formatOptions(options: SearchOptions): Record<string, any> {
    const vars: Record<string, any> = {};

    // Map Time Range
    if (options.timeRange) {
      if (typeof options.timeRange === 'string') {
        const timeMap: Record<string, string> = {
          day: 'qdr:d',
          week: 'qdr:w',
          month: 'qdr:m',
          year: 'qdr:y',
        };
        if (timeMap[options.timeRange]) {
          vars.tbs = timeMap[options.timeRange];
        }
      } else {
        // Custom Range
        const fromDate = new Date(options.timeRange.from);
        const toDate = options.timeRange.to ? new Date(options.timeRange.to) : new Date();

        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
           const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
           vars.tbs = `cdr:1,cd_min:${format(fromDate)},cd_max:${format(toDate)}`;
        }
      }
    }

    // Map Category
    if (options.category) {
      const catMap: Record<string, string> = {
        images: 'isch',
        videos: 'vid',
        news: 'nws',
      };
      if (catMap[options.category]) {
        vars.tbm = catMap[options.category];
      }
    }

    // Map Region/Language
    if (options.region) vars.gl = options.region;
    if (options.language) vars.hl = options.language;

    // Map SafeSearch
    if (options.safeSearch) {
        if (options.safeSearch === 'strict') vars.safe = 'active';
        else if (options.safeSearch === 'off') vars.safe = 'images';
        // 'moderate' is usually default, so we might not need to set anything,
        // or explicitly set safe=active (which is often strict/moderate depending on region context).
        // Google simplified safe search to 'active' (on) or 'images' (blur explicit images) or nothing (off).
    }

    return vars;
  }

  protected override async transform(outputs: Record<string, any>): Promise<any[]> {
    const results = outputs['results'] || [];
    if (!Array.isArray(results)) return [];

    return results.map(item => {
      if (item.url && item.url.startsWith('/url?q=')) {
        try {
          const urlObj = new URL(item.url, 'https://www.google.com');
          const realUrl = urlObj.searchParams.get('q');
          if (realUrl) item.url = realUrl;
        } catch (e) {
          // Ignore
        }
      }
      return item;
    });
  }
}