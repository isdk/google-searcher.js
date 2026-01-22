# Google 搜索器 (Google Searcher)

`GoogleSearcher` 是一个专门为 Google 开发的搜索引擎抓取工具，基于 `WebSearcher` 框架构建。它利用浏览器自动化技术来获取搜索结果，支持自动翻页和结构化数据提取。

## 特性

- **基于浏览器执行**: 使用 Playwright (通过 `@isdk/web-fetcher`) 渲染页面并模拟用户行为，能够应对基础的反爬虫机制。
- **自动分页**: 自动处理多页结果抓取（通过 Google 的 `start` 偏移量参数）。
- **数据提取**: 提取标题 (title)、清洗后的链接 (url)、摘要 (snippet)，并尝试从摘要中解析发布日期。
- **URL 清洗**: 自动移除 Google 的 `/url?q=...` 重定向包装，获取真实的目标链接。

## 使用方法

```typescript
import { GoogleSearcher, WebSearcher } from '@isdk/ai-tools';

// 注册引擎 (如果尚未注册)
WebSearcher.register(GoogleSearcher);

const results = await WebSearcher.search('google', 'typescript 最佳实践', {
  limit: 20,
  region: 'US',
  language: 'zh-CN',
  timeRange: 'year'
});
```

## 配置选项

`GoogleSearcher` 支持并将以下标准 `SearchOptions` 映射到 Google 参数：

| 选项 | 类型 | 说明 |
| :--- | :--- | :--- |
| `region` | `string` | 地区代码 (ISO 3166-1 alpha-2，如 'US', 'CN')。映射为 `gl` 参数。 |
| `language` | `string` | 界面语言代码 (ISO 639-1，如 'en', 'zh-CN')。映射为 `hl` 参数。 |
| `timeRange` | `string` | 时间范围过滤：支持 `'hour'` (小时), `'day'` (天), `'week'` (周), `'month'` (月), `'year'` (年)。映射为 `tbs=qdr:...`。 |
| `timeRange` (自定义) | `{ from: Date, to?: Date }` | 自定义时间范围。映射为 `tbs=cdr:1,cd_min:...,cd_max:...`。 |
| `category` | `string` | 搜索分类：`'images'` (图片), `'videos'` (视频), `'news'` (新闻)。映射为 `tbm`。 |
| `safeSearch` | `string` | 安全搜索级别：`'off'` (关闭), `'strict'` (严格)。映射为 `safe`。 |
| `offset` | `number` | 起始条目偏移量 (从0开始)。映射为 `start`。 |
| `needDate` | `boolean` | 是否需要提取发布日期。设为 `true` 时，若摘要中未找到日期，会异步抓取目标页面分析日期。 |

## 实现细节

- **引擎类型**: `browser` (默认无头模式，可配置)。
- **分页模式**: `url-param` (参数名: `start`，步长 10)。
- **选择器**: 使用 `#main #search` 定位结果容器，`a:has(h3)` 定位具体条目。
- **反爬虫**: 内置了基础的等待动作和精确的选择器定位。**注意**：高频或激进的抓取仍可能触发 Google 的 CAPTCHA 验证。
