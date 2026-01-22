import pLimit from 'p-limit';
import { FetcherOptions } from '@isdk/web-fetcher';
import { PaginationConfig, SearchOptions, WebSearcher } from '@isdk/web-searcher';
import { extractDate } from './extractor/index.js';

export class GoogleSearcher extends WebSearcher {
  static override alias = ['google'];

  override get template(): FetcherOptions {
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
      // url: 'https://www.google.com',
      actions: [
        // { id: 'goto', params: { url: 'https://www.google.com/search?q=${query}' } },

        // 模拟人类行为：先等待，建立 Session 和指纹信任, 这样没用
        // { id: 'waitFor', params: { ms: 200 } },
        // 1. 首次搜索：模拟人类输入并提交，建立信任
        // { id: 'fill', params: { selector: 'textarea[name="q"]', value: '${query}' } },
        // { id: 'waitFor', params: { ms: 10 } },
        // { id: 'submit', params: { selector: 'form' } },
        // { id: 'waitFor', params: { selector: '#main #search' } }, // 等待第一次搜索结果

        // 2. 二次跳转：应用高级参数 (如果有)，此时已有信任基础
        { id: 'goto', params: { url: 'https://www.google.com/search?q=${query}${extraParams}' } },
        // { id: 'waitFor', params: { networkIdle: true, ms: 5500 } },
        //  {
        //   id: 'evaluate',
        //   params: {
        //     fn: (url: string) => { window.location.assign(url); },
        //     args: 'https://www.google.com/search?q=${query}${extraParams}'
        //   }
        // },
        { id: 'waitFor', params: { selector: '#main #search' } }, // 等待最终结果
        { "action": "trim", "params": { "presets": "all" } },
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
    const params = new URLSearchParams();

    // Map Time Range
    if (options.timeRange) {
      if (typeof options.timeRange === 'string') {
        const timeMap: Record<string, string> = {
          hour: 'qdr:h',
          day: 'qdr:d',
          week: 'qdr:w',
          month: 'qdr:m',
          year: 'qdr:y',
        };
        if (timeMap[options.timeRange]) {
          params.set('tbs', timeMap[options.timeRange]);
        }
      } else {
        // Custom Range
        const fromDate = new Date(options.timeRange.from);
        const toDate = options.timeRange.to ? new Date(options.timeRange.to) : new Date();

        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
           const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
           params.set('tbs', `cdr:1,cd_min:${format(fromDate)},cd_max:${format(toDate)}`);
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
        params.set('tbm', catMap[options.category]);
      }
    }

    // Map Region/Language
    if (options.region) params.set('gl', options.region);
    if (options.language) params.set('hl', options.language);

    // Map SafeSearch
    if (options.safeSearch) {
        if (options.safeSearch === 'strict') params.set('safe', 'active');
        else if (options.safeSearch === 'off') params.set('safe', 'images');
    }

    if (options.offset && options.offset > 0) {
      params.set('start', options.offset.toString());
    }

    const paramStr = params.toString();
    return {
        extraParams: paramStr ? '&' + paramStr : ''
    };
  }

  protected override async transform(outputs: Record<string, any>, options: SearchOptions = {}): Promise<any[]> {
    const results = outputs['results'] || [];
    if (!Array.isArray(results)) return [];

    const processedResults = results.map(item => {
      // 1. Clean URL
      if (item.url && item.url.startsWith('/url?q=')) {
        try {
          const urlObj = new URL(item.url, 'https://www.google.com');
          const realUrl = urlObj.searchParams.get('q');
          if (realUrl) item.url = realUrl;
        } catch (e) {
          // Ignore
        }
      }

      // 2. Extract Date from Snippet (HTML based) - Fast pass
      // Pattern: <span class="YrbPuc"><span><span></span>DateString</span> — </span>
      if (item.snippet) {
        // More flexible regex to handle attributes and inner tags like <em>
        const dateRegex = /<span[^>]*>\s*<span[^>]*>\s*<span[^>]*><\/span>(.+?)<\/span>\s*(?:—|·)\s*<\/span>/;
        const match = item.snippet.match(dateRegex);

        if (match) {
          // Extract and clean the date string (remove <em> etc.)
          item.date = match[1].replace(/<[^>]*>/g, '').trim();
          // Remove the date part from HTML, keep the rest HTML intact
          item.snippet = item.snippet.replace(match[0], '').trim();
        }
      }
      return item;
    });

    // 3. Deep Date Extraction (Secondary Fetch) - Optional
    if (options.needDate) {
      const limit = pLimit(options.concurrency || 5);
      const tasks = processedResults.map(item =>
        limit(async () => {
          // Only extract if date is missing and URL exists
          if (item.url && !item.date) {
            try {
              // Try to extract date from the landing page
              const date = await extractDate(item.url, { timeout: 5000 });
              if (date) {
                item.date = date;
              }
            } catch (e) {
              // Ignore extraction errors
            }
          }
        })
      );
      await Promise.all(tasks);
    }

    return processedResults;
  }
}