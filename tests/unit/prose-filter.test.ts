import { describe, expect, it } from 'vitest'

describe('buildFindProseJS', () => {
  it('includes citation removal logic', async () => {
    const { buildFindProseJS } = await import('../../src/prose-filter.js')
    const js = buildFindProseJS()
    expect(js).toContain('.citation, .citation-nbsp')
    expect(js).toContain('cloneNode')
    expect(js).toContain('citations[c].remove()')
  })

  it('includes updated UI text prefixes', async () => {
    const { buildFindProseJS } = await import('../../src/prose-filter.js')
    const js = buildFindProseJS()
    expect(js).toContain("'Follow-ups'")
    expect(js).toContain("'sources'")
  })

  it('preserves exclusion tags', async () => {
    const { buildFindProseJS } = await import('../../src/prose-filter.js')
    const js = buildFindProseJS()
    expect(js).toContain('NAV')
    expect(js).toContain('ASIDE')
    expect(js).toContain('HEADER')
    expect(js).toContain('FOOTER')
    expect(js).toContain('FORM')
  })

  it('queries main and body prose elements', async () => {
    const { buildFindProseJS } = await import('../../src/prose-filter.js')
    const js = buildFindProseJS()
    expect(js).toContain('main [class*="prose"]')
    expect(js).toContain('body > [class*="prose"]')
  })

  it('returns results array', async () => {
    const { buildFindProseJS } = await import('../../src/prose-filter.js')
    const js = buildFindProseJS()
    expect(js.trim()).toMatch(/results$/)
  })
})

describe('buildPreSendStateScript', () => {
  it('wraps findProseJS in IIFE', async () => {
    const { buildPreSendStateScript } = await import('../../src/prose-filter.js')
    const js = buildPreSendStateScript()
    expect(js).toMatch(/\(function\(\)/)
    expect(js).toMatch(/\}\)\(\)/)
  })

  it('returns JSON with proseCount and lastProseText', async () => {
    const { buildPreSendStateScript } = await import('../../src/prose-filter.js')
    const js = buildPreSendStateScript()
    expect(js).toContain('JSON.stringify')
    expect(js).toContain('proseCount')
    expect(js).toContain('lastProseText')
  })

  // Edge case tests
  it('returns IIFE with proseCount and lastProseText', async () => {
    const { buildPreSendStateScript } = await import('../../src/prose-filter.js')
    const js = buildPreSendStateScript()
    expect(js).toMatch(/\(function\(\)/)
    expect(js).toContain('proseCount')
    expect(js).toContain('lastProseText')
  })

  it('includes findProseJS body with proseElements', async () => {
    const { buildPreSendStateScript } = await import('../../src/prose-filter.js')
    const js = buildPreSendStateScript()
    expect(js).toContain('proseElements')
    expect(js).toContain("querySelectorAll('main [class*=\"prose\"]")
  })

  it('includes excludeTags array', async () => {
    const { buildPreSendStateScript } = await import('../../src/prose-filter.js')
    const js = buildPreSendStateScript()
    expect(js).toContain('excludeTags')
    expect(js).toContain('NAV')
    expect(js).toContain('ASIDE')
    expect(js).toContain('HEADER')
    expect(js).toContain('FOOTER')
    expect(js).toContain('FORM')
  })
})
