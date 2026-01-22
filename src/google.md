# Google Searcher

The `GoogleSearcher` is a specialized search engine scraper for Google, built on top of the `WebSearcher` framework. It uses browser-based scraping to navigate through search results, handle pagination, and extract structured data.

## Features

- **Browser-based Execution**: Uses Playwright (via `@isdk/web-fetcher`) to render JavaScript and simulate user behavior, capable of handling basic anti-bot challenges.
- **Pagination**: Automatically handles multi-page results using Google's `start` offset parameter.
- **Data Extraction**: Extracts titles, clean URLs, snippets, and attempts to parse publication dates from result snippets.
- **URL Cleaning**: Automatically unwraps Google's `/url?q=...` redirection links.

## Usage

```typescript
import { GoogleSearcher, WebSearcher } from '@isdk/ai-tools';

// Register if not already done
WebSearcher.register(GoogleSearcher);

const results = await WebSearcher.search('google', 'typescript best practices', {
  limit: 20,
  region: 'US',
  language: 'en',
  timeRange: 'year'
});
```

## Options

In addition to standard `SearchOptions`, `GoogleSearcher` maps the following:

| Option | Type | Description |
| :--- | :--- | :--- |
| `region` | `string` | ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB'). Maps to `gl` parameter. |
| `language` | `string` | ISO 639-1 language code (e.g., 'en', 'fr'). Maps to `hl` parameter. |
| `timeRange` | `string` | Filter by time: `'hour'`, `'day'`, `'week'`, `'month'`, `'year'`. Maps to `tbs=qdr:...`. |
| `timeRange` (Custom) | `{ from: Date, to?: Date }` | Custom date range. Maps to `tbs=cdr:1,cd_min:...,cd_max:...`. |
| `category` | `string` | Search category: `'images'`, `'videos'`, `'news'`. Maps to `tbm`. |
| `safeSearch` | `string` | `'off'`, `'strict'`. Maps to `safe`. |
| `offset` | `number` | Starting index (0-based). Maps to `start`. |
| `needDate` | `boolean` | If `true`, will attempt to fetch and extract publication dates for each result if not found in snippets. |

## Implementation Details

- **Engine**: `browser` (Headless mode by default, can be configured).
- **Pagination Type**: `url-param` (parameter: `start`, increments by 10).
- **Selector**: Targets `#main #search` for the result container and `a:has(h3)` for items.
- **Anti-bot**: Includes basic wait actions and strict selector targeting. Note that aggressive scraping may still trigger CAPTCHAs.
