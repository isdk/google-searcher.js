import { describe, it, expect } from 'vitest';
import { WebSearcher } from '@isdk/web-searcher';
import { GoogleSearcher } from './google';

// Run this test only if the environment variable RunNetworkTests is set to 'true'
const runRealNetworkTests = process.env.RunNetworkTests === 'true';

describe.skipIf(!runRealNetworkTests)('Google Search Engine (Live)', () => {
  beforeAll(() => {
    WebSearcher.register(GoogleSearcher);
  });
  afterAll(() => {
    WebSearcher.unregister(GoogleSearcher);
  });

  it('should fetch real results from Google', async () => {
    const limit = 5;
    // Execute search using the static helper
    // We pass { engine: 'http' } to override the default 'auto' if desired,
    // but GoogleSearcher defaults to 'auto' which is fine.
    // Setting a timeout is good practice.
    const results = await WebSearcher.search('google', 'hello world', {
      limit,
      timeoutMs: 3_000_000 // 50 mins
    });

    console.log(`Successfully fetched ${results.length} results.`);
    if (results.length > 0) {
      console.log('results:', results);
    }

    expect(results.length).toBe(limit);

    const first = results[0];
    expect(first.title).toBeDefined();
    expect(first.url).toMatch(/^https?:\/\//);
    expect(first.url).not.toContain('/url?q=');
  }, 3_000_000);

  it('should fetch real results from Google with time range', async () => {
    const limit = 5;
    // Use 'hour' to get results like "xx minutes ago"
    const results = await WebSearcher.search('google', 'typescript', {
      limit,
      timeRange: 'hour', // qdr:h
      timeoutMs: 3_000_000
    });

    console.log(`Successfully fetched ${results.length} results with time range.`);
    if (results.length > 0) {
      console.log('results:', results);
    }

    // Log dates for debugging
    const dates = results.map(r => r.date).filter(Boolean);
    console.log('Found dates:', dates);

    expect(results.length).toBeGreaterThan(0);

    // Verify at least one result has a date detected (Google usually shows dates for recent news/updates)
    // Note: Sometimes not ALL results have dates, but top ones usually do for strict time ranges.
    expect(dates.length).toBeGreaterThan(0);

    // Verify format of detected dates
    // They should be like "10 mins ago", "5分钟前", "Just now"
    // Keywords to look for: minute, min, hour, hr, second, sec, now, 分, 时, 秒
    const timeKeywords = /min|hour|hr|sec|now|分|时|秒/i;

    results.forEach(item => {
      if (item.date) {
        expect(item.date).toMatch(timeKeywords);
      }
      expect(item.title).toBeDefined();
      expect(item.url).toMatch(/^https?:\/\//);
    });
  }, 3_000_000);
});
