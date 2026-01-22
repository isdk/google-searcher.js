import { describe, it, expect } from 'vitest'
import { GoogleSearcher } from './google'
import { SearchOptions } from '@isdk/web-searcher'

class TestGoogleSearcher extends GoogleSearcher {
  public testFormatOptions(options: SearchOptions) {
    return this.formatOptions(options)
  }
}

describe('GoogleSearcher Options', () => {
  const searcher = new TestGoogleSearcher()

  it('should map timeRange presets correctly', () => {
    expect(
      searcher.testFormatOptions({ timeRange: 'hour' }).extraParams
    ).toContain('tbs=qdr%3Ah')
    expect(
      searcher.testFormatOptions({ timeRange: 'day' }).extraParams
    ).toContain('tbs=qdr%3Ad')
    expect(
      searcher.testFormatOptions({ timeRange: 'week' }).extraParams
    ).toContain('tbs=qdr%3Aw')
    expect(
      searcher.testFormatOptions({ timeRange: 'month' }).extraParams
    ).toContain('tbs=qdr%3Am')
    expect(
      searcher.testFormatOptions({ timeRange: 'year' }).extraParams
    ).toContain('tbs=qdr%3Ay')
  })

  it('should map custom timeRange correctly', () => {
    const from = new Date('2023-01-01')
    const to = new Date('2023-12-31')
    const result = searcher.testFormatOptions({
      timeRange: { from, to },
    })

    // cdr:1,cd_min:1/1/2023,cd_max:12/31/2023
    // Encoded: cdr%3A1%2Ccd_min%3A1%2F1%2F2023%2Ccd_max%3A12%2F31%2F2023
    // We can just check for key parts if encoding is tricky to predict exactly across envs,
    // but URLSearchParams is standard.
    // Let's check for the presence of the encoded date strings.
    expect(result.extraParams).toContain(
      'tbs=cdr%3A1%2Ccd_min%3A1%2F1%2F2023%2Ccd_max%3A12%2F31%2F2023'
    )
  })

  it('should map custom timeRange with default "to" date', () => {
    const from = new Date('2023-01-01')
    const result = searcher.testFormatOptions({
      timeRange: { from },
    })

    const today = new Date()
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
    const encodedToday = encodeURIComponent(todayStr)

    expect(result.extraParams).toContain(`cd_min%3A1%2F1%2F2023`)
    expect(result.extraParams).toContain(`cd_max%3A${encodedToday}`)
  })

  it('should map categories correctly', () => {
    expect(
      searcher.testFormatOptions({ category: 'images' }).extraParams
    ).toContain('tbm=isch')
    expect(
      searcher.testFormatOptions({ category: 'videos' }).extraParams
    ).toContain('tbm=vid')
    expect(
      searcher.testFormatOptions({ category: 'news' }).extraParams
    ).toContain('tbm=nws')
  })

  it('should map region and language', () => {
    const result = searcher.testFormatOptions({ region: 'US', language: 'en' })
    expect(result.extraParams).toContain('gl=US')
    expect(result.extraParams).toContain('hl=en')
  })

  it('should map safeSearch', () => {
    expect(
      searcher.testFormatOptions({ safeSearch: 'strict' }).extraParams
    ).toContain('safe=active')
    expect(
      searcher.testFormatOptions({ safeSearch: 'off' }).extraParams
    ).toContain('safe=images')
  })

  it('should map offset to start param when offset > 0', () => {
    expect(searcher.testFormatOptions({ offset: 10 }).extraParams).toContain(
      'start=10'
    )
    expect(searcher.testFormatOptions({ offset: 20 }).extraParams).toContain(
      'start=20'
    )
  })

  it('should not include start param when offset is 0 or undefined', () => {
    expect(searcher.testFormatOptions({ offset: 0 }).extraParams).not.toContain(
      'start='
    )
    expect(searcher.testFormatOptions({}).extraParams).not.toContain('start=')
  })

  it('should handle multiple options together', () => {
    const options: SearchOptions = {
      category: 'news',
      timeRange: 'day',
      region: 'US',
    }
    const result = searcher.testFormatOptions(options)
    expect(result.extraParams).toContain('tbm=nws')
    expect(result.extraParams).toContain('tbs=qdr%3Ad')
    expect(result.extraParams).toContain('gl=US')
  })
})
